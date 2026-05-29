use std::sync::Arc;
use std::time::{Duration, Instant};

use tauri::Emitter;
use tokio::net::UdpSocket;

use crate::discovery::{discovery_loop, scan_servers as scan_lan_servers};
use crate::game::{validate_match_config, GameWorld};
use crate::net::{decode_server, encode_client, encode_server, GAME_PORT};
use crate::network::best_local_ipv4;
use crate::protocol::{
    ClientMessage, InputSnapshot, LobbyConfig, ServerInfo, ServerMessage, SessionInfo,
};
use crate::session::{
    client_loop, game_addr, host_loop, input_message, shutdown_session, SessionMode, SharedState,
};
use crate::weapons;

#[tauri::command]
pub async fn stop_session(state: tauri::State<'_, SharedState>) -> Result<(), String> {
    shutdown_session(state.inner()).await;
    Ok(())
}

#[tauri::command]
pub async fn start_host(
    player_name: Option<String>,
    character_id: Option<String>,
    primary_weapon_id: Option<String>,
    server_name: Option<String>,
    window: tauri::Window,
    state: tauri::State<'_, SharedState>,
) -> Result<SessionInfo, String> {
    shutdown_session(state.inner()).await;

    let socket = Arc::new(
        UdpSocket::bind(format!("0.0.0.0:{GAME_PORT}"))
            .await
            .map_err(|error| error.to_string())?,
    );

    let info = {
        let mut st = state.lock().await;
        st.socket = Some(socket.clone());
        st.mode = SessionMode::Host;
        st.peers.clear();
        st.ready_players.clear();
        st.match_started = false;
        st.match_end_emitted = false;
        st.host_addr = None;
        st.my_id = 0;
        st.world = GameWorld::default();
        let mut lobby_config = LobbyConfig::default();
        lobby_config.server_name = clean_server_name(server_name);
        st.lobby_config = lobby_config;
        st.world.add_player(
            0,
            clean_player_name(player_name).unwrap_or_else(|| "Host".to_string()),
            clean_character_id(character_id),
            clean_weapon_id(primary_weapon_id),
        );
        st.session_info()
    };

    let state_clone = state.inner().clone();
    let host_handle = tokio::spawn(async move {
        host_loop(socket, state_clone, window).await;
    });
    let discovery_state = state.inner().clone();
    let discovery_handle = tokio::spawn(async move {
        discovery_loop(discovery_state).await;
    });

    {
        let mut st = state.lock().await;
        st.host_task = Some(host_handle);
        st.discovery_task = Some(discovery_handle);
    }

    Ok(info)
}

#[tauri::command]
pub async fn join_game(
    ip: String,
    player_name: Option<String>,
    character_id: Option<String>,
    primary_weapon_id: Option<String>,
    window: tauri::Window,
    state: tauri::State<'_, SharedState>,
) -> Result<SessionInfo, String> {
    shutdown_session(state.inner()).await;

    let socket = Arc::new(
        UdpSocket::bind("0.0.0.0:0")
            .await
            .map_err(|error| error.to_string())?,
    );
    let host_addr = game_addr(&ip)?;

    let join = ClientMessage::Join {
        name: clean_player_name(player_name).unwrap_or_else(|| "Player".to_string()),
        character_id: clean_character_id(character_id),
        primary_weapon_id: clean_weapon_id(primary_weapon_id),
        protocol_version: crate::protocol::PROTOCOL_VERSION,
    };
    let bytes = encode_client(&join)?;
    let assigned = wait_for_assignment(&socket, &host_addr, &bytes).await?;

    let (player_id, world) = match assigned {
        ServerMessage::Assigned {
            id,
            world,
            map,
            players,
        } => {
            let mut st = state.lock().await;
            st.socket = Some(socket.clone());
            st.mode = SessionMode::Client;
            st.peers.clear();
            st.ready_players.clear();
            st.match_started = false;
            st.match_end_emitted = false;
            st.host_addr = Some(host_addr);
            st.my_id = id;
            st.world = GameWorld::new(world.clone());
            let lobby_config = st.lobby_config.clone();
            st.world
                .sync_from_snapshot(&crate::protocol::StateSnapshot {
                    version: crate::protocol::PROTOCOL_VERSION,
                    tick: 0,
                    world: world.clone(),
                    map,
                    players,
                    bullets: Vec::new(),
                    effects: Vec::new(),
                    drones: Vec::new(),
                    kill_feed: Vec::new(),
                    match_ended: false,
                    winner_id: None,
                    score_limit: lobby_config.score_limit,
                    time_limit_secs: lobby_config.time_limit_secs,
                    match_elapsed_secs: 0.0,
                    win_condition: lobby_config.win_condition,
                    match_end_reason: None,
                    fog_of_war: lobby_config.fog_of_war,
                    gamemode: lobby_config.gamemode,
                    weapon_pickups: Vec::new(),
                    wave: 0,
                    zombies_remaining: 0,
                    wave_state: crate::protocol::WaveState::Intermission,
                    wave_intermission_secs: 0.0,
                    wave_goal: lobby_config.wave_goal,
                });
            (id, world)
        }
        ServerMessage::Error { message } => return Err(message),
        ServerMessage::State(_)
        | ServerMessage::Lobby(_)
        | ServerMessage::MatchStarted(_)
        | ServerMessage::MatchEnded(_) => return Err("Expected assignment from host".to_string()),
    };

    let state_clone = state.inner().clone();
    let client_handle = tokio::spawn(async move {
        client_loop(socket, state_clone, window).await;
    });

    {
        let mut st = state.lock().await;
        st.client_task = Some(client_handle);
    }

    Ok(SessionInfo { player_id, world })
}

