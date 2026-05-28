use std::collections::HashMap;

use crate::protocol::{
    InputSnapshot, PlayerSnapshot, StateSnapshot, WorldConfig, PROTOCOL_VERSION,
};

pub const DEFAULT_WORLD_WIDTH: f32 = 1920.0;
pub const DEFAULT_WORLD_HEIGHT: f32 = 1080.0;
pub const PLAYER_RADIUS: f32 = 24.0;
pub const PLAYER_SPEED: f32 = 360.0;

const PALETTE: [[u8; 3]; 8] = [
    [0, 255, 255],
    [255, 0, 128],
    [50, 255, 50],
    [255, 200, 0],
    [255, 80, 80],
    [180, 100, 255],
    [59, 130, 246],
    [249, 115, 22],
];

const SPAWNS: [(f32, f32); 8] = [
    (240.0, 240.0),
    (1680.0, 240.0),
    (1680.0, 840.0),
    (240.0, 840.0),
    (960.0, 220.0),
    (960.0, 860.0),
    (420.0, 540.0),
    (1500.0, 540.0),
];

#[derive(Clone, Debug)]
pub struct Player {
    pub id: u8,
    pub x: f32,
    pub y: f32,
    pub angle: f32,
    pub color: [u8; 3],
    pub name: String,
    pub character_id: String,
}

impl Player {
    fn snapshot(&self) -> PlayerSnapshot {
        PlayerSnapshot {
            id: self.id,
            x: self.x,
            y: self.y,
            angle: self.angle,
            color: self.color,
            name: self.name.clone(),
            character_id: self.character_id.clone(),
        }
    }
}

#[derive(Clone, Debug)]
pub struct GameWorld {
    pub config: WorldConfig,
    pub tick: u64,
    pub players: HashMap<u8, Player>,
    pub inputs: HashMap<u8, InputSnapshot>,
}

impl Default for GameWorld {
    fn default() -> Self {
        Self::new(WorldConfig {
            width: DEFAULT_WORLD_WIDTH,
            height: DEFAULT_WORLD_HEIGHT,
        })
    }
}

impl GameWorld {
    pub fn new(config: WorldConfig) -> Self {
        Self {
            config,
            tick: 0,
            players: HashMap::new(),
            inputs: HashMap::new(),
        }
    }

    pub fn add_player(&mut self, id: u8, name: String, character_id: String) {
        let spawn = SPAWNS[id as usize % SPAWNS.len()];
        self.players.insert(
            id,
            Player {
                id,
                x: spawn
                    .0
                    .clamp(PLAYER_RADIUS, self.config.width - PLAYER_RADIUS),
                y: spawn
                    .1
                    .clamp(PLAYER_RADIUS, self.config.height - PLAYER_RADIUS),
                angle: 0.0,
                color: PALETTE[id as usize % PALETTE.len()],
                name,
                character_id,
            },
        );
        self.inputs.entry(id).or_default();
    }

    pub fn remove_player(&mut self, id: u8) {
        self.players.remove(&id);
        self.inputs.remove(&id);
    }

    pub fn set_input(&mut self, id: u8, input: InputSnapshot) {
        self.inputs.insert(id, input);
    }

    pub fn tick(&mut self, dt: f32) {
        self.tick += 1;

        for player in self.players.values_mut() {
            let input = self.inputs.get(&player.id).cloned().unwrap_or_default();
            let (move_x, move_y) = normalize(input.dx, input.dy);

            player.x = (player.x + move_x * PLAYER_SPEED * dt)
                .clamp(PLAYER_RADIUS, self.config.width - PLAYER_RADIUS);
            player.y = (player.y + move_y * PLAYER_SPEED * dt)
                .clamp(PLAYER_RADIUS, self.config.height - PLAYER_RADIUS);

            if input.aim_x != 0.0 || input.aim_y != 0.0 {
                player.angle = input.aim_y.atan2(input.aim_x);
            }
        }
    }

    pub fn snapshot(&self) -> StateSnapshot {
        let mut players: Vec<_> = self.players.values().map(Player::snapshot).collect();
        players.sort_by_key(|player| player.id);

        StateSnapshot {
            version: PROTOCOL_VERSION,
            tick: self.tick,
            world: self.config.clone(),
            players,
        }
    }
}

fn normalize(x: f32, y: f32) -> (f32, f32) {
    let length = (x * x + y * y).sqrt();
    if length > 1.0 {
        (x / length, y / length)
    } else {
        (x, y)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diagonal_movement_is_normalized() {
        let (x, y) = normalize(1.0, 1.0);
        let length = (x * x + y * y).sqrt();
        assert!((length - 1.0).abs() < 0.0001);
    }

    #[test]
    fn player_stays_inside_world_bounds() {
        let mut world = GameWorld::default();
        world.add_player(0, "Host".to_string(), "sonny".to_string());
        world.set_input(
            0,
            InputSnapshot {
                dx: -1.0,
                dy: -1.0,
                ..Default::default()
            },
        );

        for _ in 0..600 {
            world.tick(1.0 / 60.0);
        }

        let player = world.players.get(&0).unwrap();
        assert_eq!(player.x, PLAYER_RADIUS);
        assert_eq!(player.y, PLAYER_RADIUS);
    }
}
