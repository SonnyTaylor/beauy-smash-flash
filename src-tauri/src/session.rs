use std::collections::HashSet;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tauri::Emitter;
use tokio::net::UdpSocket;
use tokio::sync::Mutex;

use crate::game::{GameWorld, ZOMBIE_ID_START};
use crate::game_log;
use crate::net::{
    decode_client, decode_server, encode_server, BROADCAST_HZ, GAME_PORT, MAX_PLAYERS, SIM_HZ,
};
use crate::protocol::{
    ClientMessage, Gamemode, InputSnapshot, LobbyConfig, LobbyPlayerSnapshot, LobbySnapshot,
    ServerMessage, SessionInfo,
};

pub type SharedState = Arc<Mutex<AppState>>;

const PEER_TIMEOUT: Duration = Duration::from_secs(6);
const CLIENT_PACKET_TIMEOUT: Duration = Duration::from_secs(4);

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
    pub match_paused: bool,
    pub match_end_emitted: bool,
    pub my_id: u8,
    pub host_addr: Option<SocketAddr>,
    pub lobby_config: LobbyConfig,
    pub bot_ids: HashSet<u8>,
    pub arena_ready_players: HashSet<u8>,
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
            match_paused: false,
            match_end_emitted: false,
            my_id: 0,
            host_addr: None,
            lobby_config: LobbyConfig::default(),
            bot_ids: HashSet::new(),
            arena_ready_players: HashSet::new(),
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
    st.match_paused = false;
    st.match_end_emitted = false;
    st.host_addr = None;
    st.my_id = 0;
    st.world = GameWorld::default();
    st.lobby_config = LobbyConfig::default();
    st.bot_ids.clear();
    st.arena_ready_players.clear();
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
            .filter(|player| !player.is_zombie)
            .map(|player| LobbyPlayerSnapshot {
                id: player.id,
                name: player.name.clone(),
                character_id: player.character_id.clone(),
                primary_weapon_id: player.loadout_primary_weapon_id.clone(),
                ready: if self.bot_ids.contains(&player.id) {
                    true
                } else {
                    self.ready_players.contains(&player.id)
                },
                is_host: player.id == 0,
                is_bot: player.is_bot,
                team: player.team,
            })
            .collect();
        players.sort_by_key(|player| player.id);

        LobbySnapshot {
            players,
            max_players: self.lobby_config.max_players as usize,
            match_started: self.match_started,
            network_note: String::new(),
            config: self.lobby_config.clone(),
        }
    }

    /// Returns true when every player in the world (including the host) has
    /// readied up. Used to gate the host's Start Match action.
    pub fn all_players_ready(&self) -> bool {
        if self.world.players.is_empty() {
            return false;
        }
        self.world.players.keys().all(|id| {
            if self.bot_ids.contains(id) {
                true
            } else {
                self.ready_players.contains(id)
            }
        })
    }

    pub fn human_player_count(&self) -> usize {
        self.world
            .players
            .values()
            .filter(|player| !player.is_bot)
            .count()
    }

    pub fn sync_bot_players(&mut self) {
        if self.lobby_config.gamemode == Gamemode::ZombieHorde {
            clear_bot_players(self);
            self.lobby_config.bot_count = 0;
            return;
        }

        let max_total = effective_max_players(self);
        let humans = self.human_player_count();
        let allowed_bots = max_total.saturating_sub(humans);
        let target = (self.lobby_config.bot_count as usize).min(allowed_bots);
        self.lobby_config.bot_count = target as u8;

        let mut current: Vec<u8> = self.bot_ids.iter().copied().collect();
        current.sort_unstable();

        while current.len() > target {
            let id = current.pop().expect("bot id");
            self.world.remove_player(id);
            self.bot_ids.remove(&id);
            self.ready_players.remove(&id);
        }

        while self.bot_ids.len() < target {
            let id = next_bot_id(self);
            let bot_number = self.bot_ids.len() + 1;
            let character_id = GameWorld::bot_character_for_index(self.bot_ids.len()).to_string();
            self.world.add_bot_player(
                id,
                format!("Bot {bot_number}"),
                character_id,
                "glock".to_string(),
            );
            if self.lobby_config.gamemode == Gamemode::TeamDeathmatch {
                let team = self.world.next_open_team_id();
                let _ = self.world.assign_team(id, team);
            }
            self.bot_ids.insert(id);
            self.ready_players.insert(id);
        }
    }
}