#[tauri::command]
pub async fn scan_servers(timeout_ms: Option<u64>) -> Result<Vec<ServerInfo>, String> {
    scan_lan_servers(timeout_ms.unwrap_or(900)).await
}

#[tauri::command]
pub async fn local_ip() -> Result<String, String> {
    best_local_ipv4()
        .map(|ip| ip.to_string())
        .ok_or_else(|| "Could not determine local IP".to_string())
}

#[tauri::command]
pub async fn set_ready(ready: bool, state: tauri::State<'_, SharedState>) -> Result<(), String> {
    let (socket, host_addr, mode, my_id) = {
        let mut st = state.lock().await;
        if st.mode == SessionMode::Host {
            let my_id = st.my_id;
            if ready {
                st.ready_players.insert(my_id);
            } else {
                st.ready_players.remove(&my_id);
            }
        }
        (st.socket.clone(), st.host_addr, st.mode.clone(), st.my_id)
    };

    if mode == SessionMode::Client {
        if let (Some(socket), Some(host_addr)) = (socket, host_addr) {
            let bytes = encode_client(&ClientMessage::SetReady { ready })?;
            socket
                .send_to(&bytes, host_addr)
                .await
                .map_err(|error| error.to_string())?;
        }
    } else if mode == SessionMode::Host {
        let _ = my_id;
    }

    Ok(())
}

#[tauri::command]
pub async fn select_character(
    character_id: String,
    state: tauri::State<'_, SharedState>,
) -> Result<(), String> {
    update_loadout(character_id, None, state).await
}

#[tauri::command]
pub async fn update_loadout(
    character_id: String,
    primary_weapon_id: Option<String>,
    state: tauri::State<'_, SharedState>,
) -> Result<(), String> {
    let character_id = clean_character_id(Some(character_id));
    let primary_weapon_id = clean_weapon_id(primary_weapon_id);
    let (socket, host_addr, mode, my_id) = {
        let mut st = state.lock().await;
        if st.mode == SessionMode::Host {
            let my_id = st.my_id;
            let match_in_progress = st.match_started;
            if let Some(player) = st.world.players.get_mut(&my_id) {
                player.apply_loadout(
                    character_id.clone(),
                    primary_weapon_id.clone(),
                    match_in_progress,
                );
            }
            st.ready_players.remove(&my_id);
        }
        (st.socket.clone(), st.host_addr, st.mode.clone(), st.my_id)
    };

    if mode == SessionMode::Client {
        if let (Some(socket), Some(host_addr)) = (socket, host_addr) {
            let bytes = encode_client(&ClientMessage::UpdateLoadout {
                character_id,
                primary_weapon_id,
            })?;
            socket
                .send_to(&bytes, host_addr)
                .await
                .map_err(|error| error.to_string())?;
        }
    } else if mode == SessionMode::Host {
        let _ = my_id;
    }

    Ok(())
}

#[tauri::command]
pub async fn start_match(
    window: tauri::Window,
    state: tauri::State<'_, SharedState>,
) -> Result<(), String> {
    let (socket, peers, snapshot) = {
        let mut st = state.lock().await;
        if st.mode != SessionMode::Host {
            return Err("Only the host can start the match".to_string());
        }
        if st.world.players.is_empty() {
            return Err("No players in lobby".to_string());
        }
        if !st.all_players_ready() {
            return Err("All players must be ready".to_string());
        }
        let config = st.lobby_config.clone();
        validate_match_config(&config)?;
        st.match_end_emitted = false;
        let map_id = config.map_id.clone();
        st.world.set_map(&map_id);
        st.world.reset_for_match(
            config.score_limit,
            config.time_limit_secs,
            config.win_condition,
            config.gamemode,
            config.friendly_fire,
            config.fog_of_war,
            config.wave_goal,
        );
        st.match_started = true;
        st.match_paused = false;
        (st.socket.clone(), st.peers.clone(), st.world.snapshot())
    };

    if let Some(socket) = socket {
        let bytes = encode_server(&ServerMessage::MatchStarted(snapshot.clone()))?;
        for peer in peers {
            let _ = socket.send_to(&bytes, peer.addr).await;
        }
    }

    let _ = window.emit("match_started", snapshot.clone());
    let _ = window.emit("state", snapshot);
    Ok(())
}

