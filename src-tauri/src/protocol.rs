use serde::{Deserialize, Serialize};

pub const PROTOCOL_VERSION: u16 = 15;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ServerInfo {
    pub name: String,
    pub address: String,
    pub game_port: u16,
    pub player_count: usize,
    pub max_players: usize,
    /// LAN wire protocol version — must match between host and clients.
    pub version: u16,
    #[serde(default)]
    pub app_version: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LobbyPlayerSnapshot {
    pub id: u8,
    pub name: String,
    pub character_id: String,
    #[serde(default = "default_primary_weapon_id")]
    pub primary_weapon_id: String,
    pub ready: bool,
    pub is_host: bool,
    #[serde(default)]
    pub is_bot: bool,
    /// 0 = unassigned, 1 = Alpha, 2 = Bravo (team deathmatch).
    #[serde(default)]
    pub team: u8,
}

fn default_primary_weapon_id() -> String {
    "glock".to_string()
}

#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Gamemode {
    #[default]
    Deathmatch,
    TeamDeathmatch,
    LastMateStanding,
    ZombieHorde,
}

#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WaveState {
    #[default]
    Intermission,
    Active,
}

#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WinCondition {
    #[default]
    Kills,
    Time,
    Either,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MatchEndReason {
    Score,
    Time,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct LobbyConfig {
    pub server_name: String,
    pub map_id: String,
    pub gamemode: Gamemode,
    pub max_players: u8,
    pub score_limit: u16,
    pub time_limit_secs: u16,
    pub win_condition: WinCondition,
    pub friendly_fire: bool,
    #[serde(default)]
    pub fog_of_war: bool,
    #[serde(default)]
    pub bot_count: u8,
    #[serde(default)]
    pub wave_goal: u16,
}

impl Default for LobbyConfig {
    fn default() -> Self {
        Self {
            server_name: "LAN Game".to_string(),
            map_id: "split".to_string(),
            gamemode: Gamemode::Deathmatch,
            max_players: 8,
            score_limit: 20,
            time_limit_secs: 300,
            win_condition: WinCondition::Kills,
            friendly_fire: true,
            fog_of_war: false,
            bot_count: 0,
            wave_goal: 0,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LobbySnapshot {
    pub players: Vec<LobbyPlayerSnapshot>,
    pub max_players: usize,
    pub match_started: bool,
    pub network_note: String,
    pub config: LobbyConfig,
}

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
    #[serde(default)]
    pub switch_weapon: bool,
    #[serde(default)]
    pub drop_weapon: bool,
    #[serde(default)]
    pub interact: bool,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EffectKind {
    Explosion,
    AimReticle,
    Hack,
    TruthNuke,
    TruthExplosion,
    Splat,
    Mark,
    Poison,
    Zap,
    Slash,
    WallHit,
    DirectorsCut,
    ChiBeam,
    ChiChannel,
    ReelShield,
    ReelPost,
    BoatSplash,
    MaliceZone,
    FoodTray,
    OilSlick,
    Overthink,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorldEffectSnapshot {
    pub id: u32,
    pub kind: EffectKind,
    pub x: f32,
    pub y: f32,
    pub radius: f32,
    pub life: f32,
    pub owner_id: u8,
    #[serde(default)]
    pub origin_x: f32,
    #[serde(default)]
    pub origin_y: f32,
    #[serde(default)]
    pub target_x: f32,
    #[serde(default)]
    pub target_y: f32,
    #[serde(default)]
    pub max_life: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WeaponSlotSnapshot {
    pub weapon_id: String,
    pub ammo: u8,
    pub max_ammo: u8,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WeaponPickupSnapshot {
    pub id: u32,
    pub weapon_id: String,
    pub x: f32,
    pub y: f32,
    pub ammo: u8,
    pub max_ammo: u8,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BulletSnapshot {
    pub id: u32,
    pub owner_id: u8,
    pub x: f32,
    pub y: f32,
    #[serde(default = "default_weapon_id")]
    pub weapon_id: String,
}

fn default_weapon_id() -> String {
    "glock".to_string()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct KillFeedEntry {
    pub killer_id: u8,
    pub killer_name: String,
    pub victim_id: u8,
    pub victim_name: String,
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
    #[serde(default)]
    pub pending_character_id: Option<String>,
    pub hp: u16,
    pub max_hp: u16,
    pub ammo: u8,
    pub max_ammo: u8,
    pub score: u16,
    pub kills: u16,
    pub deaths: u16,
    pub alive: bool,
    pub reloading: bool,
    #[serde(default)]
    pub reload_remaining: f32,
    pub spawn_protected: bool,
    pub respawn_in: f32,
    #[serde(default)]
    pub ability_charge: f32,
    #[serde(default)]
    pub ability_windup: f32,
    #[serde(default)]
    pub ability_aim_x: f32,
    #[serde(default)]
    pub ability_aim_y: f32,
    #[serde(default)]
    pub hacked_remaining: f32,
    #[serde(default)]
    pub slowed_remaining: f32,
    #[serde(default)]
    pub marked_remaining: f32,
    #[serde(default)]
    pub directors_cut_remaining: f32,
    #[serde(default)]
    pub directors_cut_shots: u8,
    #[serde(default)]
    pub poison_remaining: f32,
    #[serde(default)]
    pub stillness_stacks: u8,
    #[serde(default)]
    pub reel_shield_remaining: f32,
    #[serde(default)]
    pub boat_mode_remaining: f32,
    #[serde(default)]
    pub hangover_remaining: f32,
    #[serde(default)]
    pub reel_index: u8,
    #[serde(default = "default_weapon_id")]
    pub active_weapon: String,
    #[serde(default)]
    pub active_slot: u8,
    #[serde(default)]
    pub reload_duration: f32,
    #[serde(default)]
    pub primary_weapon: Option<WeaponSlotSnapshot>,
    #[serde(default)]
    pub secondary_weapon: Option<WeaponSlotSnapshot>,
    #[serde(default)]
    pub is_bot: bool,
    #[serde(default)]
    pub is_zombie: bool,
    #[serde(default)]
    pub kart_mode_remaining: f32,
    #[serde(default)]
    pub steroid_buff_remaining: f32,
    #[serde(default)]
    pub follower_drone_count: u8,
    #[serde(default)]
    pub team: u8,
    #[serde(default)]
    pub rooted_remaining: f32,
    #[serde(default)]
    pub blur_remaining: f32,
    #[serde(default)]
    pub feast_remaining: f32,
    #[serde(default)]
    pub off_the_meds_remaining: f32,
    #[serde(default)]
    pub ragebait_remaining: f32,
    #[serde(default)]
    pub liquid_courage_remaining: f32,
    #[serde(default)]
    pub invulnerable_remaining: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DroneSnapshot {
    pub id: u32,
    pub owner_id: u8,
    pub x: f32,
    pub y: f32,
    pub hp: u16,
    #[serde(default)]
    pub kind: u8,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StateSnapshot {
    pub version: u16,
    pub tick: u64,
    pub world: WorldConfig,
    pub map: MapSnapshot,
    pub players: Vec<PlayerSnapshot>,
    #[serde(default)]
    pub bullets: Vec<BulletSnapshot>,
    #[serde(default)]
    pub effects: Vec<WorldEffectSnapshot>,
    #[serde(default)]
    pub drones: Vec<DroneSnapshot>,
    #[serde(default)]
    pub kill_feed: Vec<KillFeedEntry>,
    #[serde(default)]
    pub match_ended: bool,
    pub winner_id: Option<u8>,
    #[serde(default)]
    pub score_limit: u16,
    #[serde(default)]
    pub time_limit_secs: u16,
    #[serde(default)]
    pub match_elapsed_secs: f32,
    #[serde(default)]
    pub win_condition: WinCondition,
    pub match_end_reason: Option<MatchEndReason>,
    #[serde(default)]
    pub fog_of_war: bool,
    #[serde(default)]
    pub gamemode: Gamemode,
    #[serde(default)]
    pub weapon_pickups: Vec<WeaponPickupSnapshot>,
    #[serde(default)]
    pub wave: u16,
    #[serde(default)]
    pub zombies_remaining: u16,
    #[serde(default)]
    pub wave_state: WaveState,
    #[serde(default)]
    pub wave_intermission_secs: f32,
    #[serde(default)]
    pub wave_goal: u16,
    #[serde(default)]
    pub winner_team: Option<u8>,
    #[serde(default)]
    pub team_scores: [u16; 2],
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "data", rename_all = "snake_case")]
pub enum ClientMessage {
    Join {
        name: String,
        character_id: String,
        #[serde(default = "default_primary_weapon_id")]
        primary_weapon_id: String,
        #[serde(default)]
        protocol_version: u16,
    },
    SetReady {
        ready: bool,
    },
    SelectCharacter {
        character_id: String,
    },
    UpdateLoadout {
        character_id: String,
        #[serde(default = "default_primary_weapon_id")]
        primary_weapon_id: String,
    },
    SetName {
        name: String,
    },
    UpdateConfig {
        config: LobbyConfig,
    },
    Input(InputSnapshot),
    SetTeam {
        team: u8,
    },
    Leave,
    ArenaReady,
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
    Lobby(LobbySnapshot),
    MatchStarted(StateSnapshot),
    MatchEnded(StateSnapshot),
    Error {
        message: String,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionInfo {
    pub player_id: u8,
    pub world: WorldConfig,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "data", rename_all = "snake_case")]
pub enum DiscoveryMessage {
    Query { version: u16 },
    Host(ServerInfo),
}
