use std::collections::HashSet;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tauri::Emitter;
use tokio::net::UdpSocket;
use tokio::sync::Mutex;

use crate::game::GameWorld;
use crate::net::{
    decode_client, decode_server, encode_server, BROADCAST_HZ, GAME_PORT, MAX_PLAYERS, SIM_HZ,
};
use crate::protocol::{
    ClientMessage, InputSnapshot, LobbyPlayerSnapshot, LobbySnapshot, ServerMessage, SessionInfo,
};

pub type SharedState = Arc<Mutex<AppState>>;

#[derive(Clone, Debug)]
pub struct Peer {
    pub id: u8,
    pub addr: SocketAddr,
    pub last_seen: Instant,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SessionMode {
    Idle,
    Host,
    Client,
}

pub struct AppState {
    pub socket: Option<Arc<UdpSocket>>,
    pub mode: SessionMode,
    pub world: GameWorld,
    pub peers: Vec<Peer>,
    pub ready_players: HashSet<u8>,
    pub match_started: bool,
    pub my_id: u8,
    pub host_addr: Option<SocketAddr>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            socket: None,
            mode: SessionMode::Idle,
            world: GameWorld::default(),
            peers: Vec::new(),
            ready_players: HashSet::new(),
            match_started: false,
            my_id: 0,
            host_addr: None,
        }
    }
}

impl AppState {
    pub fn session_info(&self) -> SessionInfo {
        SessionInfo {
            player_id: self.my_id,
            world: self.world.config.clone(),
        }
    }

    pub fn lobby_snapshot(&self) -> LobbySnapshot {
        let mut players: Vec<_> = self
            .world
            .players
            .values()
            .map(|player| LobbyPlayerSnapshot {
                id: player.id,
                name: player.name.clone(),
                character_id: player.character_id.clone(),
                ready: player.id == 0 || self.ready_players.contains(&player.id),
                is_host: player.id == 0,
            })
            .collect();
        players.sort_by_key(|player| player.id);

        LobbySnapshot {
            players,
            max_players: MAX_PLAYERS,
            match_started: self.match_started,
            network_note: "Discovery uses UDP broadcast on 5554 and gameplay uses UDP 5555. If school WiFi blocks peer traffic, use manual IP or a hotspot.".to_string(),
        }
    }
}

pub async fn host_loop(socket: Arc<UdpSocket>, state: SharedState, window: tauri::Window) {
    let mut buf = [0u8; 8192];
    let mut sim_tick = tokio::time::interval(Duration::from_secs_f32(1.0 / SIM_HZ));
    let mut broadcast_tick = tokio::time::interval(Duration::from_secs_f32(1.0 / BROADCAST_HZ));

    loop {
        tokio::select! {
            _ = sim_tick.tick() => {
                let mut st = state.lock().await;
                if st.match_started {
                    st.world.tick(1.0 / SIM_HZ);
                }
            }
            _ = broadcast_tick.tick() => {
                let (message, peers, host_lobby) = {
                    let st = state.lock().await;
                    let message = if st.match_started {
                        ServerMessage::State(st.world.snapshot())
                    } else {
                        ServerMessage::Lobby(st.lobby_snapshot())
                    };
                    (message, st.peers.clone(), st.lobby_snapshot())
                };

                if let Ok(bytes) = encode_server(&message) {
                    for peer in peers {
                        let _ = socket.send_to(&bytes, peer.addr).await;
                    }
                }

                match message {
                    ServerMessage::State(snapshot) => {
                        let _ = window.emit("state", snapshot);
                    }
                    ServerMessage::Lobby(_) => {
                        let _ = window.emit("lobby", host_lobby);
                    }
                    _ => {}
                }
            }
            result = socket.recv_from(&mut buf) => {
                if let Ok((n, addr)) = result {
                    handle_host_message(&socket, &state, &buf[..n], addr).await;
                }
            }
        }
    }
}