#[tauri::command]
pub async fn set_bot_count(count: u8, state: tauri::State<'_, SharedState>) -> Result<(), String> {
    let mut st = state.lock().await;
    if st.mode != SessionMode::Host {
        return Err("Only the host can change bot count".to_string());
    }
    if st.match_started {
        return Err("Cannot change bots during a match".to_string());
    }
    if st.lobby_config.gamemode == crate::protocol::Gamemode::ZombieHorde {
        return Err("Bot mates are not used in Zombie Horde".to_string());
    }
    st.lobby_config.bot_count = count;
    st.sync_bot_players();
    Ok(())
}

#[tauri::command]
pub async fn set_name(name: String, state: tauri::State<'_, SharedState>) -> Result<(), String> {
    let cleaned: String = name.trim().chars().take(24).collect();
    if cleaned.is_empty() {
        return Err("Name cannot be empty".to_string());
    }

    let (socket, host_addr, mode, my_id) = {
        let mut st = state.lock().await;
        if st.mode == SessionMode::Host {
            let my_id = st.my_id;
            if let Some(player) = st.world.players.get_mut(&my_id) {
                player.name = cleaned.clone();
            }
        }
        (st.socket.clone(), st.host_addr, st.mode.clone(), st.my_id)
    };

    if mode == SessionMode::Client {
        if let (Some(socket), Some(host_addr)) = (socket, host_addr) {
            let bytes = encode_client(&ClientMessage::SetName { name: cleaned })?;
            socket
                .send_to(&bytes, host_addr)
                .await
                .map_err(|error| error.to_string())?;
        }
    } else if mode == SessionMode::Host {
        let _ = my_id;
    }

    Ok(())
}

#[tauri::command]
pub async fn update_lobby_config(
    config: LobbyConfig,
    state: tauri::State<'_, SharedState>,
) -> Result<(), String> {
    let mut st = state.lock().await;
    if st.mode != SessionMode::Host {
        return Err("Only the host can change lobby settings".to_string());
    }
    let mut config = config;
    config.server_name = clean_server_name(Some(config.server_name));
    if config.gamemode == crate::protocol::Gamemode::ZombieHorde {
        config.bot_count = 0;
        config.friendly_fire = false;
    }
    let map_id = config.map_id.clone();
    st.lobby_config = config;
    st.sync_bot_players();
    if !st.match_started {
        st.world.set_map(&map_id);
        st.world.reposition_players_to_spawns();
    }
    Ok(())
}

#[tauri::command]
pub async fn return_to_lobby(
    window: tauri::Window,
    state: tauri::State<'_, SharedState>,
) -> Result<(), String> {
    let (socket, peers, lobby) = {
        let mut st = state.lock().await;
        if st.mode != SessionMode::Host {
            return Err("Only the host can return to the lobby".to_string());
        }
        if !st.match_started {
            return Err("No match is in progress".to_string());
        }
        st.match_started = false;
        st.match_paused = false;
        st.match_end_emitted = false;
        st.ready_players.clear();
        st.world.reset_for_lobby();
        (st.socket.clone(), st.peers.clone(), st.lobby_snapshot())
    };

    if let Some(socket) = socket {
        let bytes = encode_server(&ServerMessage::Lobby(lobby.clone()))?;
        for peer in peers {
            let _ = socket.send_to(&bytes, peer.addr).await;
        }
    }

    let _ = window.emit("lobby", lobby);
    Ok(())
}

