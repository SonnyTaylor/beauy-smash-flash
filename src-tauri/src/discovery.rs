use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::net::UdpSocket;
use tokio::time::MissedTickBehavior;

use crate::net::{decode_discovery, encode_discovery, DISCOVERY_PORT, GAME_PORT};
use crate::network::{best_local_ipv4, bind_discovery_socket, discovery_targets};
use crate::protocol::{DiscoveryMessage, ServerInfo, PROTOCOL_VERSION};
use crate::session::{SessionMode, SharedState};
use crate::version::APP_VERSION;

const BEACON_INTERVAL: Duration = Duration::from_secs(1);

pub async fn discovery_loop(state: SharedState) {
    let Ok(socket) = bind_discovery_socket(DISCOVERY_PORT, true).await else {
        return;
    };
    let socket = Arc::new(socket);
    let mut buf = [0u8; 2048];
    let mut beacon_tick = tokio::time::interval(BEACON_INTERVAL);
    beacon_tick.set_missed_tick_behavior(MissedTickBehavior::Delay);

    loop {
        tokio::select! {
            _ = beacon_tick.tick() => {
                if let Some(info) = host_beacon_info(&state).await {
                    send_host_beacon(&socket, &info).await;
                }
            }
            result = socket.recv_from(&mut buf) => {
                let Ok((n, addr)) = result else {
                    continue;
                };
                let Ok(DiscoveryMessage::Query { .. }) = decode_discovery(&buf[..n]) else {
                    continue;
                };

                let Some(info) = host_beacon_info(&state).await else {
                    continue;
                };
                if let Ok(bytes) = encode_discovery(&DiscoveryMessage::Host(info)) {
                    let _ = socket.send_to(&bytes, addr).await;
                }
            }
        }
    }
}

pub async fn scan_servers(timeout_ms: u64) -> Result<Vec<ServerInfo>, String> {
    let socket = bind_discovery_socket(0, true).await?;
    let local_ip = best_local_ipv4();
    let query = encode_discovery(&DiscoveryMessage::Query {
        version: PROTOCOL_VERSION,
    })?;
    let targets = discovery_targets(local_ip);

    let deadline = Instant::now() + Duration::from_millis(timeout_ms.clamp(500, 3000));
    let mut buf = [0u8; 2048];
    let mut servers = HashMap::<String, ServerInfo>::new();
    let mut last_query = Instant::now() - Duration::from_secs(1);

    while Instant::now() < deadline {
        if last_query.elapsed() >= Duration::from_millis(350) {
            for target in &targets {
                let _ = socket.send_to(&query, target).await;
            }
            last_query = Instant::now();
        }

        let remaining = deadline.saturating_duration_since(Instant::now());
        let recv_timeout = remaining.min(Duration::from_millis(200));
        let result = tokio::time::timeout(recv_timeout, socket.recv_from(&mut buf)).await;
        let Ok(Ok((n, addr))) = result else {
            continue;
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

async fn host_beacon_info(state: &SharedState) -> Option<ServerInfo> {
    let st = state.lock().await;
    if st.mode != SessionMode::Host {
        return None;
    }

    let address = best_local_ipv4()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|| "127.0.0.1".to_string());

    Some(ServerInfo {
        name: crate::names::display_server_name(&st.lobby_config.server_name).to_string(),
        address,
        game_port: GAME_PORT,
        player_count: st.world.players.len(),
        max_players: st.lobby_config.max_players as usize,
        version: PROTOCOL_VERSION,
        app_version: APP_VERSION.to_string(),
    })
}

async fn send_host_beacon(socket: &UdpSocket, info: &ServerInfo) {
    let Ok(bytes) = encode_discovery(&DiscoveryMessage::Host(info.clone())) else {
        return;
    };

    let local_ip = info.address.parse::<IpAddr>().ok().and_then(|ip| match ip {
        IpAddr::V4(v4) => Some(v4),
        _ => None,
    });

    for target in discovery_targets(local_ip) {
        let _ = socket.send_to(&bytes, target).await;
    }
}