async fn handle_host_message(
    socket: &UdpSocket,
    state: &SharedState,
    bytes: &[u8],
    addr: SocketAddr,
) {
    let Ok(message) = decode_client(bytes) else {
        return;
    };

    match message {
        ClientMessage::Join { name, character_id } => {
            let response = {
                let mut st = state.lock().await;
                if let Some(peer) = st.peers.iter_mut().find(|peer| peer.addr == addr) {
                    peer.last_seen = Instant::now();
                    ServerMessage::Assigned {
                        id: peer.id,
                        world: st.world.config.clone(),
                        map: st.world.map.snapshot(),
                        players: st.world.snapshot().players,
                    }
                } else if st.world.players.len() >= MAX_PLAYERS {
                    ServerMessage::Error {
                        message: "Game is full".to_string(),
                    }
                } else {
                    let id = next_player_id(&st);
                    st.peers.push(Peer {
                        id,
                        addr,
                        last_seen: Instant::now(),
                    });
                    st.world.add_player(id, name, character_id);
                    st.ready_players.remove(&id);
                    ServerMessage::Assigned {
                        id,
                        world: st.world.config.clone(),
                        map: st.world.map.snapshot(),
                        players: st.world.snapshot().players,
                    }
                }
            };

            if let Ok(bytes) = encode_server(&response) {
                let _ = socket.send_to(&bytes, addr).await;
            }
        }
        ClientMessage::SetReady { ready } => {
            let mut st = state.lock().await;
            let player_id = st
                .peers
                .iter_mut()
                .find(|peer| peer.addr == addr)
                .map(|peer| {
                    peer.last_seen = Instant::now();
                    peer.id
                });
            if let Some(player_id) = player_id {
                if ready {
                    st.ready_players.insert(player_id);
                } else {
                    st.ready_players.remove(&player_id);
                }
            }
        }
        ClientMessage::SelectCharacter { character_id } => {
            let mut st = state.lock().await;
            let player_id = st
                .peers
                .iter_mut()
                .find(|peer| peer.addr == addr)
                .map(|peer| {
                    peer.last_seen = Instant::now();
                    peer.id
                });
            if let Some(player_id) = player_id {
                if let Some(player) = st.world.players.get_mut(&player_id) {
                    player.character_id = character_id;
                }
            }
        }
        ClientMessage::Input(input) => {
            let mut st = state.lock().await;
            let player_id = st
                .peers
                .iter_mut()
                .find(|peer| peer.addr == addr)
                .map(|peer| {
                    peer.last_seen = Instant::now();
                    peer.id
                });
            if let Some(player_id) = player_id {
                st.world.set_input(player_id, input);
            }
        }
        ClientMessage::Leave => {
            let mut st = state.lock().await;
            if let Some(index) = st.peers.iter().position(|peer| peer.addr == addr) {
                let peer = st.peers.remove(index);
                st.world.remove_player(peer.id);
                st.ready_players.remove(&peer.id);
            }
        }
    }
}

fn next_player_id(state: &AppState) -> u8 {
    (1..=u8::MAX)
        .find(|id| !state.world.players.contains_key(id))
        .unwrap_or(u8::MAX)
}

pub async fn client_loop(socket: Arc<UdpSocket>, state: SharedState, window: tauri::Window) {
    let mut buf = [0u8; 8192];
    loop {
        let Ok((n, _)) = socket.recv_from(&mut buf).await else {
            continue;
        };

        let Ok(message) = decode_server(&buf[..n]) else {
            continue;
        };

        match message {
            ServerMessage::State(snapshot) => {
                {
                    let mut st = state.lock().await;
                    st.world.config = snapshot.world.clone();
                    st.world.tick = snapshot.tick;
                    st.world.players.clear();
                    for player in &snapshot.players {
                        st.world.add_player(
                            player.id,
                            player.name.clone(),
                            player.character_id.clone(),
                        );
                        if let Some(stored) = st.world.players.get_mut(&player.id) {
                            stored.x = player.x;
                            stored.y = player.y;
                            stored.angle = player.angle;
                            stored.color = player.color;
                        }
                    }
                }

                let _ = window.emit("state", snapshot);
            }
            ServerMessage::Lobby(lobby) => {
                let _ = window.emit("lobby", lobby);
            }
            ServerMessage::MatchStarted(snapshot) => {
                let _ = window.emit("match_started", snapshot.clone());
                let _ = window.emit("state", snapshot);
            }
            _ => {}
        }
    }
}

pub fn game_addr(ip: &str) -> Result<SocketAddr, String> {
    if ip.contains(':') {
        ip.parse()
            .map_err(|error: std::net::AddrParseError| error.to_string())
    } else {
        format!("{ip}:{GAME_PORT}")
            .parse()
            .map_err(|error: std::net::AddrParseError| error.to_string())
    }
}

pub fn input_message(input: InputSnapshot) -> Result<Vec<u8>, String> {
    crate::net::encode_client(&ClientMessage::Input(input))
}
