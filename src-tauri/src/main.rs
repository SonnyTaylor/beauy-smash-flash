#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::net::UdpSocket;
use tokio::sync::Mutex;
use tauri::Emitter;

#[derive(Clone, serde::Serialize, serde::Deserialize)]
struct Player {
    id: u8,
    x: f32,
    y: f32,
    c: [u8; 3],
}

#[derive(Default)]
struct AppState {
    socket: Option<Arc<UdpSocket>>,
    is_host: bool,
    players: HashMap<u8, Player>,
    addrs: Vec<SocketAddr>,
    my_id: u8,
    host_addr: Option<SocketAddr>,
}

const PALETTE: [[u8; 3]; 8] = [
    [59, 130, 246],
    [239, 68, 68],
    [34, 197, 94],
    [234, 179, 8],
    [168, 85, 247],
    [236, 72, 153],
    [6, 182, 212],
    [249, 115, 22],
];

#[tauri::command]
async fn start_host(
    window: tauri::Window,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<u8, String> {
    let socket = Arc::new(UdpSocket::bind("0.0.0.0:7878").await.map_err(|e: std::io::Error| e.to_string())?);
    let mut st = state.lock().await;
    st.socket = Some(socket.clone());
    st.is_host = true;
    st.my_id = 0;
    st.players.insert(
        0,
        Player {
            id: 0,
            x: 400.0,
            y: 300.0,
            c: PALETTE[0],
        },
    );

    let state_clone = Arc::clone(&*state);
    tokio::spawn(async move {
        host_loop(socket, state_clone, window).await;
    });
    Ok(0)
}

#[tauri::command]
async fn join_game(
    ip: String,
    window: tauri::Window,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<u8, String> {
    let socket = Arc::new(UdpSocket::bind("0.0.0.0:0").await.map_err(|e: std::io::Error| e.to_string())?);
    let host_addr: SocketAddr = format!("{}:7878", ip)
        .parse()
        .map_err(|e: std::net::AddrParseError| e.to_string())?;

    let join_msg = serde_json::json!({"Join": true});
    let join_bytes = serde_json::to_vec(&join_msg).unwrap();
    socket
        .send_to(&join_bytes, host_addr)
        .await
        .map_err(|e: std::io::Error| e.to_string())?;

    let mut buf = [0u8; 1024];
    let deadline = tokio::time::Instant::now() + Duration::from_secs(3);
    let mut my_id = None;

    while tokio::time::Instant::now() < deadline {
        let timeout = deadline - tokio::time::Instant::now();
        let (n, _) = match tokio::time::timeout(timeout, socket.recv_from(&mut buf)).await {
            Ok(Ok(v)) => v,
            Ok(Err(e)) => return Err(e.to_string()),
            Err(_) => break,
        };
        if let Ok(msg) = serde_json::from_slice::<serde_json::Value>(&buf[..n]) {
            if let Some(id) = msg.get("Id").and_then(|v| v.as_u64()) {
                my_id = Some(id as u8);
                break;
            }
        }
    }

    let my_id = my_id.ok_or("Did not receive ID from host")?;

    let mut st = state.lock().await;
    st.socket = Some(socket.clone());
    st.is_host = false;
    st.my_id = my_id;
    st.host_addr = Some(host_addr);

    let state_clone = Arc::clone(&*state);
    tokio::spawn(async move {
        client_loop(socket, state_clone, window).await;
    });
    Ok(my_id)
}

#[tauri::command]
async fn send_input(
    dx: f32,
    dy: f32,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<(), String> {
    let st = state.lock().await;
    let is_host = st.is_host;
    let my_id = st.my_id;
    if let Some(socket) = &st.socket {
        if is_host {
            drop(st);
            let mut st = state.lock().await;
            if let Some(p) = st.players.get_mut(&my_id) {
                p.x = (p.x + dx * 5.0).clamp(16.0, 784.0);
                p.y = (p.y + dy * 5.0).clamp(16.0, 584.0);
            }
        } else if let Some(addr) = st.host_addr {
            let msg = serde_json::json!({"Input": [dx, dy]});
            let bytes = serde_json::to_vec(&msg).unwrap();
            let _ = socket.send_to(&bytes, addr).await.map_err(|e: std::io::Error| e.to_string())?;
        }
    }
    Ok(())
}

async fn host_loop(socket: Arc<UdpSocket>, state: Arc<Mutex<AppState>>, window: tauri::Window) {
    let mut buf = [0u8; 1024];
    let mut tick = tokio::time::interval(Duration::from_millis(33));

    loop {
        tokio::select! {
            _ = tick.tick() => {
                let st = state.lock().await;
                let players: Vec<Player> = st.players.values().cloned().collect();
                let msg = serde_json::json!({"State": players});
                let bytes = serde_json::to_vec(&msg).unwrap();
                for addr in &st.addrs {
                    let _ = socket.send_to(&bytes, addr).await;
                }
                let _ = window.emit("state", &players);
            }
            result = socket.recv_from(&mut buf) => {
                if let Ok((n, addr)) = result {
                    if let Ok(msg) = serde_json::from_slice::<serde_json::Value>(&buf[..n]) {
                        let mut st = state.lock().await;
                        if msg.get("Join").and_then(|v| v.as_bool()).unwrap_or(false) {
                            let id = if let Some(idx) = st.addrs.iter().position(|a| a == &addr) {
                                (idx + 1) as u8
                            } else {
                                let id = st.addrs.len() as u8 + 1;
                                st.addrs.push(addr);
                                st.players.insert(id, Player {
                                    id,
                                    x: 400.0,
                                    y: 300.0,
                                    c: PALETTE[id as usize % PALETTE.len()],
                                });
                                id
                            };
                            let resp = serde_json::json!({"Id": id, "Color": PALETTE[id as usize % PALETTE.len()]});
                            let _ = socket.send_to(&serde_json::to_vec(&resp).unwrap(), addr).await;
                        } else if let Some(input) = msg.get("Input") {
                            if let Some(arr) = input.as_array() {
                                let dx = arr.get(0).and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
                                let dy = arr.get(1).and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
                                if let Some(idx) = st.addrs.iter().position(|a| a == &addr) {
                                    let pid = (idx + 1) as u8;
                                    if let Some(p) = st.players.get_mut(&pid) {
                                        p.x = (p.x + dx * 5.0).clamp(16.0, 784.0);
                                        p.y = (p.y + dy * 5.0).clamp(16.0, 584.0);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

async fn client_loop(socket: Arc<UdpSocket>, state: Arc<Mutex<AppState>>, window: tauri::Window) {
    let mut buf = [0u8; 4096];
    loop {
        if let Ok((n, _)) = socket.recv_from(&mut buf).await {
            if let Ok(msg) = serde_json::from_slice::<serde_json::Value>(&buf[..n]) {
                if let Some(state_arr) = msg.get("State") {
                    if let Ok(players) = serde_json::from_value::<Vec<Player>>(state_arr.clone()) {
                        let mut st = state.lock().await;
                        for p in &players {
                            st.players.insert(p.id, p.clone());
                        }
                        let _ = window.emit("state", players);
                    }
                }
            }
        }
    }
}

fn main() {
    tauri::Builder::default()
        .manage(Arc::new(Mutex::new(AppState::default())))
        .invoke_handler(tauri::generate_handler![start_host, join_game, send_input])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
