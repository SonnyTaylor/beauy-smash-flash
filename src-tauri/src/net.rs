use crate::protocol::{ClientMessage, DiscoveryMessage, ServerMessage};
use flate2::{read::ZlibDecoder, write::ZlibEncoder, Compression};
use std::io::{Read, Write};

pub const DISCOVERY_PORT: u16 = 5554;
pub const GAME_PORT: u16 = 5555;
pub const SIM_HZ: f32 = 60.0;
pub const BROADCAST_HZ: f32 = 30.0;
pub const MAX_PLAYERS: usize = 12;

const COMPRESS_THRESHOLD: usize = 512;

fn maybe_compress(data: Vec<u8>) -> Result<Vec<u8>, String> {
    if data.len() < COMPRESS_THRESHOLD {
        return Ok(data);
    }
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
    encoder
        .write_all(&data)
        .map_err(|error| error.to_string())?;
    encoder.finish().map_err(|error| error.to_string())
}

fn maybe_decompress(data: &[u8]) -> Result<Vec<u8>, String> {
    let mut decoder = ZlibDecoder::new(data);
    let mut out = Vec::new();
    match decoder.read_to_end(&mut out) {
        Ok(_) if !out.is_empty() => Ok(out),
        _ => Ok(data.to_vec()),
    }
}

pub fn encode_client(message: &ClientMessage) -> Result<Vec<u8>, String> {
    let json = serde_json::to_vec(message).map_err(|error| error.to_string())?;
    maybe_compress(json)
}

pub fn decode_client(bytes: &[u8]) -> Result<ClientMessage, String> {
    let data = maybe_decompress(bytes)?;
    serde_json::from_slice(&data).map_err(|error| error.to_string())
}

pub fn encode_server(message: &ServerMessage) -> Result<Vec<u8>, String> {
    let json = serde_json::to_vec(message).map_err(|error| error.to_string())?;
    maybe_compress(json)
}

pub fn decode_server(bytes: &[u8]) -> Result<ServerMessage, String> {
    let data = maybe_decompress(bytes)?;
    serde_json::from_slice(&data).map_err(|error| error.to_string())
}

pub fn encode_discovery(message: &DiscoveryMessage) -> Result<Vec<u8>, String> {
    serde_json::to_vec(message).map_err(|error| error.to_string())
}

pub fn decode_discovery(bytes: &[u8]) -> Result<DiscoveryMessage, String> {
    serde_json::from_slice(bytes).map_err(|error| error.to_string())
}
