use std::collections::HashMap;

use crate::abilities::{self, is_casting};
use crate::protocol::{
    BulletSnapshot, EffectKind, InputSnapshot, KillFeedEntry, LobbyConfig, MapSnapshot,
    MatchEndReason, PlayerSnapshot, RectSnapshot, StateSnapshot, WeaponPickupSnapshot,
    WeaponSlotSnapshot, WinCondition, WorldConfig, PROTOCOL_VERSION,
};
use crate::weapons::{
    self, ActiveSlot, WeaponSlotState, DEFAULT_WEAPON_ID, DROP_FORWARD_OFFSET, PICKUP_RADIUS,
};

pub const DEFAULT_WORLD_WIDTH: f32 = 1920.0;
pub const DEFAULT_WORLD_HEIGHT: f32 = 1080.0;
pub const PLAYER_RADIUS: f32 = 24.0;
pub const PLAYER_SPEED: f32 = 360.0;

pub const PLAYER_MAX_HP: u16 = 100;
pub const BULLET_RADIUS: f32 = 4.0;
pub const RESPAWN_TIME: f32 = 2.5;
pub const SPAWN_PROTECTION_TIME: f32 = 1.5;
pub const KILL_FEED_LIMIT: usize = 5;

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
pub struct Bullet {
    pub id: u32,
    pub owner_id: u8,
    pub weapon_id: String,
    pub damage: u16,
    pub radius: f32,
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub life: f32,
}

#[derive(Clone, Debug)]
pub struct WeaponPickup {
    pub id: u32,
    pub weapon_id: String,
    pub x: f32,
    pub y: f32,
    pub ammo: u8,
    pub max_ammo: u8,
}

#[derive(Clone, Debug)]
pub struct WorldEffect {
    pub id: u32,
    pub kind: EffectKind,
    pub x: f32,
    pub y: f32,
    pub radius: f32,
    pub life: f32,
    pub owner_id: u8,
}

impl Bullet {
    fn snapshot(&self) -> BulletSnapshot {
        BulletSnapshot {
            id: self.id,
            owner_id: self.owner_id,
            x: self.x,
            y: self.y,
            weapon_id: self.weapon_id.clone(),
        }
    }
}

