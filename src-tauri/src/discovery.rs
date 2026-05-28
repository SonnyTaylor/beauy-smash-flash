use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::net::UdpSocket;

use crate::net::{decode_discovery, encode_discovery, DISCOVERY_PORT, GAME_PORT, MAX_PLAYERS};
use crate::protocol::{DiscoveryMessage, ServerInfo, PROTOCOL_VERSION};
use crate::session::{SessionMode, SharedState};

pub async fn discovery_loop(state: SharedState) {
    let Ok(socket) = UdpSocket::bind(format!("0.0.0.0:{DISCOVERY_PORT}")).await else {
        return;
    };
    let socket = Arc::new(socket);
    let mut buf = [0u8; 2048];

    loop {
        let Ok((n, addr)) = socket.recv_from(&mut buf).await else {
            continue;
        };
        let Ok(DiscoveryMessage::Query { version }) = decode_discovery(&buf[..n]) else {
            continue;
        };
        if version != PROTOCOL_VERSION {
            continue;
        }

        let Some(info) = server_info(&state, addr.ip()).await else {
            continue;
        };
        if let Ok(bytes) = encode_discovery(&DiscoveryMessage::Host(info)) {
            let _ = socket.send_to(&bytes, addr).await;
        }
    }
}

pub async fn scan_servers(timeout_ms: u64) -> Result<Vec<ServerInfo>, String> {
    let socket = UdpSocket::bind("0.0.0.0:0")
        .await
        .map_err(|error| error.to_string())?;
    socket
        .set_broadcast(true)
        .map_err(|error| error.to_string())?;

    let query = encode_discovery(&DiscoveryMessage::Query {
        version: PROTOCOL_VERSION,
    })?;
    let broadcast_addr: SocketAddr = format!("255.255.255.255:{DISCOVERY_PORT}")
        .parse()
        .map_err(|error: std::net::AddrParseError| error.to_string())?;
    let _ = socket.send_to(&query, broadcast_addr).await;

    let deadline = Instant::now() + Duration::from_millis(timeout_ms.clamp(300, 2500));
    let mut buf = [0u8; 2048];
    let mut servers = HashMap::<String, ServerInfo>::new();

    while Instant::now() < deadline {
        let remaining = deadline.saturating_duration_since(Instant::now());
        let result = tokio::time::timeout(remaining, socket.recv_from(&mut buf)).await;
        let Ok(Ok((n, addr))) = result else {
            break;
        };

        if let Ok(DiscoveryMessage::Host(mut info)) = decode_discovery(&buf[..n]) {
            info.address = addr.ip().to_string();
            servers.insert(format!("{}:{}", info.address, info.game_port), info);
        }
    }

    let mut servers: Vec<_> = servers.into_values().collect();
    servers.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(servers)
}

async fn server_info(state: &SharedState, requester_ip: IpAddr) -> Option<ServerInfo> {
    let st = state.lock().await;
    if st.mode != SessionMode::Host {
        return None;
    }

    Some(ServerInfo {
        name: "Beauy Smash Flash Host".to_string(),
        address: requester_ip.to_string(),
        game_port: GAME_PORT,
        player_count: st.world.players.len(),
        max_players: MAX_PLAYERS,
        version: PROTOCOL_VERSION,
    })
}
