use std::net::{IpAddr, Ipv4Addr, SocketAddr};

use socket2::{Domain, Protocol, Socket, Type};
use tokio::net::UdpSocket;

use crate::net::DISCOVERY_PORT;

pub const MCAST_GROUP: Ipv4Addr = Ipv4Addr::new(239, 255, 255, 250);

pub fn best_local_ipv4() -> Option<Ipv4Addr> {
    let mut candidates = Vec::new();

    if let Ok(interfaces) = if_addrs::get_if_addrs() {
        for iface in interfaces {
            if iface.is_loopback() {
                continue;
            }
            let IpAddr::V4(ip) = iface.ip() else {
                continue;
            };
            if is_bad_ip(&ip) {
                continue;
            }
            candidates.push((adapter_score(&iface.name), ip));
        }
    }

    if candidates.is_empty() {
        for candidate in fallback_route_ips() {
            if let Some(ip) = local_ip_via_route(candidate) {
                if !is_bad_ip(&ip) {
                    candidates.push((0, ip));
                }
            }
        }
    }

    candidates.sort_by(|(score_a, ip_a), (score_b, ip_b)| {
        score_b
            .cmp(score_a)
            .then_with(|| ip_a.octets().cmp(&ip_b.octets()))
    });
    candidates.first().map(|(_, ip)| *ip)
}

pub fn discovery_targets(local_ip: Option<Ipv4Addr>) -> Vec<SocketAddr> {
    let mut targets = vec![SocketAddr::new(
        IpAddr::V4(Ipv4Addr::BROADCAST),
        DISCOVERY_PORT,
    )];

    if let Some(ip) = local_ip {
        let octets = ip.octets();
        if let Ok(subnet) = format!(
            "{}.{}.{}.255:{DISCOVERY_PORT}",
            octets[0], octets[1], octets[2]
        )
        .parse::<SocketAddr>()
        {
            targets.push(subnet);
        }
    }

    targets.push(SocketAddr::new(IpAddr::V4(MCAST_GROUP), DISCOVERY_PORT));
    targets
}

pub async fn bind_discovery_socket(
    bind_port: u16,
    join_multicast: bool,
) -> Result<UdpSocket, String> {
    let socket = Socket::new(Domain::IPV4, Type::DGRAM, Some(Protocol::UDP))
        .map_err(|error| error.to_string())?;
    socket
        .set_reuse_address(true)
        .map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        let _ = socket.set_reuse_port(true);
    }
    socket
        .bind(&SocketAddr::from(([0, 0, 0, 0], bind_port)).into())
        .map_err(|error| error.to_string())?;
    socket
        .set_broadcast(true)
        .map_err(|error| error.to_string())?;

    if join_multicast {
        let _ = socket.join_multicast_v4(&MCAST_GROUP, &Ipv4Addr::UNSPECIFIED);
    }

    socket
        .set_nonblocking(true)
        .map_err(|error| error.to_string())?;
    UdpSocket::from_std(socket.into()).map_err(|error| error.to_string())
}

fn adapter_score(name: &str) -> i32 {
    let name = name.to_ascii_lowercase();
    if name.contains("wi-fi") || name.contains("wifi") || name.contains("wireless") {
        return 10;
    }
    if name.contains("ethernet") {
        return 8;
    }
    if name.contains("local area connection") {
        return 6;
    }
    if name.contains("tailscale")
        || name.contains("wireguard")
        || name.contains("tun")
        || name.contains("tap")
        || name.contains("vpn")
        || name.contains("virtual")
        || name.contains("vmware")
        || name.contains("hyper-v")
        || name.contains("wsl")
    {
        return -5;
    }
    0
}

fn is_bad_ip(ip: &Ipv4Addr) -> bool {
    if ip.is_loopback() {
        return true;
    }
    let octets = ip.octets();
    if octets[0] == 169 && octets[1] == 254 {
        return true;
    }
    if octets[0] == 100 && (64..=127).contains(&octets[1]) {
        return true;
    }
    if octets[0..3] == [192, 168, 56] {
        return true;
    }
    if octets[0..3] == [192, 168, 183] || octets[0..3] == [192, 168, 159] {
        return true;
    }
    false
}

fn fallback_route_ips() -> [&'static str; 5] {
    [
        "8.8.8.8:80",
        "192.168.1.1:80",
        "10.0.0.1:80",
        "172.16.0.1:80",
        "1.1.1.1:80",
    ]
}

fn local_ip_via_route(candidate: &str) -> Option<Ipv4Addr> {
    let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect(candidate).ok()?;
    match socket.local_addr().ok()?.ip() {
        IpAddr::V4(ip) if !ip.is_unspecified() => Some(ip),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn discovery_targets_include_broadcast_subnet_and_multicast() {
        let targets = discovery_targets(Some(Ipv4Addr::new(192, 168, 4, 22)));
        assert!(targets
            .iter()
            .any(|addr| addr.ip() == IpAddr::V4(Ipv4Addr::BROADCAST)));
        assert!(targets
            .iter()
            .any(|addr| addr.ip() == IpAddr::V4(Ipv4Addr::new(192, 168, 4, 255))));
        assert!(targets
            .iter()
            .any(|addr| addr.ip() == IpAddr::V4(MCAST_GROUP)));
    }

    #[test]
    fn filters_virtual_and_loopback_ips() {
        assert!(is_bad_ip(&Ipv4Addr::LOCALHOST));
        assert!(is_bad_ip(&Ipv4Addr::new(100, 64, 0, 1)));
        assert!(is_bad_ip(&Ipv4Addr::new(169, 254, 1, 1)));
        assert!(!is_bad_ip(&Ipv4Addr::new(10, 12, 44, 8)));
    }
}