impl WeaponPickup {
    fn snapshot(&self) -> WeaponPickupSnapshot {
        WeaponPickupSnapshot {
            id: self.id,
            weapon_id: self.weapon_id.clone(),
            x: self.x,
            y: self.y,
            ammo: self.ammo,
            max_ammo: self.max_ammo,
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
    pub loadout_primary_weapon_id: String,
    pub hp: u16,
    pub max_hp: u16,
    pub primary: Option<WeaponSlotState>,
    pub secondary: Option<WeaponSlotState>,
    pub active_slot: ActiveSlot,
    pub ammo: u8,
    pub max_ammo: u8,
    pub score: u16,
    pub kills: u16,
    pub deaths: u16,
    pub alive: bool,
    pub fire_cooldown: f32,
    pub reload_timer: f32,
    pub respawn_timer: f32,
    pub spawn_protection: f32,
    pub spawn_index: usize,
    pub ability_charge: f32,
    pub ability_windup: f32,
    pub ability_aim_x: f32,
    pub ability_aim_y: f32,
    pub controls_inverted_until: f32,
}

impl Player {
    fn new(
        id: u8,
        name: String,
        character_id: String,
        primary_weapon_id: String,
        spawn_index: usize,
        spawn: (f32, f32),
    ) -> Self {
        let primary = weapons::primary_slot_for(&primary_weapon_id);
        let weapon = weapons::get_or_default(&primary.weapon_id);
        Self {
            id,
            x: spawn.0,
            y: spawn.1,
            angle: 0.0,
            color: PALETTE[id as usize % PALETTE.len()],
            name,
            character_id,
            loadout_primary_weapon_id: primary.weapon_id.clone(),
            hp: PLAYER_MAX_HP,
            max_hp: PLAYER_MAX_HP,
            primary: Some(primary),
            secondary: None,
            active_slot: ActiveSlot::Primary,
            ammo: weapon.max_ammo,
            max_ammo: weapon.max_ammo,
            score: 0,
            kills: 0,
            deaths: 0,
            alive: true,
            fire_cooldown: 0.0,
            reload_timer: 0.0,
            respawn_timer: 0.0,
            spawn_protection: 0.0,
            spawn_index,
            ability_charge: 0.0,
            ability_windup: 0.0,
            ability_aim_x: 0.0,
            ability_aim_y: 0.0,
            controls_inverted_until: 0.0,
        }
    }

    fn reloading(&self) -> bool {
        self.reload_timer > 0.0
    }

    pub(crate) fn spawn_protected(&self) -> bool {
        self.spawn_protection > 0.0
    }

    fn active_weapon_id(&self) -> &str {
        self.slot_state(self.active_slot)
            .map(|slot| slot.weapon_id.as_str())
            .unwrap_or(DEFAULT_WEAPON_ID)
    }

    fn active_weapon(&self) -> &'static weapons::WeaponDef {
        weapons::get_or_default(self.active_weapon_id())
    }

    fn slot_state(&self, slot: ActiveSlot) -> Option<&WeaponSlotState> {
        match slot {
            ActiveSlot::Primary => self.primary.as_ref(),
            ActiveSlot::Secondary => self.secondary.as_ref(),
        }
    }

    fn slot_state_mut(&mut self, slot: ActiveSlot) -> Option<&mut WeaponSlotState> {
        match slot {
            ActiveSlot::Primary => self.primary.as_mut(),
            ActiveSlot::Secondary => self.secondary.as_mut(),
        }
    }

    fn save_ammo_to_active_slot(&mut self) {
        let ammo = self.ammo;
        if let Some(slot) = self.slot_state_mut(self.active_slot) {
            slot.ammo = ammo;
        }
    }

    fn has_active_weapon(&self) -> bool {
        self.slot_state(self.active_slot).is_some()
    }

    fn apply_active_slot_to_combat_state(&mut self) {
        let Some(slot) = self.slot_state(self.active_slot) else {
            self.ammo = 0;
            self.max_ammo = 0;
            return;
        };
        let weapon = weapons::get_or_default(&slot.weapon_id);
        self.ammo = slot.ammo;
        self.max_ammo = weapon.max_ammo;
    }

    fn slot_snapshot(slot: &WeaponSlotState) -> WeaponSlotSnapshot {
        let max_ammo = weapons::max_ammo_for(&slot.weapon_id);
        WeaponSlotSnapshot {
            weapon_id: slot.weapon_id.clone(),
            ammo: slot.ammo,
            max_ammo,
        }
    }

    fn snapshot(&self) -> PlayerSnapshot {
        let (active_weapon, reload_duration) = if let Some(slot) = self.slot_state(self.active_slot)
        {
            let weapon = weapons::get_or_default(&slot.weapon_id);
            (weapon.id.to_string(), weapon.reload_time)
        } else {
            (String::new(), 0.0)
        };
        PlayerSnapshot {
            id: self.id,
            x: self.x,
            y: self.y,
            angle: self.angle,
            color: self.color,
            name: self.name.clone(),
            character_id: self.character_id.clone(),
            hp: self.hp,
            max_hp: self.max_hp,
            ammo: self.ammo,
            max_ammo: self.max_ammo,
            score: self.score,
            kills: self.kills,
            deaths: self.deaths,
            alive: self.alive,
            reloading: self.reloading(),
            reload_remaining: self.reload_timer.max(0.0),
            spawn_protected: self.spawn_protected(),
            respawn_in: if self.alive {
                0.0
            } else {
                self.respawn_timer.max(0.0)
            },
            ability_charge: self.ability_charge,
            ability_windup: self.ability_windup.max(0.0),
            hacked_remaining: self.controls_inverted_until.max(0.0),
            active_weapon,
            active_slot: self.active_slot as u8,
            reload_duration,
            primary_weapon: self.primary.as_ref().map(Self::slot_snapshot),
            secondary_weapon: self.secondary.as_ref().map(Self::slot_snapshot),
        }
    }

    fn apply_snapshot(&mut self, snapshot: &PlayerSnapshot) {
        self.x = snapshot.x;
        self.y = snapshot.y;
        self.angle = snapshot.angle;
        self.color = snapshot.color;
        self.name = snapshot.name.clone();
        self.character_id = snapshot.character_id.clone();
        self.hp = snapshot.hp;
        self.max_hp = snapshot.max_hp;
        self.ammo = snapshot.ammo;
        self.max_ammo = snapshot.max_ammo;
        self.score = snapshot.score;
        self.kills = snapshot.kills;
        self.deaths = snapshot.deaths;
        self.alive = snapshot.alive;
        self.reload_timer = if snapshot.reload_remaining > 0.0 {
            snapshot.reload_remaining
        } else if snapshot.reloading {
            snapshot
                .reload_duration
                .max(weapons::get_or_default(&snapshot.active_weapon).reload_time)
        } else {
            0.0
        };
        self.active_slot = if snapshot.active_slot == 1 {
            ActiveSlot::Secondary
        } else {
            ActiveSlot::Primary
        };
        self.primary = snapshot
            .primary_weapon
            .as_ref()
            .map(|slot| WeaponSlotState {
                weapon_id: slot.weapon_id.clone(),
                ammo: slot.ammo,
            });
        self.secondary = snapshot
            .secondary_weapon
            .as_ref()
            .map(|slot| WeaponSlotState {
                weapon_id: slot.weapon_id.clone(),
                ammo: slot.ammo,
            });
        self.apply_active_slot_to_combat_state();
        self.spawn_protection = if snapshot.spawn_protected {
            SPAWN_PROTECTION_TIME
        } else {
            0.0
        };
        self.respawn_timer = snapshot.respawn_in;
        self.ability_charge = snapshot.ability_charge;
        self.ability_windup = snapshot.ability_windup;
        self.controls_inverted_until = snapshot.hacked_remaining;
    }

    pub fn apply_loadout(&mut self, character_id: String, primary_weapon_id: String) {
        let character_changed = self.character_id != character_id;
        self.character_id = character_id;
        self.loadout_primary_weapon_id = primary_weapon_id;

        if character_changed {
            self.ability_charge = 0.0;
        }
        if crate::abilities::is_casting(self) {
            self.ability_windup = 0.0;
        }

        if !self.alive {
            return;
        }

        let new_primary = weapons::primary_slot_for(&self.loadout_primary_weapon_id);
        self.primary = Some(new_primary);
        self.active_slot = ActiveSlot::Primary;
        self.reload_timer = 0.0;
        self.fire_cooldown = 0.0;
        self.apply_active_slot_to_combat_state();
    }

    fn reorganize_loadout_after_drop(&mut self) {
        if self.primary.is_none() {
            if let Some(secondary) = self.secondary.take() {
                self.primary = Some(secondary);
                self.active_slot = ActiveSlot::Primary;
            }
        }
        if self.slot_state(self.active_slot).is_none() {
            self.active_slot = if self.primary.is_some() {
                ActiveSlot::Primary
            } else {
                ActiveSlot::Secondary
            };
        }
        self.apply_active_slot_to_combat_state();
    }
}

#[derive(Clone, Debug)]
pub struct GameWorld {
    pub config: WorldConfig,
    pub map: GameMap,
    pub tick: u64,
    pub players: HashMap<u8, Player>,
    pub inputs: HashMap<u8, InputSnapshot>,
    ability_held: HashMap<u8, bool>,
    pub bullets: Vec<Bullet>,
    pub effects: Vec<WorldEffect>,
    pub next_bullet_id: u32,
    pub next_effect_id: u32,
    pub kill_feed: Vec<KillFeedEntry>,
    pub score_limit: u16,
    pub time_limit_secs: u16,
    pub match_elapsed: f32,
    pub win_condition: WinCondition,
    pub friendly_fire: bool,
    pub fog_of_war: bool,
    pub match_ended: bool,
    pub winner_id: Option<u8>,
    pub match_end_reason: Option<MatchEndReason>,
    pub weapon_pickups: Vec<WeaponPickup>,
    pub next_pickup_id: u32,
    input_prev: HashMap<u8, InputSnapshot>,
}

pub fn validate_match_config(config: &LobbyConfig) -> Result<(), String> {
    match config.win_condition {
        WinCondition::Kills => {
            if config.score_limit == 0 {
                return Err("Set a score limit above 0 for kill-based matches.".to_string());
            }
        }
        WinCondition::Time => {
            if config.time_limit_secs == 0 {
                return Err("Set a time limit for time-based matches.".to_string());
            }
        }
        WinCondition::Either => {
            if config.score_limit == 0 && config.time_limit_secs == 0 {
                return Err(
                    "Set a score limit, time limit, or both for Either win condition.".to_string(),
                );
            }
        }
    }
    Ok(())
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
            map: crate::maps::load_map(crate::maps::DEFAULT_MAP_ID, config.width, config.height),
            config,
            tick: 0,
            players: HashMap::new(),
            inputs: HashMap::new(),
            ability_held: HashMap::new(),
            bullets: Vec::new(),
            effects: Vec::new(),
            next_bullet_id: 1,
            next_effect_id: 1,
            kill_feed: Vec::new(),
            score_limit: 20,
            time_limit_secs: 0,
            match_elapsed: 0.0,
            win_condition: WinCondition::Kills,
            friendly_fire: true,
            fog_of_war: false,
            match_ended: false,
            winner_id: None,
            match_end_reason: None,
            weapon_pickups: Vec::new(),
            next_pickup_id: 1,
            input_prev: HashMap::new(),
        }
    }

    pub fn set_map(&mut self, map_id: &str) {
        self.map = crate::maps::load_map(map_id, self.config.width, self.config.height);
    }

    pub fn reposition_players_to_spawns(&mut self) {
        let ids: Vec<u8> = self.players.keys().copied().collect();
        for id in ids {
            if let Some(player) = self.players.get_mut(&id) {
                player.spawn_index = id as usize % self.map.spawns.len();
            }
            self.reset_player_for_spawn(id, 0.0);
        }
    }

    pub fn add_player(
        &mut self,
        id: u8,
        name: String,
        character_id: String,
        primary_weapon_id: String,
    ) {
        let spawn_index = id as usize % self.map.spawns.len();
        let spawn = self.map.spawns[spawn_index];
        let mut player = Player::new(
            id,
            name,
            character_id,
            primary_weapon_id,
            spawn_index,
            spawn,
        );
        player.x = spawn
            .0
            .clamp(PLAYER_RADIUS, self.config.width - PLAYER_RADIUS);
        player.y = spawn
            .1
            .clamp(PLAYER_RADIUS, self.config.height - PLAYER_RADIUS);
        self.players.insert(id, player);
        self.inputs.entry(id).or_default();
    }

    pub fn remove_player(&mut self, id: u8) {
        self.players.remove(&id);
        self.inputs.remove(&id);
    }

    pub fn set_input(&mut self, id: u8, input: InputSnapshot) {
        self.inputs.insert(id, input);
    }

    pub fn reset_for_match(
        &mut self,
        score_limit: u16,
        time_limit_secs: u16,
        win_condition: WinCondition,
        friendly_fire: bool,
        fog_of_war: bool,
    ) {
        self.tick = 0;
        self.bullets.clear();
        self.effects.clear();
        self.kill_feed.clear();
        self.next_effect_id = 1;
        self.score_limit = score_limit;
        self.time_limit_secs = time_limit_secs;
        self.match_elapsed = 0.0;
        self.win_condition = win_condition;
        self.friendly_fire = friendly_fire;
        self.fog_of_war = fog_of_war;
        self.match_ended = false;
        self.winner_id = None;
        self.match_end_reason = None;
        self.next_bullet_id = 1;
        self.weapon_pickups.clear();
        self.next_pickup_id = 1;
        self.input_prev.clear();

        let ids: Vec<u8> = self.players.keys().copied().collect();
        for id in ids {
            if let Some(player) = self.players.get_mut(&id) {
                player.score = 0;
                player.kills = 0;
                player.deaths = 0;
                player.ability_charge = 0.0;
                player.ability_windup = 0.0;
            }
            self.reset_player_for_spawn(id, SPAWN_PROTECTION_TIME);
        }
    }

    pub fn reset_for_lobby(&mut self) {
        self.tick = 0;
        self.bullets.clear();
        self.kill_feed.clear();
        self.match_elapsed = 0.0;
        self.match_ended = false;
        self.winner_id = None;
        self.match_end_reason = None;
        self.next_bullet_id = 1;
        self.weapon_pickups.clear();
        self.next_pickup_id = 1;
        self.input_prev.clear();

        let ids: Vec<u8> = self.players.keys().copied().collect();
        for id in ids {
            self.reset_player_for_spawn(id, 0.0);
        }
    }

    fn reset_player_for_spawn(&mut self, id: u8, spawn_protection: f32) {
        let Some(spawn) = self.players.get(&id).map(|player| {
            let spawn = self.map.spawns[player.spawn_index];
            (
                spawn
                    .0
                    .clamp(PLAYER_RADIUS, self.config.width - PLAYER_RADIUS),
                spawn
                    .1
                    .clamp(PLAYER_RADIUS, self.config.height - PLAYER_RADIUS),
            )
        }) else {
            return;
        };

        if let Some(player) = self.players.get_mut(&id) {
            player.x = spawn.0;
            player.y = spawn.1;
            player.hp = PLAYER_MAX_HP;
            player.primary = Some(weapons::primary_slot_for(&player.loadout_primary_weapon_id));
            player.secondary = None;
            player.active_slot = ActiveSlot::Primary;
            player.apply_active_slot_to_combat_state();
            player.alive = true;
            player.fire_cooldown = 0.0;
            player.reload_timer = 0.0;
            player.respawn_timer = 0.0;
            player.spawn_protection = spawn_protection;
            player.controls_inverted_until = 0.0;
            player.ability_windup = 0.0;
        }
    }

    fn spawn_weapon_pickup(&mut self, x: f32, y: f32, slot: &WeaponSlotState) {
        let id = self.next_pickup_id;
        self.next_pickup_id += 1;
        self.weapon_pickups.push(WeaponPickup {
            id,
            weapon_id: slot.weapon_id.clone(),
            x,
            y,
            ammo: slot.ammo,
            max_ammo: weapons::max_ammo_for(&slot.weapon_id),
        });
    }

    fn nearest_pickup_index(&self, x: f32, y: f32) -> Option<usize> {
        self.weapon_pickups
            .iter()
            .enumerate()
            .filter(|(_, pickup)| {
                let dx = pickup.x - x;
                let dy = pickup.y - y;
                dx * dx + dy * dy <= PICKUP_RADIUS * PICKUP_RADIUS
            })
            .min_by(|(_, left), (_, right)| {
                let left_dist = (left.x - x).powi(2) + (left.y - y).powi(2);
                let right_dist = (right.x - x).powi(2) + (right.y - y).powi(2);
                left_dist
                    .partial_cmp(&right_dist)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .map(|(index, _)| index)
    }

    fn try_switch_weapon(&mut self, id: u8) {
        let Some(player) = self.players.get_mut(&id) else {
            return;
        };
        if !player.alive || is_casting(player) {
            return;
        }
        let other = player.active_slot.toggle();
        if player.slot_state(other).is_none() {
            return;
        }
        player.save_ammo_to_active_slot();
        player.reload_timer = 0.0;
        player.fire_cooldown = 0.0;
        player.active_slot = other;
        player.apply_active_slot_to_combat_state();
    }

    fn try_drop_weapon(&mut self, id: u8) {
        let Some((angle, x, y, dropped)) = self.players.get(&id).and_then(|player| {
            if !player.alive || is_casting(player) {
                return None;
            }
            let slot = player.slot_state(player.active_slot)?.clone();
            Some((player.angle, player.x, player.y, slot))
        }) else {
            return;
        };

        let drop_x = x + angle.cos() * DROP_FORWARD_OFFSET;
        let drop_y = y + angle.sin() * DROP_FORWARD_OFFSET;
        self.spawn_weapon_pickup(drop_x, drop_y, &dropped);

        let Some(player) = self.players.get_mut(&id) else {
            return;
        };
        match player.active_slot {
            ActiveSlot::Primary => player.primary = None,
            ActiveSlot::Secondary => player.secondary = None,
        }
        player.reload_timer = 0.0;
        player.reorganize_loadout_after_drop();
    }

    fn try_pickup_weapon(&mut self, id: u8) {
        let pickup_index = {
            let Some(player) = self.players.get(&id) else {
                return;
            };
            if !player.alive || is_casting(player) {
                return;
            }
            self.nearest_pickup_index(player.x, player.y)
        };
        let Some(index) = pickup_index else {
            return;
        };
        let pickup = self.weapon_pickups[index].clone();

        let Some(player) = self.players.get_mut(&id) else {
            return;
        };
        player.save_ammo_to_active_slot();
        player.reload_timer = 0.0;

        if player.secondary.is_none() {
            player.secondary = Some(WeaponSlotState {
                weapon_id: pickup.weapon_id,
                ammo: pickup.ammo,
            });
            player.active_slot = ActiveSlot::Secondary;
            self.weapon_pickups.remove(index);
            player.apply_active_slot_to_combat_state();
            return;
        }

        let active = player.active_slot;
        let replaced = player
            .slot_state(active)
            .cloned()
            .unwrap_or_else(weapons::default_primary_slot);
        if let Some(slot) = player.slot_state_mut(active) {
            slot.weapon_id = pickup.weapon_id;
            slot.ammo = pickup.ammo;
        }
        self.weapon_pickups[index] = WeaponPickup {
            id: pickup.id,
            weapon_id: replaced.weapon_id.clone(),
            x: pickup.x,
            y: pickup.y,
            ammo: replaced.ammo,
            max_ammo: weapons::max_ammo_for(&replaced.weapon_id),
        };
        player.apply_active_slot_to_combat_state();
    }

    fn process_weapon_interactions(&mut self) {
        let player_ids: Vec<u8> = self.players.keys().copied().collect();
        for id in player_ids {
            let input = self.inputs.get(&id).cloned().unwrap_or_default();
            let prev = self.input_prev.get(&id).cloned().unwrap_or_default();
            let switch = input.switch_weapon && !prev.switch_weapon;
            let drop = input.drop_weapon && !prev.drop_weapon;
            let interact = input.interact && !prev.interact;

            if switch {
                self.try_switch_weapon(id);
            }
            if drop {
                self.try_drop_weapon(id);
            }
            if interact {
                self.try_pickup_weapon(id);
            }
        }

        for id in self.players.keys().copied().collect::<Vec<_>>() {
            if let Some(input) = self.inputs.get(&id).cloned() {
                self.input_prev.insert(id, input);
            }
        }
    }

    pub fn sync_from_snapshot(&mut self, snapshot: &StateSnapshot) {
        self.tick = snapshot.tick;
        self.config = snapshot.world.clone();
        self.match_ended = snapshot.match_ended;
        self.winner_id = snapshot.winner_id;
        self.score_limit = snapshot.score_limit;
        self.time_limit_secs = snapshot.time_limit_secs;
        self.match_elapsed = snapshot.match_elapsed_secs;
        self.win_condition = snapshot.win_condition;
        self.match_end_reason = snapshot.match_end_reason;
        self.fog_of_war = snapshot.fog_of_war;
        self.kill_feed = snapshot.kill_feed.clone();
        self.bullets = snapshot
            .bullets
            .iter()
            .map(|bullet| {
                let weapon = weapons::get_or_default(&bullet.weapon_id);
                Bullet {
                    id: bullet.id,
                    owner_id: bullet.owner_id,
                    weapon_id: bullet.weapon_id.clone(),
                    damage: weapon.damage,
                    radius: weapon.bullet_radius,
                    x: bullet.x,
                    y: bullet.y,
                    vx: 0.0,
                    vy: 0.0,
                    life: weapon.bullet_life,
                }
            })
            .collect();
        self.weapon_pickups = snapshot
            .weapon_pickups
            .iter()
            .map(|pickup| WeaponPickup {
                id: pickup.id,
                weapon_id: pickup.weapon_id.clone(),
                x: pickup.x,
                y: pickup.y,
                ammo: pickup.ammo,
                max_ammo: pickup.max_ammo,
            })
            .collect();

        let snapshot_ids: std::collections::HashSet<u8> =
            snapshot.players.iter().map(|player| player.id).collect();

        for player_snap in &snapshot.players {
            if let Some(player) = self.players.get_mut(&player_snap.id) {
                player.apply_snapshot(player_snap);
            } else {
                let primary_weapon_id = player_snap
                    .primary_weapon
                    .as_ref()
                    .map(|slot| slot.weapon_id.clone())
                    .unwrap_or_else(|| weapons::DEFAULT_WEAPON_ID.to_string());
                self.add_player(
                    player_snap.id,
                    player_snap.name.clone(),
                    player_snap.character_id.clone(),
                    primary_weapon_id,
                );
                if let Some(player) = self.players.get_mut(&player_snap.id) {
                    player.apply_snapshot(player_snap);
                }
            }
        }

        self.players.retain(|id, _| snapshot_ids.contains(id));
    }

    pub fn tick(&mut self, dt: f32) {
        if self.match_ended {
            return;
        }

        self.tick += 1;
        self.match_elapsed += dt;

        for player in self.players.values_mut() {
            if player.spawn_protection > 0.0 {
                player.spawn_protection = (player.spawn_protection - dt).max(0.0);
            }
        }

        abilities::passive_charge_tick(&mut self.players, dt);
        abilities::tick_status_effects(&mut self.players, dt);
        self.process_ability_input();
        abilities::process_abilities(self, dt);
        abilities::process_effects(self, dt);
        self.process_respawns(dt);
        self.process_movement(dt);
        self.process_weapon_interactions();
        self.process_combat(dt);
        self.process_bullets(dt);
        self.check_match_end();
    }

    fn process_respawns(&mut self, dt: f32) {
        let respawning: Vec<u8> = self
            .players
            .values()
            .filter(|player| !player.alive)
            .map(|player| player.id)
            .collect();

        for id in respawning {
            let should_respawn = {
                let player = self.players.get_mut(&id).expect("player exists");
                player.respawn_timer -= dt;
                player.respawn_timer <= 0.0
            };

            if should_respawn {
                self.reset_player_for_spawn(id, SPAWN_PROTECTION_TIME);
            }
        }
    }

    fn process_movement(&mut self, dt: f32) {
        for player in self.players.values_mut() {
            if !player.alive || is_casting(player) {
                continue;
            }

            let input = self.inputs.get(&player.id).cloned().unwrap_or_default();
            let invert = player.controls_inverted_until > 0.0;
            let (move_x, move_y) = normalize(
                if invert { -input.dx } else { input.dx },
                if invert { -input.dy } else { input.dy },
            );

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

    fn process_ability_input(&mut self) {
        let player_ids: Vec<u8> = self.players.keys().copied().collect();
        for id in player_ids {
            let pressed = self
                .inputs
                .get(&id)
                .map(|input| input.ability)
                .unwrap_or(false);
            let was_pressed = self.ability_held.get(&id).copied().unwrap_or(false);
            if pressed && !was_pressed {
                abilities::try_activate(self, id);
            }
            self.ability_held.insert(id, pressed);
        }
    }

    fn process_combat(&mut self, dt: f32) {
        let mut shots: Vec<(u8, String, u16, f32, f32, f32, f32, f32, f32, f32)> = Vec::new();
        let mut reload_requests: Vec<(u8, f32)> = Vec::new();

        for player in self.players.values_mut() {
            if !player.alive || is_casting(player) || !player.has_active_weapon() {
                continue;
            }

            if player.fire_cooldown > 0.0 {
                player.fire_cooldown = (player.fire_cooldown - dt).max(0.0);
            }

            let weapon = player.active_weapon();
            if player.reload_timer > 0.0 {
                player.reload_timer = (player.reload_timer - dt).max(0.0);
                if player.reload_timer <= 0.0 {
                    player.ammo = player.max_ammo;
                    player.save_ammo_to_active_slot();
                }
                continue;
            }

            let input = self.inputs.get(&player.id).cloned().unwrap_or_default();

            if input.reload && player.ammo < player.max_ammo {
                reload_requests.push((player.id, weapon.reload_time));
                continue;
            }

            if !input.fire || player.fire_cooldown > 0.0 {
                continue;
            }

            if player.ammo == 0 {
                reload_requests.push((player.id, weapon.reload_time));
                continue;
            }

            let (aim_x, aim_y) = normalize(input.aim_x, input.aim_y);
            if aim_x == 0.0 && aim_y == 0.0 {
                continue;
            }

            player.ammo -= 1;
            player.save_ammo_to_active_slot();
            player.fire_cooldown = weapon.fire_rate;

            let spawn_x = player.x + aim_x * (PLAYER_RADIUS + weapon.muzzle_offset);
            let spawn_y = player.y + aim_y * (PLAYER_RADIUS + weapon.muzzle_offset);
            shots.push((
                player.id,
                weapon.id.to_string(),
                weapon.damage,
                weapon.bullet_speed,
                weapon.bullet_life,
                weapon.bullet_radius,
                spawn_x,
                spawn_y,
                aim_x,
                aim_y,
            ));
        }

        for (id, reload_time) in reload_requests {
            if let Some(player) = self.players.get_mut(&id) {
                if player.alive && player.reload_timer <= 0.0 && player.ammo < player.max_ammo {
                    player.reload_timer = reload_time;
                }
            }
        }

        for (
            owner_id,
            weapon_id,
            damage,
            bullet_speed,
            bullet_life,
            bullet_radius,
            x,
            y,
            aim_x,
            aim_y,
        ) in shots
        {
            let id = self.next_bullet_id;
            self.next_bullet_id += 1;
            self.bullets.push(Bullet {
                id,
                owner_id,
                weapon_id,
                damage,
                radius: bullet_radius,
                x,
                y,
                vx: aim_x * bullet_speed,
                vy: aim_y * bullet_speed,
                life: bullet_life,
            });
        }
    }

    fn process_bullets(&mut self, dt: f32) {
        let mut hits: Vec<(u32, u8, u8, u16)> = Vec::new();

        for bullet in &mut self.bullets {
            bullet.life -= dt;
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
        }

        self.bullets.retain(|bullet| {
            bullet.life > 0.0
                && bullet.x >= 0.0
                && bullet.y >= 0.0
                && bullet.x <= self.config.width
                && bullet.y <= self.config.height
                && !circle_hits_walls(bullet.x, bullet.y, bullet.radius, &self.map.walls)
        });

        for bullet in &self.bullets {
            for player in self.players.values() {
                if !player.alive || player.spawn_protected() || player.id == bullet.owner_id {
                    continue;
                }
                if !self.friendly_fire {
                    continue;
                }

                if circle_hits_circle(
                    bullet.x,
                    bullet.y,
                    bullet.radius,
                    player.x,
                    player.y,
                    PLAYER_RADIUS,
                ) {
                    hits.push((bullet.id, bullet.owner_id, player.id, bullet.damage));
                    break;
                }
            }
        }

        if hits.is_empty() {
            return;
        }

        let hit_bullet_ids: std::collections::HashSet<u32> =
            hits.iter().map(|(bullet_id, _, _, _)| *bullet_id).collect();
        self.bullets
            .retain(|bullet| !hit_bullet_ids.contains(&bullet.id));

        for (_, killer_id, victim_id, damage) in hits {
            self.apply_damage(killer_id, victim_id, damage);
        }
    }

    pub(crate) fn apply_damage(&mut self, killer_id: u8, victim_id: u8, damage: u16) {
        let died = {
            let Some(victim) = self.players.get_mut(&victim_id) else {
                return;
            };
            if !victim.alive || victim.spawn_protected() {
                return;
            }
            victim.hp = victim.hp.saturating_sub(damage);
            victim.hp == 0
        };

        if !died {
            if let Some(killer) = self.players.get_mut(&killer_id) {
                abilities::add_charge(killer, abilities::CHARGE_ON_DAMAGE);
            }
            return;
        }

        let (killer_name, victim_name) = {
            let killer_name = self
                .players
                .get(&killer_id)
                .map(|player| player.name.clone())
                .unwrap_or_else(|| "Unknown".to_string());
            let victim_name = self
                .players
                .get(&victim_id)
                .map(|player| player.name.clone())
                .unwrap_or_else(|| "Unknown".to_string());
            (killer_name, victim_name)
        };

        if let Some(victim) = self.players.get_mut(&victim_id) {
            victim.alive = false;
            victim.hp = 0;
            victim.deaths += 1;
            victim.respawn_timer = RESPAWN_TIME;
            victim.reload_timer = 0.0;
        }

        if let Some(killer) = self.players.get_mut(&killer_id) {
            killer.kills += 1;
            killer.score += 1;
            abilities::add_charge(killer, abilities::CHARGE_ON_KILL);
        }

        self.kill_feed.push(KillFeedEntry {
            killer_id,
            killer_name,
            victim_id,
            victim_name,
        });
        if self.kill_feed.len() > KILL_FEED_LIMIT {
            let overflow = self.kill_feed.len() - KILL_FEED_LIMIT;
            self.kill_feed.drain(0..overflow);
        }
    }

    fn check_match_end(&mut self) {
        if self.match_ended {
            return;
        }

        let score_win = self.score_limit > 0
            && self
                .players
                .values()
                .any(|player| player.score >= self.score_limit);

        let time_win =
            self.time_limit_secs > 0 && self.match_elapsed >= self.time_limit_secs as f32;

        let (should_end, reason) = match self.win_condition {
            WinCondition::Kills => (score_win, score_win.then_some(MatchEndReason::Score)),
            WinCondition::Time => (time_win, time_win.then_some(MatchEndReason::Time)),
            WinCondition::Either => {
                if score_win {
                    (true, Some(MatchEndReason::Score))
                } else if time_win {
                    (true, Some(MatchEndReason::Time))
                } else {
                    (false, None)
                }
            }
        };

        if !should_end {
            return;
        }

        self.match_ended = true;
        self.match_end_reason = reason;
        self.winner_id = self.leading_player_id();
    }

    fn leading_player_id(&self) -> Option<u8> {
        self.players
            .values()
            .max_by(|a, b| {
                a.score
                    .cmp(&b.score)
                    .then(a.kills.cmp(&b.kills))
                    .then(b.deaths.cmp(&a.deaths))
                    .then(a.id.cmp(&b.id))
            })
            .map(|player| player.id)
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
            bullets: self.bullets.iter().map(Bullet::snapshot).collect(),
            effects: self
                .effects
                .iter()
                .map(abilities::effect_snapshot)
                .collect(),
            kill_feed: self.kill_feed.clone(),
            match_ended: self.match_ended,
            winner_id: self.winner_id,
            score_limit: self.score_limit,
            time_limit_secs: self.time_limit_secs,
            match_elapsed_secs: self.match_elapsed,
            win_condition: self.win_condition,
            match_end_reason: self.match_end_reason,
            fog_of_war: self.fog_of_war,
            weapon_pickups: self
                .weapon_pickups
                .iter()
                .map(WeaponPickup::snapshot)
                .collect(),
        }
    }
}

pub fn normalize(x: f32, y: f32) -> (f32, f32) {
    let length = (x * x + y * y).sqrt();
    if length > 1.0 {
        (x / length, y / length)
    } else if length > 0.0001 {
        (x / length, y / length)
    } else {
        (0.0, 0.0)
    }
}

pub fn circle_hits_walls(x: f32, y: f32, radius: f32, walls: &[Rect]) -> bool {
    walls
        .iter()
        .any(|wall| circle_hits_rect(x, y, radius, wall))
}

pub fn circle_hits_rect(x: f32, y: f32, radius: f32, rect: &Rect) -> bool {
    let closest_x = x.clamp(rect.x, rect.x + rect.w);
    let closest_y = y.clamp(rect.y, rect.y + rect.h);
    let dx = x - closest_x;
    let dy = y - closest_y;
    dx * dx + dy * dy < radius * radius
}

pub fn circle_hits_circle(x1: f32, y1: f32, r1: f32, x2: f32, y2: f32, r2: f32) -> bool {
    let dx = x1 - x2;
    let dy = y1 - y2;
    let radius = r1 + r2;
    dx * dx + dy * dy < radius * radius
}
#[cfg(test)]
mod tests {
    use super::*;

    fn test_world_with_two_players() -> GameWorld {
        let mut world = GameWorld::default();
        world.add_player(
            0,
            "Host".to_string(),
            "sonny".to_string(),
            "glock".to_string(),
        );
        world.add_player(
            1,
            "Guest".to_string(),
            "bailey".to_string(),
            "glock".to_string(),
        );
        world.reset_for_match(20, 0, WinCondition::Kills, true, false);
        for player in world.players.values_mut() {
            player.spawn_protection = 0.0;
        }
        world
    }

    fn test_glock_bullet(id: u32, owner_id: u8, x: f32, y: f32, vx: f32, vy: f32) -> Bullet {
        let weapon = weapons::get_or_default("glock");
        Bullet {
            id,
            owner_id,
            weapon_id: weapon.id.to_string(),
            damage: weapon.damage,
            radius: weapon.bullet_radius,
            x,
            y,
            vx,
            vy,
            life: weapon.bullet_life,
        }
    }

    #[test]
    fn diagonal_movement_is_normalized() {
        let (x, y) = normalize(1.0, 1.0);
        let length = (x * x + y * y).sqrt();
        assert!((length - 1.0).abs() < 0.0001);
    }

    #[test]
    fn player_stays_inside_world_bounds() {
        let mut world = GameWorld::default();
        world.add_player(
            0,
            "Host".to_string(),
            "sonny".to_string(),
            "glock".to_string(),
        );
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
        assert!(player.x >= PLAYER_RADIUS);
        assert!(player.y >= PLAYER_RADIUS);
        assert!(player.x <= world.config.width - PLAYER_RADIUS);
        assert!(player.y <= world.config.height - PLAYER_RADIUS);
    }

    #[test]
    fn player_collides_with_map_walls() {
        let mut world = GameWorld::default();
        world.add_player(
            0,
            "Host".to_string(),
            "sonny".to_string(),
            "glock".to_string(),
        );
        let wall = world
            .map
            .walls
            .iter()
            .find(|wall| wall.w >= 80.0 && wall.h >= 80.0)
            .cloned()
            .expect("interior wall");
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

    #[test]
    fn bullet_is_removed_when_it_hits_a_wall() {
        let mut world = GameWorld::default();
        let wall = world
            .map
            .walls
            .iter()
            .find(|wall| wall.w >= 80.0 && wall.h >= 80.0)
            .cloned()
            .expect("interior wall");
        world.bullets.push(test_glock_bullet(
            1,
            0,
            wall.x - 8.0,
            wall.y + wall.h / 2.0,
            720.0,
            0.0,
        ));

        world.process_bullets(1.0 / 60.0);

        assert!(world.bullets.is_empty());
    }

    #[test]
    fn bullet_damages_an_enemy_player() {
        let mut world = test_world_with_two_players();
        let victim_pos = {
            let victim = world.players.get(&1).unwrap();
            (victim.x, victim.y)
        };

        world.bullets.push(test_glock_bullet(
            1,
            0,
            victim_pos.0 - 20.0,
            victim_pos.1,
            720.0,
            0.0,
        ));

        world.process_bullets(1.0 / 60.0);

        let victim = world.players.get(&1).unwrap();
        assert_eq!(
            victim.hp,
            PLAYER_MAX_HP - weapons::get_or_default("glock").damage
        );
        assert!(victim.alive);
        assert!(world.bullets.is_empty());
    }

    #[test]
    fn reload_blocks_shooting() {
        let mut world = test_world_with_two_players();
        {
            let player = world.players.get_mut(&0).unwrap();
            player.ammo = 0;
            player.reload_timer = weapons::get_or_default("glock").reload_time;
        }

        world.set_input(
            0,
            InputSnapshot {
                aim_x: 1.0,
                fire: true,
                ..Default::default()
            },
        );

        world.process_combat(1.0 / 60.0);

        assert!(world.bullets.is_empty());
        assert!(world.players.get(&0).unwrap().reloading());
    }

    #[test]
    fn reaching_score_limit_ends_the_match() {
        let mut world = test_world_with_two_players();
        world.score_limit = 3;
        {
            let player = world.players.get_mut(&0).unwrap();
            player.score = 2;
            player.kills = 2;
        }

        world.apply_damage(0, 1, PLAYER_MAX_HP);
        world.check_match_end();

        assert!(world.match_ended);
        assert_eq!(world.winner_id, Some(0));
        assert_eq!(world.match_end_reason, Some(MatchEndReason::Score));
        assert_eq!(world.players.get(&0).unwrap().score, 3);
    }

    #[test]
    fn friendly_fire_off_prevents_bullet_damage() {
        let mut world = test_world_with_two_players();
        world.friendly_fire = false;
        let victim_pos = {
            let victim = world.players.get(&1).unwrap();
            (victim.x, victim.y)
        };

        world.bullets.push(test_glock_bullet(
            1,
            0,
            victim_pos.0 - 20.0,
            victim_pos.1,
            720.0,
            0.0,
        ));

        world.process_bullets(1.0 / 60.0);

        let victim = world.players.get(&1).unwrap();
        assert_eq!(victim.hp, PLAYER_MAX_HP);
        assert!(victim.alive);
    }

    #[test]
    fn validate_rejects_time_mode_without_limit() {
        let mut config = LobbyConfig::default();
        config.win_condition = WinCondition::Time;
        config.time_limit_secs = 0;
        assert!(validate_match_config(&config).is_err());
    }

    #[test]
    fn validate_rejects_kills_mode_without_score_limit() {
        let mut config = LobbyConfig::default();
        config.win_condition = WinCondition::Kills;
        config.score_limit = 0;
        assert!(validate_match_config(&config).is_err());
    }

    #[test]
    fn time_limit_ends_the_match_with_highest_score_winner() {
        let mut world = test_world_with_two_players();
        world.win_condition = WinCondition::Time;
        world.time_limit_secs = 1;
        world.match_elapsed = 1.0;
        world.players.get_mut(&0).unwrap().score = 5;
        world.players.get_mut(&1).unwrap().score = 2;

        world.check_match_end();

        assert!(world.match_ended);
        assert_eq!(world.winner_id, Some(0));
        assert_eq!(world.match_end_reason, Some(MatchEndReason::Time));
    }

    #[test]
    fn bailey_truth_nuke_damages_players_in_blast() {
        use crate::abilities::{ABILITY_CHARGE_MAX, BAILEY_NUKE_DAMAGE};

        let mut world = test_world_with_two_players();
        {
            let caster = world.players.get_mut(&1).unwrap();
            caster.ability_charge = ABILITY_CHARGE_MAX;
            caster.x = 400.0;
            caster.y = 400.0;
        }
        {
            let victim = world.players.get_mut(&0).unwrap();
            victim.x = 700.0;
            victim.y = 400.0;
        }

        world.set_input(
            1,
            InputSnapshot {
                ability: true,
                aim_x: 1.0,
                aim_y: 0.0,
                ..Default::default()
            },
        );
        world.process_ability_input();
        world.ability_held.insert(1, true);

        for _ in 0..90 {
            world.tick(1.0 / 60.0);
        }

        let victim = world.players.get(&0).unwrap();
        assert_eq!(victim.hp, PLAYER_MAX_HP - BAILEY_NUKE_DAMAGE);
        assert!(world
            .effects
            .iter()
            .any(|effect| effect.kind == EffectKind::Explosion));
    }

    #[test]
    fn sonny_reverse_shell_hacks_nearest_enemy() {
        use crate::abilities::ABILITY_CHARGE_MAX;

        let mut world = test_world_with_two_players();
        {
            let caster = world.players.get_mut(&0).unwrap();
            caster.ability_charge = ABILITY_CHARGE_MAX;
            caster.x = 400.0;
            caster.y = 400.0;
            caster.spawn_protection = 0.0;
        }
        {
            let victim = world.players.get_mut(&1).unwrap();
            victim.x = 480.0;
            victim.y = 400.0;
            victim.spawn_protection = 0.0;
        }

        world.set_input(
            0,
            InputSnapshot {
                ability: true,
                ..Default::default()
            },
        );
        world.process_ability_input();
        world.ability_held.insert(0, true);

        let victim = world.players.get(&1).unwrap();
        assert!(victim.controls_inverted_until > 0.0);
        assert_eq!(world.players.get(&0).unwrap().ability_charge, 0.0);
    }

    #[test]
    fn apply_loadout_swaps_alive_primary_weapon() {
        let mut world = test_world_with_two_players();
        {
            let player = world.players.get_mut(&0).unwrap();
            player.secondary = Some(WeaponSlotState {
                weapon_id: "glock".to_string(),
                ammo: 5,
            });
            player.ammo = 10;
            player.save_ammo_to_active_slot();
        }

        world
            .players
            .get_mut(&0)
            .unwrap()
            .apply_loadout("bailey".to_string(), "glock".to_string());

        let player = world.players.get(&0).unwrap();
        assert_eq!(player.character_id, "bailey");
        assert_eq!(player.loadout_primary_weapon_id, "glock");
        assert_eq!(player.active_slot, ActiveSlot::Primary);
        assert_eq!(
            player.primary.as_ref().unwrap().ammo,
            weapons::get_or_default("glock").max_ammo
        );
        assert_eq!(player.secondary.as_ref().unwrap().ammo, 5);
    }

    #[test]
    fn drop_only_weapon_leaves_player_unarmed() {
        let mut world = test_world_with_two_players();
        world.try_drop_weapon(0);

        assert_eq!(world.weapon_pickups.len(), 1);
        let player = world.players.get(&0).unwrap();
        assert!(player.primary.is_none());
        assert!(player.secondary.is_none());
        assert_eq!(player.ammo, 0);
        assert_eq!(player.max_ammo, 0);
    }

    #[test]
    fn drop_weapon_spawns_pickup_and_promotes_secondary() {
        let mut world = test_world_with_two_players();
        {
            let player = world.players.get_mut(&0).unwrap();
            player.secondary = Some(WeaponSlotState {
                weapon_id: "glock".to_string(),
                ammo: 5,
            });
            player.active_slot = ActiveSlot::Primary;
        }

        world.try_drop_weapon(0);

        assert_eq!(world.weapon_pickups.len(), 1);
        let player = world.players.get(&0).unwrap();
        assert!(player.secondary.is_none());
        assert_eq!(player.primary.as_ref().unwrap().ammo, 5);
        assert_eq!(player.active_slot, ActiveSlot::Primary);
    }

    #[test]
    fn pickup_weapon_fills_secondary_slot() {
        let mut world = test_world_with_two_players();
        world.weapon_pickups.push(WeaponPickup {
            id: 1,
            weapon_id: "glock".to_string(),
            x: world.players.get(&0).unwrap().x,
            y: world.players.get(&0).unwrap().y,
            ammo: 8,
            max_ammo: 17,
        });

        world.try_pickup_weapon(0);

        let player = world.players.get(&0).unwrap();
        assert!(world.weapon_pickups.is_empty());
        assert_eq!(player.secondary.as_ref().unwrap().ammo, 8);
        assert_eq!(player.active_slot, ActiveSlot::Secondary);
    }

    #[test]
    fn switch_weapon_swaps_active_slot() {
        let mut world = test_world_with_two_players();
        {
            let player = world.players.get_mut(&0).unwrap();
            player.secondary = Some(WeaponSlotState {
                weapon_id: "glock".to_string(),
                ammo: 3,
            });
            player.ammo = 10;
            player.save_ammo_to_active_slot();
        }

        world.try_switch_weapon(0);

        let player = world.players.get(&0).unwrap();
        assert_eq!(player.active_slot, ActiveSlot::Secondary);
        assert_eq!(player.ammo, 3);
    }
}
