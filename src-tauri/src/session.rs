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
    ClientMessage, InputSnapshot, LobbyConfig, LobbyPlayerSnapshot, LobbySnapshot, ServerMessage,
    SessionInfo,
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
    pub match_end_emitted: bool,
    pub my_id: u8,
    pub host_addr: Option<SocketAddr>,
    pub lobby_config: LobbyConfig,
    pub host_task: Option<tokio::task::JoinHandle<()>>,
    pub client_task: Option<tokio::task::JoinHandle<()>>,
    pub discovery_task: Option<tokio::task::JoinHandle<()>>,
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
            match_end_emitted: false,
            my_id: 0,
            host_addr: None,
            lobby_config: LobbyConfig::default(),
            host_task: None,
            client_task: None,
            discovery_task: None,
        }
    }
}

/// Tear down sockets and background loops so ports can be rebound (e.g. host again).
pub async fn shutdown_session(state: &SharedState) {
    let mut st = state.lock().await;
    if let Some(handle) = st.host_task.take() {
        handle.abort();
    }
    if let Some(handle) = st.client_task.take() {
        handle.abort();
    }
    if let Some(handle) = st.discovery_task.take() {
        handle.abort();
    }
    st.socket = None;
    st.mode = SessionMode::Idle;
    st.peers.clear();
    st.ready_players.clear();
    st.match_started = false;
    st.match_end_emitted = false;
    st.host_addr = None;
    st.my_id = 0;
    st.world = GameWorld::default();
    st.lobby_config = LobbyConfig::default();
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
                primary_weapon_id: player.loadout_primary_weapon_id.clone(),
                ready: self.ready_players.contains(&player.id),
                is_host: player.id == 0,
            })
            .collect();
        players.sort_by_key(|player| player.id);

        LobbySnapshot {
            players,
            max_players: self.lobby_config.max_players as usize,
            match_started: self.match_started,
            network_note: "Discovery uses UDP broadcast on 5554 and gameplay uses UDP 5555. If school WiFi blocks peer traffic, use manual IP or a hotspot.".to_string(),
            config: self.lobby_config.clone(),
        }
    }

    /// Returns true when every player in the world (including the host) has
    /// readied up. Used to gate the host's Start Match action.
    pub fn all_players_ready(&self) -> bool {
        if self.world.players.is_empty() {
            return false;
        }
        self.world
            .players
            .keys()
            .all(|id| self.ready_players.contains(id))
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
                if st.match_started && !st.world.match_ended {
                    st.world.tick(1.0 / SIM_HZ);
                }
            }
            _ = broadcast_tick.tick() => {
                let (message, peers, host_lobby, match_just_ended) = {
                    let st = state.lock().await;
                    let match_just_ended = st.match_started
                        && st.world.match_ended
                        && !st.match_end_emitted;
                    let message = if st.match_started {
                        if st.world.match_ended {
                            ServerMessage::MatchEnded(st.world.snapshot())
                        } else {
                            ServerMessage::State(st.world.snapshot())
                        }
                    } else {
                        ServerMessage::Lobby(st.lobby_snapshot())
                    };
                    (message, st.peers.clone(), st.lobby_snapshot(), match_just_ended)
                };

                if match_just_ended {
                    let mut st = state.lock().await;
                    st.match_end_emitted = true;
                }

                if let Ok(bytes) = encode_server(&message) {
                    for peer in peers {
                        let _ = socket.send_to(&bytes, peer.addr).await;
                    }
                }

                match &message {
                    ServerMessage::State(snapshot) => {
                        let _ = window.emit("state", snapshot.clone());
                    }
                    ServerMessage::MatchEnded(snapshot) => {
                        let _ = window.emit("match_ended", snapshot.clone());
                        let _ = window.emit("state", snapshot.clone());
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
        ClientMessage::Join {
            name,
            character_id,
            primary_weapon_id,
        } => {
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
                } else if st.world.players.len() >= effective_max_players(&st) {
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
                    st.world
                        .add_player(id, name, character_id, primary_weapon_id);
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
                    let weapon_id = player.loadout_primary_weapon_id.clone();
                    player.apply_loadout(character_id, weapon_id);
                }
            }
        }
        ClientMessage::UpdateLoadout {
            character_id,
            primary_weapon_id,
        } => {
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
                    player.apply_loadout(character_id, primary_weapon_id);
                    st.ready_players.remove(&player_id);
                }
            }
        }
        ClientMessage::SetName { name } => {
            let cleaned = clean_name(&name);
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
                    if !cleaned.is_empty() {
                        player.name = cleaned;
                    }
                }
            }
        }
        ClientMessage::UpdateConfig { config: _ } => {
            // Only the host can update the lobby config, and the host updates
            // its own state via the Tauri command (not via the wire). Ignore
            // any peer claiming to push config.
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

fn effective_max_players(state: &AppState) -> usize {
    (state.lobby_config.max_players as usize).min(MAX_PLAYERS)
}

fn clean_name(name: &str) -> String {
    name.trim().chars().take(24).collect()
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
                    st.world.sync_from_snapshot(&snapshot);
                }
                let _ = window.emit("state", snapshot);
            }
            ServerMessage::MatchEnded(snapshot) => {
                {
                    let mut st = state.lock().await;
                    st.world.sync_from_snapshot(&snapshot);
                    st.match_end_emitted = true;
                }
                let _ = window.emit("match_ended", snapshot.clone());
                let _ = window.emit("state", snapshot);
            }
            ServerMessage::Lobby(lobby) => {
                let _ = window.emit("lobby", lobby);
            }
            ServerMessage::MatchStarted(snapshot) => {
                {
                    let mut st = state.lock().await;
                    st.world.sync_from_snapshot(&snapshot);
                    st.match_end_emitted = false;
                }
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
