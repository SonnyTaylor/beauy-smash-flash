use std::collections::HashMap;

use crate::protocol::{
    InputSnapshot, MapSnapshot, PlayerSnapshot, RectSnapshot, StateSnapshot, WorldConfig,
    PROTOCOL_VERSION,
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

#[derive(Clone, Debug)]
pub struct GameMap {
    pub id: String,
    pub name: String,
    pub walls: Vec<Rect>,
    pub spawns: Vec<(f32, f32)>,
}

impl GameMap {
    pub fn snapshot(&self) -> MapSnapshot {
        MapSnapshot {
            id: self.id.clone(),
            name: self.name.clone(),
            walls: self.walls.iter().map(Rect::snapshot).collect(),
        }
    }
}

#[derive(Clone, Debug)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

impl Rect {
    fn snapshot(&self) -> RectSnapshot {
        RectSnapshot {
            x: self.x,
            y: self.y,
            w: self.w,
            h: self.h,
        }
    }
}

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
    pub map: GameMap,
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
            map: warehouse_map(),
            config,
            tick: 0,
            players: HashMap::new(),
            inputs: HashMap::new(),
        }
    }

    pub fn add_player(&mut self, id: u8, name: String, character_id: String) {
        let spawn = self.map.spawns[id as usize % self.map.spawns.len()];
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

            let next_x = (player.x + move_x * PLAYER_SPEED * dt)
                .clamp(PLAYER_RADIUS, self.config.width - PLAYER_RADIUS);
            if !circle_hits_walls(next_x, player.y, PLAYER_RADIUS, &self.map.walls) {
                player.x = next_x;
            }

            let next_y = (player.y + move_y * PLAYER_SPEED * dt)
                .clamp(PLAYER_RADIUS, self.config.height - PLAYER_RADIUS);
            if !circle_hits_walls(player.x, next_y, PLAYER_RADIUS, &self.map.walls) {
                player.y = next_y;
            }

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
            map: self.map.snapshot(),
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

fn circle_hits_walls(x: f32, y: f32, radius: f32, walls: &[Rect]) -> bool {
    walls
        .iter()
        .any(|wall| circle_hits_rect(x, y, radius, wall))
}

fn circle_hits_rect(x: f32, y: f32, radius: f32, rect: &Rect) -> bool {
    let closest_x = x.clamp(rect.x, rect.x + rect.w);
    let closest_y = y.clamp(rect.y, rect.y + rect.h);
    let dx = x - closest_x;
    let dy = y - closest_y;
    dx * dx + dy * dy < radius * radius
}

fn warehouse_map() -> GameMap {
    let walls = [
        (-100.0, -100.0, 1480.0, 100.0),
        (-100.0, 720.0, 1480.0, 100.0),
        (-100.0, 0.0, 100.0, 720.0),
        (1280.0, 0.0, 100.0, 720.0),
        (160.0, 80.0, 160.0, 120.0),
        (960.0, 80.0, 160.0, 120.0),
        (160.0, 520.0, 160.0, 120.0),
        (960.0, 520.0, 160.0, 120.0),
        (440.0, 240.0, 400.0, 40.0),
        (440.0, 440.0, 400.0, 40.0),
        (80.0, 280.0, 40.0, 160.0),
        (1160.0, 280.0, 40.0, 160.0),
    ];
    GameMap {
        id: "warehouse".to_string(),
        name: "Warehouse".to_string(),
        walls: walls.into_iter().map(scale_rect_from_python).collect(),
        spawns: vec![
            (240.0, 540.0),
            (1680.0, 540.0),
            (960.0, 180.0),
            (960.0, 900.0),
            (540.0, 180.0),
            (1380.0, 900.0),
        ],
    }
}

fn scale_rect_from_python((x, y, w, h): (f32, f32, f32, f32)) -> Rect {
    let sx = DEFAULT_WORLD_WIDTH / 1280.0;
    let sy = DEFAULT_WORLD_HEIGHT / 720.0;
    Rect {
        x: x * sx,
        y: y * sy,
        w: w * sx,
        h: h * sy,
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

    #[test]
    fn player_collides_with_map_walls() {
        let mut world = GameWorld::default();
        world.add_player(0, "Host".to_string(), "sonny".to_string());
        let wall = world.map.walls[4].clone();
        let player = world.players.get_mut(&0).unwrap();
        player.x = wall.x - PLAYER_RADIUS - 1.0;
        player.y = wall.y + wall.h / 2.0;

        world.set_input(
            0,
            InputSnapshot {
                dx: 1.0,
                dy: 0.0,
                ..Default::default()
            },
        );

        for _ in 0..30 {
            world.tick(1.0 / 60.0);
        }

        let player = world.players.get(&0).unwrap();
        assert!(player.x <= wall.x - PLAYER_RADIUS);
    }
}
