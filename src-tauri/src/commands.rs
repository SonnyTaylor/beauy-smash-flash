use std::sync::Arc;
use std::time::Duration;

use tokio::net::UdpSocket;

use crate::game::GameWorld;
use crate::net::{decode_server, encode_client, GAME_PORT};
use crate::protocol::{ClientMessage, InputSnapshot, ServerMessage, SessionInfo};
use crate::session::{client_loop, game_addr, host_loop, input_message, SessionMode, SharedState};

#[tauri::command]
pub async fn start_host(
    player_name: Option<String>,
    character_id: Option<String>,
    window: tauri::Window,
    state: tauri::State<'_, SharedState>,
) -> Result<SessionInfo, String> {
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
        st.host_addr = None;
        st.my_id = 0;
        st.world = GameWorld::default();
        st.world.add_player(
            0,
            clean_player_name(player_name).unwrap_or_else(|| "Host".to_string()),
            clean_character_id(character_id),
        );
        st.session_info()
    };

    let state_clone = state.inner().clone();
    tokio::spawn(async move {
        host_loop(socket, state_clone, window).await;
    });

    Ok(info)
}

#[tauri::command]
pub async fn join_game(
    ip: String,
    player_name: Option<String>,
    character_id: Option<String>,
    window: tauri::Window,
    state: tauri::State<'_, SharedState>,
) -> Result<SessionInfo, String> {
    let socket = Arc::new(
        UdpSocket::bind("0.0.0.0:0")
            .await
            .map_err(|error| error.to_string())?,
    );
    let host_addr = game_addr(&ip)?;

    let join = ClientMessage::Join {
        name: clean_player_name(player_name).unwrap_or_else(|| "Player".to_string()),
        character_id: clean_character_id(character_id),
    };
    let bytes = encode_client(&join)?;
    socket
        .send_to(&bytes, host_addr)
        .await
        .map_err(|error| error.to_string())?;

    let mut buf = [0u8; 8192];
    let assigned = wait_for_assignment(&socket, &mut buf).await?;

    let (player_id, world) = match assigned {
        ServerMessage::Assigned {
            id,
            world,
            map: _,
            players,
        } => {
            let mut st = state.lock().await;
            st.socket = Some(socket.clone());
            st.mode = SessionMode::Client;
            st.peers.clear();
            st.host_addr = Some(host_addr);
            st.my_id = id;
            st.world = GameWorld::new(world.clone());
            for player in players {
                st.world
                    .add_player(player.id, player.name.clone(), player.character_id.clone());
                if let Some(stored) = st.world.players.get_mut(&player.id) {
                    stored.x = player.x;
                    stored.y = player.y;
                    stored.angle = player.angle;
                    stored.color = player.color;
                }
            }
            (id, world)
        }
        ServerMessage::Error { message } => return Err(message),
        ServerMessage::State(_) => return Err("Expected assignment from host".to_string()),
    };

    let state_clone = state.inner().clone();
    tokio::spawn(async move {
        client_loop(socket, state_clone, window).await;
    });

    Ok(SessionInfo { player_id, world })
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

async fn wait_for_assignment(socket: &UdpSocket, buf: &mut [u8]) -> Result<ServerMessage, String> {
    let timeout = Duration::from_secs(3);
    let (n, _) = tokio::time::timeout(timeout, socket.recv_from(buf))
        .await
        .map_err(|_| "Did not receive ID from host".to_string())?
        .map_err(|error| error.to_string())?;

    decode_server(&buf[..n])
}

fn clean_player_name(name: Option<String>) -> Option<String> {
    let name = name?.trim().to_string();
    if name.is_empty() {
        None
    } else {
        Some(name.chars().take(24).collect())
    }
}

fn clean_character_id(character_id: Option<String>) -> String {
    match character_id.as_deref() {
        Some("bailey") => "bailey",
        Some("jacob") => "jacob",
        Some("isaak") => "isaak",
        Some("taj") => "taj",
        Some("finn") | Some("cheeky_dinghy") => "finn",
        _ => "sonny",
    }
    .to_string()
}