pub async fn host_loop(socket: Arc<UdpSocket>, state: SharedState, window: tauri::Window) {
    let mut buf = [0u8; 65535];
    let mut sim_tick = tokio::time::interval(Duration::from_secs_f32(1.0 / SIM_HZ));
    let mut broadcast_tick = tokio::time::interval(Duration::from_secs_f32(1.0 / BROADCAST_HZ));
    let mut broadcast_ticks: u64 = 0;

    loop {
        tokio::select! {
            _ = sim_tick.tick() => {
                let mut st = state.lock().await;
                if st.match_started && !st.world.match_ended && !st.match_paused {
                    let bot_ids = st.bot_ids.clone();
                    crate::bots::update_bot_inputs(&mut st.world, &bot_ids, 1.0 / SIM_HZ);
                    st.world.tick(1.0 / SIM_HZ);
                }
            }
            _ = broadcast_tick.tick() => {
                {
                    let mut st = state.lock().await;
                    remove_stale_peers(&mut st);
                }

                let (message, peers, host_lobby, match_just_ended) = {
                    let st = state.lock().await;
                    let match_just_ended = st.match_started
                        && st.world.match_ended
                        && !st.match_end_emitted;
                    let message = if st.match_started {
                        if st.world.match_ended {
                            ServerMessage::MatchEnded(st.world.snapshot())
                        } else {
                            ServerMessage::State(st.world.state_broadcast())
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

                broadcast_ticks += 1;
                let encode_start = Instant::now();
                if let Ok(bytes) = encode_server(&message) {
                    let encode_us = encode_start.elapsed().as_micros();
                    if broadcast_ticks.is_multiple_of(150) {
                        if matches!(message, ServerMessage::State(_)) {
                            game_log::info(
                                "net",
                                &format!(
                                    "state {} bytes, encode {}us, {} peers",
                                    bytes.len(),
                                    encode_us,
                                    peers.len()
                                ),
                            );
                        }
                    }
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
            protocol_version,
        } => {
            if protocol_version != crate::protocol::PROTOCOL_VERSION {
                let message = crate::version::protocol_mismatch_message(
                    crate::protocol::PROTOCOL_VERSION,
                    protocol_version,
                );
                if let Ok(bytes) = encode_server(&ServerMessage::Error { message }) {
                    let _ = socket.send_to(&bytes, addr).await;
                }
                return;
            }

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
                    remove_stale_peers(&mut st);
                    remove_orphan_players(&mut st);
                    let id = next_player_id(&st);
                    let resolved_name = crate::names::resolve_player_name(&name, &character_id);
                    st.peers.push(Peer {
                        id,
                        addr,
                        last_seen: Instant::now(),
                    });
                    st.world
                        .add_player(id, resolved_name, character_id, primary_weapon_id);
                    if st.lobby_config.gamemode == Gamemode::TeamDeathmatch {
                        let team = st.world.next_open_team_id();
                        let _ = st.world.assign_team(id, team);
                    }
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

            // If a match is already in progress, push the new peer straight into the game.
            let match_in_progress = {
                let st = state.lock().await;
                st.match_started
            };
            if match_in_progress {
                let snapshot = {
                    let st = state.lock().await;
                    st.world.snapshot()
                };
                if let Ok(bytes) = encode_server(&ServerMessage::MatchStarted(snapshot)) {
                    let _ = socket.send_to(&bytes, addr).await;
                }
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
                let match_in_progress = st.match_started;
                if let Some(player) = st.world.players.get_mut(&player_id) {
                    let previous_name = player.name.clone();
                    let weapon_id = player.loadout_primary_weapon_id.clone();
                    player.apply_loadout(character_id, weapon_id, match_in_progress);
                    if crate::names::is_placeholder_player_name(&previous_name) {
                        player.name =
                            crate::names::resolve_player_name(&previous_name, &player.character_id);
                    }
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
                let match_in_progress = st.match_started;
                if let Some(player) = st.world.players.get_mut(&player_id) {
                    let previous_name = player.name.clone();
                    player.apply_loadout(character_id, primary_weapon_id, match_in_progress);
                    if crate::names::is_placeholder_player_name(&previous_name) {
                        player.name =
                            crate::names::resolve_player_name(&previous_name, &player.character_id);
                    }
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
                        player.name =
                            crate::names::resolve_player_name(&cleaned, &player.character_id);
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
        ClientMessage::SetTeam { team } => {
            let mut st = state.lock().await;
            if st.match_started {
                return;
            }
            let player_id = st
                .peers
                .iter_mut()
                .find(|peer| peer.addr == addr)
                .map(|peer| {
                    peer.last_seen = Instant::now();
                    peer.id
                });
            if let Some(player_id) = player_id {
                if team > 2 {
                    return;
                }
                let _ = st.world.assign_team(player_id, team);
            }
        }
        ClientMessage::ArenaReady => {
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
                st.arena_ready_players.insert(player_id);
                try_unpause_match_if_all_arena_ready(&mut st);
            }
        }
        ClientMessage::Leave => {
            let mut st = state.lock().await;
            if let Some(index) = st.peers.iter().position(|peer| peer.addr == addr) {
                let peer = st.peers.remove(index);
                st.world.remove_player(peer.id);
                st.ready_players.remove(&peer.id);
                st.arena_ready_players.remove(&peer.id);
                try_unpause_match_if_all_arena_ready(&mut st);
                game_log::info("session", &format!("player {} left", peer.id));
            }
        }
    }
}

fn human_match_player_ids(state: &AppState) -> HashSet<u8> {
    state
        .world
        .players
        .values()
        .filter(|player| !player.is_bot && !player.is_zombie)
        .map(|player| player.id)
        .collect()
}

pub(crate) fn try_unpause_match_if_all_arena_ready(state: &mut AppState) {
    if !state.match_started || state.world.match_ended {
        return;
    }
    let required = human_match_player_ids(state);
    if required.is_empty() {
        return;
    }
    if required
        .iter()
        .all(|id| state.arena_ready_players.contains(id))
    {
        state.match_paused = false;
        game_log::info("session", "all players arena-ready — match live");
    }
}

fn remove_stale_peers(state: &mut AppState) {
    let now = Instant::now();
    let stale: Vec<u8> = state
        .peers
        .iter()
        .filter(|peer| now.duration_since(peer.last_seen) > PEER_TIMEOUT)
        .map(|peer| peer.id)
        .collect();
    if stale.is_empty() {
        return;
    }
    state
        .peers
        .retain(|peer| now.duration_since(peer.last_seen) <= PEER_TIMEOUT);
    for id in stale {
        state.world.remove_player(id);
        state.ready_players.remove(&id);
        state.arena_ready_players.remove(&id);
        game_log::info("session", &format!("removed stale player {id}"));
    }
    try_unpause_match_if_all_arena_ready(state);
}

fn remove_orphan_players(state: &mut AppState) {
    let peer_ids: HashSet<u8> = state.peers.iter().map(|peer| peer.id).collect();
    let orphan_ids: Vec<u8> = state
        .world
        .players
        .keys()
        .copied()
        .filter(|id| *id != 0 && !peer_ids.contains(id) && !state.bot_ids.contains(id))
        .collect();
    for id in orphan_ids {
        state.world.remove_player(id);
        state.ready_players.remove(&id);
        state.arena_ready_players.remove(&id);
        game_log::info("session", &format!("removed orphan player {id}"));
    }
}

fn next_player_id(state: &AppState) -> u8 {
    (1..ZOMBIE_ID_START)
        .find(|id| !state.world.players.contains_key(id))
        .unwrap_or(ZOMBIE_ID_START - 1)
}

fn next_bot_id(state: &AppState) -> u8 {
    (1..ZOMBIE_ID_START)
        .find(|id| !state.world.players.contains_key(id))
        .unwrap_or(ZOMBIE_ID_START - 1)
}

fn clear_bot_players(state: &mut AppState) {
    let bot_ids: Vec<u8> = state.bot_ids.iter().copied().collect();
    for id in bot_ids {
        state.world.remove_player(id);
        state.bot_ids.remove(&id);
        state.ready_players.remove(&id);
    }
}

fn effective_max_players(state: &AppState) -> usize {
    (state.lobby_config.max_players as usize).min(MAX_PLAYERS)
}

fn clean_name(name: &str) -> String {
    name.trim().chars().take(24).collect()
}

pub async fn client_loop(socket: Arc<UdpSocket>, state: SharedState, window: tauri::Window) {
    let mut buf = [0u8; 65535];
    let mut last_message = Instant::now();

    loop {
        let recv =
            tokio::time::timeout(Duration::from_millis(500), socket.recv_from(&mut buf)).await;

        match recv {
            Ok(Ok((n, _))) => {
                last_message = Instant::now();
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
                    ServerMessage::Error { message } => {
                        game_log::warn("session", &message);
                        let _ = window.emit("session_lost", message);
                        break;
                    }
                    _ => {}
                }
            }
            Ok(Err(error)) => {
                game_log::warn("session", &format!("client recv error: {error}"));
            }
            Err(_) => {
                let should_disconnect = {
                    let st = state.lock().await;
                    st.mode == SessionMode::Client && last_message.elapsed() > CLIENT_PACKET_TIMEOUT
                };
                if should_disconnect {
                    let message = "Lost connection to host.".to_string();
                    game_log::warn("session", &message);
                    let _ = window.emit("session_lost", message);
                    break;
                }
            }
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
