use serde::{Deserialize, Serialize};

pub const PROTOCOL_VERSION: u16 = 1;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorldConfig {
    pub width: f32,
    pub height: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RectSnapshot {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MapSnapshot {
    pub id: String,
    pub name: String,
    pub walls: Vec<RectSnapshot>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct InputSnapshot {
    #[serde(default)]
    pub seq: u32,
    #[serde(default)]
    pub dx: f32,
    #[serde(default)]
    pub dy: f32,
    #[serde(default)]
    pub aim_x: f32,
    #[serde(default)]
    pub aim_y: f32,
    #[serde(default)]
    pub fire: bool,
    #[serde(default)]
    pub reload: bool,
    #[serde(default)]
    pub ability: bool,
    #[serde(default)]
    pub dash: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PlayerSnapshot {
    pub id: u8,
    pub x: f32,
    pub y: f32,
    pub angle: f32,
    pub color: [u8; 3],
    pub name: String,
    pub character_id: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StateSnapshot {
    pub version: u16,
    pub tick: u64,
    pub world: WorldConfig,
    pub map: MapSnapshot,
    pub players: Vec<PlayerSnapshot>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "data", rename_all = "snake_case")]
pub enum ClientMessage {
    Join { name: String, character_id: String },
    Input(InputSnapshot),
    Leave,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "data", rename_all = "snake_case")]
pub enum ServerMessage {
    Assigned {
        id: u8,
        world: WorldConfig,
        map: MapSnapshot,
        players: Vec<PlayerSnapshot>,
    },
    State(StateSnapshot),
    Error {
        message: String,
    },
}

#[derive(Clone, Debug, Serialize)]
pub struct SessionInfo {
    pub player_id: u8,
    pub world: WorldConfig,
}