#[tauri::command]
pub async fn rematch(
    window: tauri::Window,
    state: tauri::State<'_, SharedState>,
) -> Result<(), String> {
    let (socket, peers, snapshot) = {
        let mut st = state.lock().await;
        if st.mode != SessionMode::Host {
            return Err("Only the host can start a rematch".to_string());
        }
        if !st.match_started {
            return Err("No match is in progress".to_string());
        }
        if !st.world.match_ended {
            return Err("Match has not ended yet".to_string());
        }
        let config = st.lobby_config.clone();
        validate_match_config(&config)?;
        st.match_end_emitted = false;
        st.match_paused = false;
        let map_id = config.map_id.clone();
        st.world.set_map(&map_id);
        st.world.reset_for_match(
            config.score_limit,
            config.time_limit_secs,
            config.win_condition,
            config.gamemode,
            config.friendly_fire,
            config.fog_of_war,
            config.wave_goal,
        );
        (st.socket.clone(), st.peers.clone(), st.world.snapshot())
    };

    if let Some(socket) = socket {
        let bytes = encode_server(&ServerMessage::MatchStarted(snapshot.clone()))?;
        for peer in peers {
            let _ = socket.send_to(&bytes, peer.addr).await;
        }
    }

    let _ = window.emit("match_started", snapshot.clone());
    let _ = window.emit("state", snapshot);
    Ok(())
}

#[tauri::command]
pub async fn set_match_paused(
    paused: bool,
    state: tauri::State<'_, SharedState>,
) -> Result<(), String> {
    let mut st = state.lock().await;
    if st.mode != SessionMode::Host {
        return Err("Only the host can pause the match".to_string());
    }
    if !st.match_started || st.world.match_ended {
        return Ok(());
    }
    st.match_paused = paused;
    Ok(())
}

#[tauri::command]
pub async fn send_input(
    input: InputSnapshot,
    state: tauri::State<'_, SharedState>,
) -> Result<(), String> {
    let (socket, host_addr) = {
        let mut st = state.lock().await;
        match st.mode {
            SessionMode::Host => {
                let my_id = st.my_id;
                st.world.set_input(my_id, input);
                return Ok(());
            }
            SessionMode::Client => (st.socket.clone(), st.host_addr),
            SessionMode::Idle => return Ok(()),
        }
    };

    if let (Some(socket), Some(host_addr)) = (socket, host_addr) {
        let bytes = input_message(input)?;
        socket
            .send_to(&bytes, host_addr)
            .await
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

async fn wait_for_assignment(
    socket: &UdpSocket,
    host_addr: &std::net::SocketAddr,
    join_bytes: &[u8],
) -> Result<ServerMessage, String> {
    let deadline = Instant::now() + Duration::from_secs(8);
    let mut buf = [0u8; 8192];
    let mut last_send = Instant::now() - Duration::from_secs(1);

    while Instant::now() < deadline {
        if last_send.elapsed() >= Duration::from_millis(500) {
            socket
                .send_to(join_bytes, host_addr)
                .await
                .map_err(|error| error.to_string())?;
            last_send = Instant::now();
        }

        let remaining = deadline.saturating_duration_since(Instant::now());
        let recv_timeout = remaining.min(Duration::from_millis(250));
        match tokio::time::timeout(recv_timeout, socket.recv_from(&mut buf)).await {
            Ok(Ok((n, _))) => match decode_server(&buf[..n]) {
                Ok(message @ ServerMessage::Assigned { .. })
                | Ok(message @ ServerMessage::Error { .. }) => return Ok(message),
                Ok(_) | Err(_) => {}
            },
            Ok(Err(error)) => return Err(error.to_string()),
            Err(_) => {}
        }
    }

    Err(
        "Did not receive ID from host. Check the IP, Windows firewall, and that both players are on the same WiFi."
            .to_string(),
    )
}

fn clean_player_name(name: Option<String>) -> Option<String> {
    let name = name?.trim().to_string();
    if name.is_empty() {
        None
    } else {
        Some(name.chars().take(24).collect())
    }
}

fn clean_server_name(server_name: Option<String>) -> String {
    let name = server_name
        .unwrap_or_else(|| "LAN Game".to_string())
        .trim()
        .chars()
        .take(32)
        .collect::<String>();
    if name.is_empty() {
        "LAN Game".to_string()
    } else {
        name
    }
}

fn clean_character_id(character_id: Option<String>) -> String {
    match character_id.as_deref() {
        Some("bailey") => "bailey",
        Some("jacob") => "jacob",
        Some("isaak") => "isaak",
        Some("taj") => "taj",
        Some("finn") | Some("cheeky_dinghy") => "finn",
        Some("luca") => "luca",
        Some("sifan") => "sifan",
        Some("connor") => "connor",
        Some("archie") => "archie",
        Some("arthur") => "arthur",
        Some("oscar") => "oscar",
        Some("vlad") => "vlad",
        _ => "sonny",
    }
    .to_string()
}

fn clean_weapon_id(weapon_id: Option<String>) -> String {
    let id = weapon_id
        .unwrap_or_else(|| weapons::DEFAULT_WEAPON_ID.to_string())
        .trim()
        .to_ascii_lowercase();
    weapons::validate_weapon_id(&id)
}
