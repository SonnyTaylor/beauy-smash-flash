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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::*;

    /// Helper: build a PlayerSnapshot with sensible defaults for tests.
    fn test_player(id: u8) -> PlayerSnapshot {
        PlayerSnapshot {
            id,
            x: 100.0 + id as f32 * 50.0,
            y: 200.0,
            angle: 0.0,
            color: [255, 0, 0],
            name: format!("Player {id}"),
            character_id: "sonny".into(),
            pending_character_id: None,
            hp: 100,
            max_hp: 100,
            ammo: 12,
            max_ammo: 12,
            score: 0,
            kills: 0,
            deaths: 0,
            alive: true,
            reloading: false,
            reload_remaining: 0.0,
            spawn_protected: false,
            respawn_in: 0.0,
            ability_charge: 0.0,
            ability_windup: 0.0,
            ability_aim_x: 0.0,
            ability_aim_y: 0.0,
            hacked_remaining: 0.0,
            slowed_remaining: 0.0,
            marked_remaining: 0.0,
            directors_cut_remaining: 0.0,
            directors_cut_shots: 0,
            poison_remaining: 0.0,
            stillness_stacks: 0,
            reel_shield_remaining: 0.0,
            boat_mode_remaining: 0.0,
            hangover_remaining: 0.0,
            reel_index: 0,
            active_weapon: "glock".into(),
            active_slot: 0,
            reload_duration: 0.0,
            primary_weapon: None,
            secondary_weapon: None,
            is_bot: false,
            is_zombie: false,
            kart_mode_remaining: 0.0,
            steroid_buff_remaining: 0.0,
            follower_drone_count: 0,
            team: 0,
            rooted_remaining: 0.0,
            blur_remaining: 0.0,
            feast_remaining: 0.0,
            off_the_meds_remaining: 0.0,
            ragebait_remaining: 0.0,
            liquid_courage_remaining: 0.0,
            invulnerable_remaining: 0.0,
        }
    }

    fn test_map() -> MapSnapshot {
        MapSnapshot {
            id: "split".into(),
            name: "Split".into(),
            walls: vec![
                RectSnapshot {
                    x: 0.0,
                    y: 0.0,
                    w: 800.0,
                    h: 10.0,
                },
                RectSnapshot {
                    x: 0.0,
                    y: 590.0,
                    w: 800.0,
                    h: 10.0,
                },
            ],
        }
    }

    // ── ClientMessage round-trips ──────────────────────────────────────

    #[test]
    fn roundtrip_client_join() {
        let msg = ClientMessage::Join {
            name: "Sonny".into(),
            character_id: "sonny".into(),
            primary_weapon_id: "glock".into(),
            protocol_version: PROTOCOL_VERSION,
        };
        let bytes = encode_client(&msg).expect("encode");
        let decoded = decode_client(&bytes).expect("decode");
        match decoded {
            ClientMessage::Join {
                name,
                character_id,
                primary_weapon_id,
                protocol_version,
            } => {
                assert_eq!(name, "Sonny");
                assert_eq!(character_id, "sonny");
                assert_eq!(primary_weapon_id, "glock");
                assert_eq!(protocol_version, PROTOCOL_VERSION);
            }
            other => panic!("expected Join, got {other:?}"),
        }
    }

    #[test]
    fn roundtrip_client_set_ready() {
        let msg = ClientMessage::SetReady { ready: true };
        let bytes = encode_client(&msg).expect("encode");
        let decoded = decode_client(&bytes).expect("decode");
        match decoded {
            ClientMessage::SetReady { ready } => assert!(ready),
            other => panic!("expected SetReady, got {other:?}"),
        }
    }

    #[test]
    fn roundtrip_client_leave() {
        let msg = ClientMessage::Leave;
        let bytes = encode_client(&msg).expect("encode");
        let decoded = decode_client(&bytes).expect("decode");
        assert!(matches!(decoded, ClientMessage::Leave));
    }

    // ── ServerMessage round-trips ──────────────────────────────────────

    #[test]
    fn roundtrip_server_error() {
        let msg = ServerMessage::Error {
            message: "Game is full".into(),
        };
        let bytes = encode_server(&msg).expect("encode");
        let decoded = decode_server(&bytes).expect("decode");
        match decoded {
            ServerMessage::Error { message } => assert_eq!(message, "Game is full"),
            other => panic!("expected Error, got {other:?}"),
        }
    }

    #[test]
    fn roundtrip_server_lobby() {
        let msg = ServerMessage::Lobby(LobbySnapshot {
            players: vec![
                LobbyPlayerSnapshot {
                    id: 0,
                    name: "Host".into(),
                    character_id: "sonny".into(),
                    primary_weapon_id: "glock".into(),
                    ready: true,
                    is_host: true,
                    is_bot: false,
                    team: 0,
                },
                LobbyPlayerSnapshot {
                    id: 1,
                    name: "Guest".into(),
                    character_id: "bailey".into(),
                    primary_weapon_id: "glock".into(),
                    ready: false,
                    is_host: false,
                    is_bot: false,
                    team: 0,
                },
            ],
            max_players: 8,
            match_started: false,
            network_note: String::new(),
            config: LobbyConfig::default(),
        });
        let bytes = encode_server(&msg).expect("encode");
        let decoded = decode_server(&bytes).expect("decode");
        match decoded {
            ServerMessage::Lobby(snap) => {
                assert_eq!(snap.players.len(), 2);
                assert_eq!(snap.players[0].name, "Host");
                assert_eq!(snap.players[1].name, "Guest");
            }
            other => panic!("expected Lobby, got {other:?}"),
        }
    }

    #[test]
    fn roundtrip_server_assigned_with_many_players() {
        // 8 players + a complex map → payload well over 512 bytes.
        let players: Vec<PlayerSnapshot> = (0..8).map(test_player).collect();
        let msg = ServerMessage::Assigned {
            id: 1,
            world: WorldConfig {
                width: 1600.0,
                height: 900.0,
            },
            map: test_map(),
            players,
        };
        let bytes = encode_server(&msg).expect("encode");
        let decoded = decode_server(&bytes).expect("decode");
        match decoded {
            ServerMessage::Assigned {
                id, world, players, ..
            } => {
                assert_eq!(id, 1);
                assert_eq!(world.width, 1600.0);
                assert_eq!(players.len(), 8);
                assert_eq!(players[7].name, "Player 7");
            }
            other => panic!("expected Assigned, got {other:?}"),
        }
    }

    #[test]
    fn roundtrip_server_state() {
        let players: Vec<PlayerSnapshot> = (0..4).map(test_player).collect();
        let msg = ServerMessage::State(StateSnapshot {
            version: PROTOCOL_VERSION,
            tick: 1234,
            world: WorldConfig {
                width: 1600.0,
                height: 900.0,
            },
            map: Some(test_map()),
            players,
            bullets: vec![BulletSnapshot {
                id: 1,
                owner_id: 0,
                x: 10.0,
                y: 20.0,
                weapon_id: "glock".into(),
            }],
            effects: Vec::new(),
            drones: Vec::new(),
            kill_feed: Vec::new(),
            match_ended: false,
            winner_id: None,
            winner_team: None,
            team_scores: [0, 0],
            score_limit: 20,
            time_limit_secs: 300,
            match_elapsed_secs: 12.5,
            win_condition: WinCondition::Kills,
            match_end_reason: None,
            fog_of_war: false,
            gamemode: Gamemode::Deathmatch,
            weapon_pickups: Vec::new(),
            wave: 0,
            zombies_remaining: 0,
            wave_state: WaveState::Intermission,
            wave_intermission_secs: 0.0,
            wave_goal: 0,
        });
        let bytes = encode_server(&msg).expect("encode");
        let decoded = decode_server(&bytes).expect("decode");
        match decoded {
            ServerMessage::State(snap) => {
                assert_eq!(snap.tick, 1234);
                assert_eq!(snap.players.len(), 4);
                assert_eq!(snap.bullets.len(), 1);
                assert!(!snap.match_ended);
            }
            other => panic!("expected State, got {other:?}"),
        }
    }

    #[test]
    fn roundtrip_server_match_started() {
        let players: Vec<PlayerSnapshot> = (0..2).map(test_player).collect();
        let msg = ServerMessage::MatchStarted(StateSnapshot {
            version: PROTOCOL_VERSION,
            tick: 0,
            world: WorldConfig {
                width: 1600.0,
                height: 900.0,
            },
            map: Some(test_map()),
            players,
            bullets: Vec::new(),
            effects: Vec::new(),
            drones: Vec::new(),
            kill_feed: Vec::new(),
            match_ended: false,
            winner_id: None,
            winner_team: None,
            team_scores: [0, 0],
            score_limit: 20,
            time_limit_secs: 300,
            match_elapsed_secs: 0.0,
            win_condition: WinCondition::Kills,
            match_end_reason: None,
            fog_of_war: false,
            gamemode: Gamemode::Deathmatch,
            weapon_pickups: Vec::new(),
            wave: 0,
            zombies_remaining: 0,
            wave_state: WaveState::Intermission,
            wave_intermission_secs: 0.0,
            wave_goal: 0,
        });
        let bytes = encode_server(&msg).expect("encode");
        assert!(bytes.len() > 0);
        let decoded = decode_server(&bytes).expect("decode");
        assert!(matches!(decoded, ServerMessage::MatchStarted(_)));
    }

    // ── Discovery round-trip ───────────────────────────────────────────

    #[test]
    fn roundtrip_discovery_query() {
        let msg = DiscoveryMessage::Query {
            version: PROTOCOL_VERSION,
        };
        let bytes = encode_discovery(&msg).expect("encode");
        let decoded = decode_discovery(&bytes).expect("decode");
        match decoded {
            DiscoveryMessage::Query { version } => assert_eq!(version, PROTOCOL_VERSION),
            other => panic!("expected Query, got {other:?}"),
        }
    }

    #[test]
    fn roundtrip_discovery_host() {
        let msg = DiscoveryMessage::Host(ServerInfo {
            name: "My Server".into(),
            address: "192.168.1.42".into(),
            game_port: GAME_PORT,
            player_count: 2,
            max_players: 8,
            version: PROTOCOL_VERSION,
            app_version: "1.0.11".into(),
        });
        let bytes = encode_discovery(&msg).expect("encode");
        let decoded = decode_discovery(&bytes).expect("decode");
        match decoded {
            DiscoveryMessage::Host(info) => {
                assert_eq!(info.name, "My Server");
                assert_eq!(info.game_port, GAME_PORT);
            }
            other => panic!("expected Host, got {other:?}"),
        }
    }

    // ── Error handling: garbage bytes must return Err, never panic ─────

    #[test]
    fn decode_garbage_client_returns_err() {
        assert!(decode_client(&[0xFF, 0xFE, 0xFD]).is_err());
    }

    #[test]
    fn decode_garbage_server_returns_err() {
        assert!(decode_server(&[0xFF, 0xFE, 0xFD]).is_err());
    }

    #[test]
    fn decode_empty_client_returns_err() {
        assert!(decode_client(&[]).is_err());
    }

    #[test]
    fn decode_empty_server_returns_err() {
        assert!(decode_server(&[]).is_err());
    }
}
