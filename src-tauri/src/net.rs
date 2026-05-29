use crate::protocol::{ClientMessage, DiscoveryMessage, ServerMessage};

pub const DISCOVERY_PORT: u16 = 5554;
pub const GAME_PORT: u16 = 5555;
pub const SIM_HZ: f32 = 60.0;
pub const BROADCAST_HZ: f32 = 30.0;
pub const MAX_PLAYERS: usize = 12;

pub fn encode_client(message: &ClientMessage) -> Result<Vec<u8>, String> {
    serde_json::to_vec(message).map_err(|error| error.to_string())
}

pub fn decode_client(bytes: &[u8]) -> Result<ClientMessage, String> {
    serde_json::from_slice(bytes).map_err(|error| error.to_string())
}

pub fn encode_server(message: &ServerMessage) -> Result<Vec<u8>, String> {
    serde_json::to_vec(message).map_err(|error| error.to_string())
}

pub fn decode_server(bytes: &[u8]) -> Result<ServerMessage, String> {
    serde_json::from_slice(bytes).map_err(|error| error.to_string())
}

pub fn encode_discovery(message: &DiscoveryMessage) -> Result<Vec<u8>, String> {
    serde_json::to_vec(message).map_err(|error| error.to_string())
}

pub fn decode_discovery(bytes: &[u8]) -> Result<DiscoveryMessage, String> {
    serde_json::from_slice(bytes).map_err(|error| error.to_string())
}
