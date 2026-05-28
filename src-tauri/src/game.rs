use std::collections::HashMap;

use crate::abilities::{self, is_casting};
use crate::protocol::{
    BulletSnapshot, EffectKind, Gamemode, InputSnapshot, KillFeedEntry, LobbyConfig, MapSnapshot,
    MatchEndReason, PlayerSnapshot, RectSnapshot, StateSnapshot, WaveState, WeaponPickupSnapshot,
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

pub const ZOMBIE_ID_START: u8 = 200;
pub const ZOMBIE_SPEED_MULT: f32 = 0.48;
pub const HORDE_INTERMISSION_SECS: f32 = 5.0;
pub const HORDE_INITIAL_DELAY: f32 = 4.0;
pub const HORDE_BASE_ZOMBIES: u16 = 3;
pub const HORDE_WAVE_SCALE: u16 = 1;
pub const HORDE_SPAWN_STAGGER_SECS: f32 = 0.65;

pub const LUCA_MAX_HP: u16 = 1;
pub const LUCA_SPEED_MULT: f32 = 0.42;

const BOT_CHARACTERS: [&str; 6] = ["sonny", "bailey", "jacob", "isaak", "taj", "finn"];

pub fn is_luca_character(character_id: &str) -> bool {
    character_id == "luca"
}

fn max_hp_for_character(character_id: &str) -> u16 {
    if is_luca_character(character_id) {
        LUCA_MAX_HP
    } else {
        PLAYER_MAX_HP
    }
}

fn strip_player_weapons(player: &mut Player) {
    player.primary = None;
    player.secondary = None;
    player.active_slot = ActiveSlot::Primary;
    player.ammo = 0;
    player.max_ammo = 0;
    player.reload_timer = 0.0;
    player.fire_cooldown = 0.0;
}

#[derive(Clone, Copy, Debug, Default)]
pub struct BotNavState {
    pub last_x: f32,
    pub last_y: f32,
    pub stuck_secs: f32,
    pub recover_secs: f32,
    pub recover_dx: f32,
    pub recover_dy: f32,
}

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
    pub bounces_remaining: u8,
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
    pub origin_x: f32,
    pub origin_y: f32,
    pub target_x: f32,
    pub target_y: f32,
    pub max_life: f32,
    /// Server-only: players already damaged by a traveling reel post.
    pub hit_players: Vec<u8>,
}

impl WorldEffect {
    pub(crate) fn burst(
        id: u32,
        kind: EffectKind,
        x: f32,
        y: f32,
        radius: f32,
        life: f32,
        owner_id: u8,
    ) -> Self {
        Self {
            id,
            kind,
            x,
            y,
            radius,
            life,
            owner_id,
            origin_x: x,
            origin_y: y,
            target_x: x,
            target_y: y,
            max_life: life,
            hit_players: Vec::new(),
        }
    }
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
    pub pending_character_id: Option<String>,
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
    pub slowed_until: f32,
    pub slow_multiplier: f32,
    pub marked_until: f32,
    pub mark_damage_multiplier: f32,
    pub poison_until: f32,
    pub poison_dps: u16,
    pub poison_owner_id: u8,
    pub poison_accumulator: f32,
    pub directors_cut_until: f32,
    pub directors_cut_shots: u8,
    pub stillness_timer: f32,
    pub stillness_stacks: u8,
    pub last_shot_timer: f32,
    pub reel_shield_remaining: f32,
    pub reel_shield_hp: f32,
    pub reel_shield_angle: f32,
    pub boat_mode_until: f32,
    pub boat_rammed: Vec<u8>,
    pub hangover_until: f32,
    pub reel_index: u8,
    pub is_bot: bool,
    pub is_zombie: bool,
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
        let primary_id = weapons::validate_weapon_id(&primary_weapon_id);
        let primary = if is_luca_character(&character_id) {
            None
        } else {
            Some(weapons::primary_slot_for(&primary_id))
        };
        let max_hp = max_hp_for_character(&character_id);
        let (ammo, max_ammo) = if let Some(slot) = primary.as_ref() {
            let weapon = weapons::get_or_default(&slot.weapon_id);
            (weapon.max_ammo, weapon.max_ammo)
        } else {
            (0, 0)
        };
        Self {
            id,
            x: spawn.0,
            y: spawn.1,
            angle: 0.0,
            color: PALETTE[id as usize % PALETTE.len()],
            name,
            character_id,
            pending_character_id: None,
            loadout_primary_weapon_id: primary_id,
            hp: max_hp,
            max_hp,
            primary,
            secondary: None,
            active_slot: ActiveSlot::Primary,
            ammo,
            max_ammo,
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
            slowed_until: 0.0,
            slow_multiplier: 1.0,
            marked_until: 0.0,
            mark_damage_multiplier: 1.0,
            poison_until: 0.0,
            poison_dps: 0,
            poison_owner_id: 0,
            poison_accumulator: 0.0,
            directors_cut_until: 0.0,
            directors_cut_shots: 0,
            stillness_timer: 0.0,
            stillness_stacks: 0,
            last_shot_timer: 999.0,
            reel_shield_remaining: 0.0,
            reel_shield_hp: 0.0,
            reel_shield_angle: 0.0,
            boat_mode_until: 0.0,
            boat_rammed: Vec::new(),
            hangover_until: 0.0,
            reel_index: 0,
            is_bot: false,
            is_zombie: false,
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
            pending_character_id: self.pending_character_id.clone(),
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
            ability_aim_x: if self.ability_windup > 0.0 {
                self.ability_aim_x
            } else {
                0.0
            },
            ability_aim_y: if self.ability_windup > 0.0 {
                self.ability_aim_y
            } else {
                0.0
            },
            hacked_remaining: self.controls_inverted_until.max(0.0),
            slowed_remaining: self.slowed_until.max(0.0),
            marked_remaining: self.marked_until.max(0.0),
            directors_cut_remaining: self.directors_cut_until.max(0.0),
            directors_cut_shots: if self.directors_cut_shots > 0 {
                self.directors_cut_shots
            } else {
                0
            },
            poison_remaining: self.poison_until.max(0.0),
            stillness_stacks: self.stillness_stacks,
            reel_shield_remaining: self.reel_shield_remaining.max(0.0),
            boat_mode_remaining: self.boat_mode_until.max(0.0),
            hangover_remaining: self.hangover_until.max(0.0),
            reel_index: if self.reel_shield_remaining > 0.0 {
                self.reel_index
            } else {
                0
            },
            active_weapon,
            active_slot: self.active_slot as u8,
            reload_duration,
            primary_weapon: self.primary.as_ref().map(Self::slot_snapshot),
            secondary_weapon: self.secondary.as_ref().map(Self::slot_snapshot),
            is_bot: self.is_bot,
            is_zombie: self.is_zombie,
        }
    }

    fn apply_snapshot(&mut self, snapshot: &PlayerSnapshot) {
        self.x = snapshot.x;
        self.y = snapshot.y;
        self.angle = snapshot.angle;
        self.color = snapshot.color;
        self.name = snapshot.name.clone();
        self.character_id = snapshot.character_id.clone();
        self.pending_character_id = snapshot.pending_character_id.clone();
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
        self.slowed_until = snapshot.slowed_remaining;
        self.marked_until = snapshot.marked_remaining;
        self.directors_cut_until = snapshot.directors_cut_remaining;
        self.directors_cut_shots = snapshot.directors_cut_shots;
        self.poison_until = snapshot.poison_remaining;
        self.is_bot = snapshot.is_bot;
        self.is_zombie = snapshot.is_zombie;
    }

    pub fn apply_loadout(
        &mut self,
        character_id: String,
        primary_weapon_id: String,
        match_in_progress: bool,
    ) {
        self.loadout_primary_weapon_id = weapons::validate_weapon_id(&primary_weapon_id);
        let defer_character = match_in_progress && self.alive;

        if defer_character {
            if character_id == self.character_id {
                self.pending_character_id = None;
            } else {
                self.pending_character_id = Some(character_id);
            }
        } else {
            let character_changed = self.character_id != character_id;
            self.character_id = character_id;
            self.pending_character_id = None;
            if character_changed {
                self.ability_charge = 0.0;
            }
            if crate::abilities::is_casting(self) {
                self.ability_windup = 0.0;
            }
        }

        if !self.alive {
            return;
        }

        if is_luca_character(&self.character_id) {
            self.max_hp = LUCA_MAX_HP;
            self.hp = LUCA_MAX_HP;
            strip_player_weapons(self);
            return;
        }

        self.max_hp = PLAYER_MAX_HP;
        if self.hp > PLAYER_MAX_HP {
            self.hp = PLAYER_MAX_HP;
        }
        let new_primary = weapons::primary_slot_for(&self.loadout_primary_weapon_id);
        self.primary = Some(new_primary);
        self.active_slot = ActiveSlot::Primary;
        self.reload_timer = 0.0;
        self.fire_cooldown = 0.0;
        self.apply_active_slot_to_combat_state();
    }

    fn apply_pending_character(&mut self) {
        let Some(pending) = self.pending_character_id.take() else {
            return;
        };
        if self.character_id != pending {
            self.character_id = pending;
            self.ability_charge = 0.0;
        }
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
    pub gamemode: Gamemode,
    pub friendly_fire: bool,
    pub fog_of_war: bool,
    pub match_ended: bool,
    pub winner_id: Option<u8>,
    pub match_end_reason: Option<MatchEndReason>,
    pub weapon_pickups: Vec<WeaponPickup>,
    pub next_pickup_id: u32,
    pub next_reel_index: u8,
    pub dev_mode: bool,
    input_prev: HashMap<u8, InputSnapshot>,
    pub wave: u16,
    pub zombies_remaining: u16,
    pub wave_state: WaveState,
    pub wave_intermission_timer: f32,
    horde_spawn_queue: Vec<(f32, usize)>,
    pub next_zombie_id: u8,
    pub wave_goal: u16,
    pub bot_nav: HashMap<u8, BotNavState>,
}

pub fn validate_match_config(config: &LobbyConfig) -> Result<(), String> {
    if config.gamemode == Gamemode::ZombieHorde {
        return Ok(());
    }

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
            gamemode: Gamemode::Deathmatch,
            friendly_fire: true,
            fog_of_war: false,
            match_ended: false,
            winner_id: None,
            match_end_reason: None,
            weapon_pickups: Vec::new(),
            next_pickup_id: 1,
            next_reel_index: 0,
            dev_mode: cfg!(debug_assertions),
            input_prev: HashMap::new(),
            wave: 0,
            zombies_remaining: 0,
            wave_state: WaveState::Intermission,
            wave_intermission_timer: 0.0,
            horde_spawn_queue: Vec::new(),
            next_zombie_id: ZOMBIE_ID_START,
            wave_goal: 0,
            bot_nav: HashMap::new(),
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

    pub fn add_bot_player(
        &mut self,
        id: u8,
        name: String,
        character_id: String,
        primary_weapon_id: String,
    ) {
        self.add_player(id, name, character_id, primary_weapon_id);
        if let Some(player) = self.players.get_mut(&id) {
            player.is_bot = true;
            player.is_zombie = false;
        }
    }

    pub fn spawn_zombie(&mut self, id: u8, spawn_index: usize, wave: u16) {
        let spawn = self.map.spawns[spawn_index % self.map.spawns.len()];
        let max_hp = 65 + wave.saturating_mul(10);
        self.add_player(
            id,
            "Zombie".to_string(),
            "zombie".to_string(),
            "zombie_claws".to_string(),
        );
        if let Some(player) = self.players.get_mut(&id) {
            player.is_bot = true;
            player.is_zombie = true;
            player.color = [80, 200, 60];
            player.spawn_index = spawn_index;
            player.x = spawn
                .0
                .clamp(PLAYER_RADIUS, self.config.width - PLAYER_RADIUS);
            player.y = spawn
                .1
                .clamp(PLAYER_RADIUS, self.config.height - PLAYER_RADIUS);
            player.max_hp = max_hp;
            player.hp = max_hp;
            player.secondary = None;
            player.active_slot = ActiveSlot::Primary;
            player.apply_active_slot_to_combat_state();
        }
    }

    pub fn remove_zombies(&mut self) {
        let zombie_ids: Vec<u8> = self
            .players
            .values()
            .filter(|player| player.is_zombie)
            .map(|player| player.id)
            .collect();
        for id in zombie_ids {
            self.remove_player(id);
        }
    }

    pub fn bot_character_for_index(index: usize) -> &'static str {
        BOT_CHARACTERS[index % BOT_CHARACTERS.len()]
    }

    pub fn remove_player(&mut self, id: u8) {
        self.players.remove(&id);
        self.inputs.remove(&id);
        self.bot_nav.remove(&id);
    }

    pub fn set_input(&mut self, id: u8, input: InputSnapshot) {
        self.inputs.insert(id, input);
    }

    pub fn reset_for_match(
        &mut self,
        score_limit: u16,
        time_limit_secs: u16,
        win_condition: WinCondition,
        gamemode: Gamemode,
        friendly_fire: bool,
        fog_of_war: bool,
        wave_goal: u16,
    ) {
        self.remove_zombies();
        self.tick = 0;
        self.bullets.clear();
        self.effects.clear();
        self.kill_feed.clear();
        self.next_effect_id = 1;
        self.score_limit = score_limit;
        self.time_limit_secs = time_limit_secs;
        self.match_elapsed = 0.0;
        self.win_condition = win_condition;
        self.gamemode = gamemode;
        self.friendly_fire = if gamemode == Gamemode::ZombieHorde {
            false
        } else {
            friendly_fire
        };
        self.fog_of_war = fog_of_war;
        self.match_ended = false;
        self.winner_id = None;
        self.match_end_reason = None;
        self.next_bullet_id = 1;
        self.weapon_pickups.clear();
        self.next_pickup_id = 1;
        self.input_prev.clear();
        self.wave = 0;
        self.zombies_remaining = 0;
        self.wave_state = WaveState::Intermission;
        self.horde_spawn_queue.clear();
        self.next_zombie_id = ZOMBIE_ID_START;
        self.wave_goal = wave_goal;
        self.bot_nav.clear();

        let ids: Vec<u8> = self
            .players
            .keys()
            .copied()
            .filter(|id| !self.players[id].is_zombie)
            .collect();
        for id in ids {
            if let Some(player) = self.players.get_mut(&id) {
                player.score = 0;
                player.kills = 0;
                player.deaths = 0;
                player.ability_charge = 0.0;
                player.ability_windup = 0.0;
                player.pending_character_id = None;
                player.directors_cut_until = 0.0;
                player.directors_cut_shots = 0;
            }
            self.reset_player_for_spawn(id, SPAWN_PROTECTION_TIME);
        }

        if gamemode == Gamemode::ZombieHorde {
            self.wave_intermission_timer = HORDE_INITIAL_DELAY;
        } else {
            self.wave_intermission_timer = 0.0;
        }
    }

    pub fn reset_for_lobby(&mut self) {
        self.remove_zombies();
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
        self.wave = 0;
        self.zombies_remaining = 0;
        self.wave_state = WaveState::Intermission;
        self.wave_intermission_timer = 0.0;
        self.horde_spawn_queue.clear();
        self.next_zombie_id = ZOMBIE_ID_START;
        self.wave_goal = 0;
        self.bot_nav.clear();

        let ids: Vec<u8> = self
            .players
            .keys()
            .copied()
            .filter(|id| !self.players[id].is_zombie)
            .collect();
        for id in ids {
            if let Some(player) = self.players.get_mut(&id) {
                player.pending_character_id = None;
            }
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
            player.apply_pending_character();
            player.x = spawn.0;
            player.y = spawn.1;
            player.max_hp = max_hp_for_character(&player.character_id);
            player.hp = player.max_hp;
            if is_luca_character(&player.character_id) {
                strip_player_weapons(player);
            } else {
                player.primary = Some(weapons::primary_slot_for(&player.loadout_primary_weapon_id));
                player.secondary = None;
                player.active_slot = ActiveSlot::Primary;
                player.apply_active_slot_to_combat_state();
            }
            player.alive = true;
            player.fire_cooldown = 0.0;
            player.reload_timer = 0.0;
            player.respawn_timer = 0.0;
            player.spawn_protection = spawn_protection;
            player.controls_inverted_until = 0.0;
            player.slowed_until = 0.0;
            player.slow_multiplier = 1.0;
            player.marked_until = 0.0;
            player.mark_damage_multiplier = 1.0;
            player.poison_until = 0.0;
            player.poison_dps = 0;
            player.poison_owner_id = 0;
            player.poison_accumulator = 0.0;
            player.ability_windup = 0.0;
            player.directors_cut_until = 0.0;
            player.directors_cut_shots = 0;
            player.stillness_timer = 0.0;
            player.stillness_stacks = 0;
            player.last_shot_timer = 999.0;
            player.reel_shield_remaining = 0.0;
            player.reel_shield_hp = 0.0;
            player.boat_mode_until = 0.0;
            player.boat_rammed.clear();
            player.hangover_until = 0.0;
            player.reel_index = 0;
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
        if !player.alive || is_casting(player) || is_luca_character(&player.character_id) {
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
            if !player.alive || is_casting(player) || is_luca_character(&player.character_id) {
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
            if !player.alive || is_casting(player) || is_luca_character(&player.character_id) {
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
        self.gamemode = snapshot.gamemode;
        self.match_end_reason = snapshot.match_end_reason;
        self.fog_of_war = snapshot.fog_of_war;
        self.kill_feed = snapshot.kill_feed.clone();
        self.wave = snapshot.wave;
        self.zombies_remaining = snapshot.zombies_remaining;
        self.wave_state = snapshot.wave_state;
        self.wave_intermission_timer = snapshot.wave_intermission_secs;
        self.wave_goal = snapshot.wave_goal;
        self.bullets = snapshot
            .bullets
            .iter()
            .map(|bullet| {
                let (damage, radius, life, bounces_remaining) =
                    if bullet.weapon_id == abilities::POPCORN_WEAPON_ID {
                        (
                            abilities::POPCORN_DAMAGE,
                            abilities::POPCORN_RADIUS,
                            abilities::POPCORN_LIFE,
                            abilities::POPCORN_BOUNCES,
                        )
                    } else {
                        let weapon = weapons::get_or_default(&bullet.weapon_id);
                        (weapon.damage, weapon.bullet_radius, weapon.bullet_life, 0)
                    };
                Bullet {
                    id: bullet.id,
                    owner_id: bullet.owner_id,
                    weapon_id: bullet.weapon_id.clone(),
                    damage,
                    radius,
                    x: bullet.x,
                    y: bullet.y,
                    vx: 0.0,
                    vy: 0.0,
                    life,
                    bounces_remaining,
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

        abilities::passive_charge_tick(&mut self.players, &self.inputs, dt, self.dev_mode);
        abilities::tick_status_effects(&mut self.players, dt);
        abilities::tick_character_passives(&mut self.players, &self.inputs, dt);
        self.tick_poison_damage(dt);
        self.process_ability_input();
        abilities::process_abilities(self, dt);
        abilities::process_active_modes(self, dt);
        abilities::process_projectile_effects(self, dt);
        abilities::process_effects(self, dt);
        self.process_horde(dt);
        self.process_respawns(dt);
        self.process_movement(dt);
        self.process_weapon_interactions();
        self.process_combat(dt);
        self.process_bullets(dt);
        self.check_match_end();
    }

    fn process_respawns(&mut self, dt: f32) {
        if self.gamemode == Gamemode::LastMateStanding {
            return;
        }

        let respawning: Vec<u8> = self
            .players
            .values()
            .filter(|player| !player.alive && !player.is_zombie)
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
            let input = apply_hack_inversion(player, &input);
            let (move_x, move_y) = normalize(input.dx, input.dy);

            let speed = if player.slowed_until > 0.0 {
                PLAYER_SPEED * player.slow_multiplier
            } else if abilities::in_boat_mode(player) {
                PLAYER_SPEED * abilities::FINN_BOAT_SPEED_MULT
            } else if player.hangover_until > 0.0 {
                PLAYER_SPEED * abilities::FINN_HANGOVER_SPEED_MULT
            } else if abilities::in_directors_cut(player) {
                PLAYER_SPEED * abilities::JACOB_DIRECTORS_CUT_SPEED
            } else if player.is_zombie {
                PLAYER_SPEED * ZOMBIE_SPEED_MULT
            } else if is_luca_character(&player.character_id) {
                PLAYER_SPEED * LUCA_SPEED_MULT
            } else {
                PLAYER_SPEED
            };

            let next_x = (player.x + move_x * speed * dt)
                .clamp(PLAYER_RADIUS, self.config.width - PLAYER_RADIUS);
            if !circle_hits_walls(next_x, player.y, PLAYER_RADIUS, &self.map.walls) {
                player.x = next_x;
            }

            let next_y = (player.y + move_y * speed * dt)
                .clamp(PLAYER_RADIUS, self.config.height - PLAYER_RADIUS);
            if !circle_hits_walls(player.x, next_y, PLAYER_RADIUS, &self.map.walls) {
                player.y = next_y;
            }

            if input.aim_x != 0.0 || input.aim_y != 0.0 {
                player.angle = input.aim_y.atan2(input.aim_x);
            }
        }

        abilities::process_boat_rams(self);
    }

    fn process_horde(&mut self, dt: f32) {
        if self.gamemode != Gamemode::ZombieHorde || self.match_ended {
            return;
        }

        self.process_horde_spawns(dt);

        match self.wave_state {
            WaveState::Intermission => {
                self.wave_intermission_timer -= dt;
                if self.wave_intermission_timer <= 0.0 && self.horde_spawn_queue.is_empty() {
                    self.start_next_horde_wave();
                }
            }
            WaveState::Active => {
                if self.zombies_remaining == 0
                    && self.horde_spawn_queue.is_empty()
                    && !self.has_living_zombies()
                {
                    if self.wave_goal > 0 && self.wave >= self.wave_goal {
                        self.match_ended = true;
                        self.winner_id = self.leading_human_id();
                        self.match_end_reason = Some(MatchEndReason::Score);
                        return;
                    }
                    self.wave_state = WaveState::Intermission;
                    self.wave_intermission_timer = HORDE_INTERMISSION_SECS;
                }
            }
        }
    }

    fn process_horde_spawns(&mut self, dt: f32) {
        if self.horde_spawn_queue.is_empty() {
            return;
        }

        let mut ready = Vec::new();
        for (index, (delay, spawn_index)) in self.horde_spawn_queue.iter_mut().enumerate() {
            *delay -= dt;
            if *delay <= 0.0 {
                ready.push((index, *spawn_index));
            }
        }

        for (index, spawn_index) in ready.into_iter().rev() {
            self.horde_spawn_queue.remove(index);
            let id = self.next_zombie_id;
            if id >= 250 {
                continue;
            }
            self.next_zombie_id = id.saturating_add(1);
            self.spawn_zombie(id, spawn_index, self.wave);
        }
    }

    fn start_next_horde_wave(&mut self) {
        self.wave = self.wave.saturating_add(1);
        let count = HORDE_BASE_ZOMBIES + self.wave.saturating_mul(HORDE_WAVE_SCALE);
        self.zombies_remaining = count;
        self.wave_state = WaveState::Active;
        self.horde_spawn_queue = (0..count)
            .map(|index| (index as f32 * HORDE_SPAWN_STAGGER_SECS, index as usize))
            .collect();
    }

    fn has_living_zombies(&self) -> bool {
        self.players
            .values()
            .any(|player| player.is_zombie && player.alive)
    }

    fn handle_zombie_killed(&mut self, killer_id: u8, victim_id: u8) {
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
                .unwrap_or_else(|| "Zombie".to_string());
            (killer_name, victim_name)
        };

        if let Some(killer) = self.players.get_mut(&killer_id) {
            if !killer.is_zombie {
                killer.kills += 1;
                killer.score += 1;
                abilities::add_charge(killer, abilities::CHARGE_ON_KILL);
            }
        }

        self.remove_player(victim_id);
        self.zombies_remaining = self.zombies_remaining.saturating_sub(1);

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

    fn leading_human_id(&self) -> Option<u8> {
        self.players
            .values()
            .filter(|player| !player.is_zombie)
            .max_by(|a, b| {
                a.score
                    .cmp(&b.score)
                    .then(a.kills.cmp(&b.kills))
                    .then(b.deaths.cmp(&a.deaths))
                    .then(a.id.cmp(&b.id))
            })
            .map(|player| player.id)
    }

    fn humans_eliminated(&self) -> bool {
        let humans: Vec<_> = self
            .players
            .values()
            .filter(|player| !player.is_zombie)
            .collect();
        if humans.is_empty() {
            return false;
        }
        !humans.iter().any(|player| player.alive)
            && !humans
                .iter()
                .any(|player| !player.alive && player.respawn_timer > 0.0)
    }

    fn damage_allowed(&self, owner_id: u8, victim_id: u8) -> bool {
        if self.friendly_fire {
            return true;
        }
        let Some(owner) = self.players.get(&owner_id) else {
            return false;
        };
        let Some(victim) = self.players.get(&victim_id) else {
            return false;
        };
        // When FF is off: block human-vs-human, allow human↔zombie (horde co-op).
        owner.is_zombie != victim.is_zombie
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
            if !pressed && was_pressed {
                abilities::try_release(self, id);
            }
            self.ability_held.insert(id, pressed);
        }
    }

    fn tick_poison_damage(&mut self, dt: f32) {
        if !self.friendly_fire {
            return;
        }

        let mut damage_events: Vec<(u8, u8, u16)> = Vec::new();
        for player in self.players.values_mut() {
            if !player.alive || player.poison_until <= 0.0 || player.poison_dps == 0 {
                continue;
            }
            player.poison_until = (player.poison_until - dt).max(0.0);
            player.poison_accumulator += player.poison_dps as f32 * dt;
            let damage = player.poison_accumulator.floor() as u16;
            if damage > 0 {
                player.poison_accumulator -= damage as f32;
                damage_events.push((player.poison_owner_id, player.id, damage));
            }
            if player.poison_until <= 0.0 {
                player.poison_dps = 0;
                player.poison_accumulator = 0.0;
            }
        }

        for (killer_id, victim_id, damage) in damage_events {
            self.apply_damage(killer_id, victim_id, damage);
        }
    }

    fn process_combat(&mut self, dt: f32) {
        let mut shots: Vec<(u8, String, u16, f32, f32, f32, f32, f32, f32, f32)> = Vec::new();
        let mut melee_swings: Vec<(u8, String, u16, f32, f32, f32, f32, f32, f32)> = Vec::new();
        let mut reload_requests: Vec<(u8, f32)> = Vec::new();
        let mut popcorn_shots: Vec<(u8, f32, f32, f32, f32)> = Vec::new();

        for player in self.players.values_mut() {
            if !player.alive || is_casting(player) {
                continue;
            }
            if player.fire_cooldown > 0.0 {
                player.fire_cooldown = (player.fire_cooldown - dt).max(0.0);
            }
        }

        for player in self.players.values() {
            if !player.alive || is_casting(player) || !abilities::in_directors_cut(player) {
                continue;
            }
            let input = self.inputs.get(&player.id).cloned().unwrap_or_default();
            let input = apply_hack_inversion(player, &input);
            if input.fire && player.fire_cooldown <= 0.0 {
                let (aim_x, aim_y) = normalize(input.aim_x, input.aim_y);
                if aim_x != 0.0 || aim_y != 0.0 {
                    popcorn_shots.push((player.id, player.x, player.y, aim_x, aim_y));
                }
            }
        }

        for (player_id, x, y, aim_x, aim_y) in popcorn_shots {
            if abilities::try_fire_popcorn(self, player_id, x, y, aim_x, aim_y) {
                if let Some(player) = self.players.get_mut(&player_id) {
                    player.fire_cooldown = abilities::POPCORN_FIRE_RATE;
                }
            }
        }

        for player in self.players.values_mut() {
            if !player.alive || is_casting(player) || abilities::in_boat_mode(player) {
                continue;
            }
            if player.hangover_until > 0.0 {
                continue;
            }

            if !player.has_active_weapon() {
                continue;
            }

            let weapon = player.active_weapon();
            if weapon.can_reload() && player.reload_timer > 0.0 {
                player.reload_timer = (player.reload_timer - dt).max(0.0);
                if player.reload_timer <= 0.0 {
                    player.ammo = player.max_ammo;
                    player.save_ammo_to_active_slot();
                }
                continue;
            }

            let input = self.inputs.get(&player.id).cloned().unwrap_or_default();
            let input = apply_hack_inversion(player, &input);

            if weapon.can_reload() && input.reload && player.ammo < player.max_ammo {
                reload_requests.push((player.id, weapon.reload_time));
                continue;
            }

            if !input.fire || player.fire_cooldown > 0.0 {
                continue;
            }

            let (aim_x, aim_y) = normalize(input.aim_x, input.aim_y);
            if aim_x == 0.0 && aim_y == 0.0 {
                continue;
            }

            match weapon.kind {
                weapons::WeaponKind::Melee { range, arc_deg } => {
                    player.fire_cooldown = weapon.fire_rate;
                    melee_swings.push((
                        player.id,
                        weapon.id.to_string(),
                        weapon.damage,
                        player.x,
                        player.y,
                        aim_x,
                        aim_y,
                        range,
                        arc_deg,
                    ));
                }
                weapons::WeaponKind::Pellets { count, spread_deg } => {
                    if player.ammo == 0 {
                        reload_requests.push((player.id, weapon.reload_time));
                        continue;
                    }
                    player.ammo -= 1;
                    player.save_ammo_to_active_slot();
                    player.fire_cooldown = weapon.fire_rate;
                    abilities::notify_shot(player);

                    let spawn_x = player.x + aim_x * (PLAYER_RADIUS + weapon.muzzle_offset);
                    let spawn_y = player.y + aim_y * (PLAYER_RADIUS + weapon.muzzle_offset);
                    for (dir_x, dir_y) in
                        weapons::pellet_directions(aim_x, aim_y, count, spread_deg)
                    {
                        shots.push((
                            player.id,
                            weapon.id.to_string(),
                            weapon.damage,
                            weapon.bullet_speed,
                            weapon.bullet_life,
                            weapon.bullet_radius,
                            spawn_x,
                            spawn_y,
                            dir_x,
                            dir_y,
                        ));
                    }
                }
                weapons::WeaponKind::Bullet => {
                    if player.ammo == 0 {
                        reload_requests.push((player.id, weapon.reload_time));
                        continue;
                    }
                    player.ammo -= 1;
                    player.save_ammo_to_active_slot();
                    player.fire_cooldown = weapon.fire_rate;
                    abilities::notify_shot(player);

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
            }
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
                bounces_remaining: 0,
            });
        }

        for (owner_id, weapon_id, damage, x, y, aim_x, aim_y, range, arc_deg) in melee_swings {
            let candidates: Vec<(u8, f32, f32)> = self
                .players
                .values()
                .filter(|player| {
                    player.alive
                        && player.id != owner_id
                        && !player.spawn_protected()
                        && self.damage_allowed(owner_id, player.id)
                })
                .map(|player| (player.id, player.x, player.y))
                .collect();
            let targets = weapons::melee_targets(x, y, aim_x, aim_y, range, arc_deg, &candidates);
            let hit_x = x + aim_x * range * 0.55;
            let hit_y = y + aim_y * range * 0.55;

            let id = self.next_effect_id;
            self.next_effect_id += 1;
            self.effects.push(WorldEffect::burst(
                id,
                EffectKind::Slash,
                hit_x,
                hit_y,
                range * 0.65,
                0.18,
                owner_id,
            ));

            for victim_id in targets {
                self.apply_weapon_on_hit(owner_id, victim_id, &weapon_id, hit_x, hit_y, 0.0, 0.0);
                self.apply_damage(owner_id, victim_id, damage);
                break;
            }
        }
    }

    fn process_bullets(&mut self, dt: f32) {
        let mut hits: Vec<(u32, u8, u8, u16, String, f32, f32, f32, f32)> = Vec::new();
        let mut wall_hits: Vec<(f32, f32, f32, f32, f32, u8)> = Vec::new();
        let mut shield_hits: Vec<(u8, u16, f32, f32)> = Vec::new();
        let mut surviving = Vec::with_capacity(self.bullets.len());
        let shields: Vec<(u8, f32, f32, f32)> = self
            .players
            .values()
            .filter(|player| player.alive && abilities::has_reel_shield(player))
            .map(|player| (player.id, player.x, player.y, player.reel_shield_angle))
            .collect();

        for mut bullet in self.bullets.drain(..) {
            let prev_x = bullet.x;
            let prev_y = bullet.y;
            bullet.life -= dt;
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;

            if bullet.life <= 0.0 {
                continue;
            }
            if let Some((owner_id, cx, cy)) = abilities::check_shield_block_with(
                &shields,
                bullet.owner_id,
                prev_x,
                prev_y,
                bullet.x,
                bullet.y,
            ) {
                shield_hits.push((owner_id, bullet.damage, cx, cy));
                continue;
            }
            if bullet.x < 0.0
                || bullet.y < 0.0
                || bullet.x > self.config.width
                || bullet.y > self.config.height
            {
                continue;
            }
            if circle_hits_walls(bullet.x, bullet.y, bullet.radius, &self.map.walls) {
                let (impact_x, impact_y) = wall_impact_point(
                    prev_x,
                    prev_y,
                    bullet.x,
                    bullet.y,
                    bullet.vx,
                    bullet.vy,
                    bullet.radius,
                    &self.map.walls,
                );
                if bullet.weapon_id == abilities::POPCORN_WEAPON_ID && bullet.bounces_remaining > 0
                {
                    if let Some((nx, ny)) = wall_normal_at(
                        impact_x,
                        impact_y,
                        bullet.vx,
                        bullet.vy,
                        bullet.radius,
                        &self.map.walls,
                    ) {
                        bullet.bounces_remaining -= 1;
                        let (vx, vy) = abilities::deflect_popcorn(
                            bullet.vx,
                            bullet.vy,
                            nx,
                            ny,
                            bullet.id ^ bullet.bounces_remaining as u32,
                        );
                        bullet.vx = vx;
                        bullet.vy = vy;
                        bullet.x = impact_x;
                        bullet.y = impact_y;
                        surviving.push(bullet);
                        continue;
                    }
                }
                wall_hits.push((
                    impact_x,
                    impact_y,
                    bullet.vx,
                    bullet.vy,
                    bullet.radius,
                    bullet.owner_id,
                ));
                continue;
            }
            surviving.push(bullet);
        }
        self.bullets = surviving;

        for (owner_id, damage, cx, cy) in shield_hits {
            abilities::apply_shield_block(self, owner_id, damage, cx, cy);
        }

        for (impact_x, impact_y, vx, vy, radius, owner_id) in wall_hits {
            let id = self.next_effect_id;
            self.next_effect_id += 1;
            let speed = (vx * vx + vy * vy).sqrt().max(1.0);
            let mut effect = WorldEffect::burst(
                id,
                EffectKind::WallHit,
                impact_x,
                impact_y,
                radius.max(6.0),
                0.22,
                owner_id,
            );
            effect.target_x = vx / speed;
            effect.target_y = vy / speed;
            self.effects.push(effect);
        }

        for bullet in &self.bullets {
            for player in self.players.values() {
                if !player.alive || player.spawn_protected() || player.id == bullet.owner_id {
                    continue;
                }
                if !self.damage_allowed(bullet.owner_id, player.id) {
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
                    hits.push((
                        bullet.id,
                        bullet.owner_id,
                        player.id,
                        bullet.damage,
                        bullet.weapon_id.clone(),
                        bullet.x,
                        bullet.y,
                        bullet.vx,
                        bullet.vy,
                    ));
                    break;
                }
            }
        }

        if hits.is_empty() {
            return;
        }

        let hit_bullet_ids: std::collections::HashSet<u32> = hits
            .iter()
            .map(|(bullet_id, _, _, _, _, _, _, _, _)| *bullet_id)
            .collect();
        self.bullets
            .retain(|bullet| !hit_bullet_ids.contains(&bullet.id));

        for (
            _,
            killer_id,
            victim_id,
            damage,
            weapon_id,
            hit_x,
            hit_y,
            knockback_vx,
            knockback_vy,
        ) in hits
        {
            if weapon_id == abilities::POPCORN_WEAPON_ID {
                self.apply_popcorn_hit(killer_id, victim_id, hit_x, hit_y);
            } else {
                self.apply_weapon_on_hit(
                    killer_id,
                    victim_id,
                    &weapon_id,
                    hit_x,
                    hit_y,
                    knockback_vx,
                    knockback_vy,
                );
            }
            self.apply_damage(killer_id, victim_id, damage);
            let weapon = weapons::get_or_default(&weapon_id);
            if weapon.splash_radius > 0.0 && weapon.splash_damage > 0 {
                self.apply_splash_damage(
                    killer_id,
                    victim_id,
                    hit_x,
                    hit_y,
                    weapon.splash_radius,
                    weapon.splash_damage,
                );
            }
        }
    }

    fn apply_splash_damage(
        &mut self,
        owner_id: u8,
        primary_victim_id: u8,
        x: f32,
        y: f32,
        radius: f32,
        damage: u16,
    ) {
        if !self.friendly_fire {
            return;
        }

        let id = self.next_effect_id;
        self.next_effect_id += 1;
        self.effects.push(WorldEffect::burst(
            id,
            EffectKind::Zap,
            x,
            y,
            radius,
            0.28,
            owner_id,
        ));

        let victims: Vec<u8> = self
            .players
            .values()
            .filter(|player| {
                player.alive
                    && !player.spawn_protected()
                    && player.id != owner_id
                    && player.id != primary_victim_id
                    && circle_hits_circle(player.x, player.y, PLAYER_RADIUS, x, y, radius)
            })
            .map(|player| player.id)
            .collect();

        for victim_id in victims {
            self.apply_damage(owner_id, victim_id, damage);
        }
    }

    fn apply_popcorn_hit(&mut self, owner_id: u8, victim_id: u8, hit_x: f32, hit_y: f32) {
        let Some(victim) = self.players.get_mut(&victim_id) else {
            return;
        };
        if !victim.alive {
            return;
        }
        victim.marked_until = abilities::POPCORN_MARK_DURATION;
        victim.mark_damage_multiplier = abilities::POPCORN_MARK_DAMAGE_MULT;

        let id = self.next_effect_id;
        self.next_effect_id += 1;
        self.effects.push(WorldEffect::burst(
            id,
            EffectKind::Mark,
            hit_x,
            hit_y,
            32.0,
            0.4,
            owner_id,
        ));
    }

    fn apply_weapon_on_hit(
        &mut self,
        owner_id: u8,
        victim_id: u8,
        weapon_id: &str,
        hit_x: f32,
        hit_y: f32,
        knockback_vx: f32,
        knockback_vy: f32,
    ) {
        let weapon = weapons::get_or_default(weapon_id);
        let Some(victim) = self.players.get_mut(&victim_id) else {
            return;
        };
        if !victim.alive {
            return;
        }

        let vfx = weapons::apply_on_hit(
            weapon.on_hit,
            &mut weapons::HitStatusApply {
                slowed_until: &mut victim.slowed_until,
                slow_multiplier: &mut victim.slow_multiplier,
                marked_until: &mut victim.marked_until,
                mark_damage_multiplier: &mut victim.mark_damage_multiplier,
                poison_until: &mut victim.poison_until,
                poison_dps: &mut victim.poison_dps,
            },
        );

        if matches!(weapon.on_hit, weapons::WeaponOnHit::Poison { .. }) {
            victim.poison_owner_id = owner_id;
            victim.poison_accumulator = 0.0;
        }

        if let weapons::WeaponOnHit::Knockback { impulse } = weapon.on_hit {
            let (dir_x, dir_y) = if knockback_vx != 0.0 || knockback_vy != 0.0 {
                normalize(knockback_vx, knockback_vy)
            } else {
                normalize(victim.x - hit_x, victim.y - hit_y)
            };
            let next_x = (victim.x + dir_x * impulse)
                .clamp(PLAYER_RADIUS, self.config.width - PLAYER_RADIUS);
            let next_y = (victim.y + dir_y * impulse)
                .clamp(PLAYER_RADIUS, self.config.height - PLAYER_RADIUS);
            if !circle_hits_walls(next_x, victim.y, PLAYER_RADIUS, &self.map.walls) {
                victim.x = next_x;
            }
            if !circle_hits_walls(victim.x, next_y, PLAYER_RADIUS, &self.map.walls) {
                victim.y = next_y;
            }
        }

        let effect_kind = match vfx {
            weapons::HitVfxKind::None => return,
            weapons::HitVfxKind::Splat => EffectKind::Splat,
            weapons::HitVfxKind::Mark => EffectKind::Mark,
            weapons::HitVfxKind::Poison => EffectKind::Poison,
            weapons::HitVfxKind::Zap => EffectKind::Zap,
            weapons::HitVfxKind::Slash => EffectKind::Slash,
        };

        let id = self.next_effect_id;
        self.next_effect_id += 1;
        self.effects.push(WorldEffect::burst(
            id,
            effect_kind,
            hit_x,
            hit_y,
            28.0,
            0.35,
            owner_id,
        ));
    }

    pub(crate) fn apply_damage(&mut self, killer_id: u8, victim_id: u8, damage: u16) {
        let is_zombie = self
            .players
            .get(&victim_id)
            .is_some_and(|player| player.is_zombie);

        let died = {
            let Some(victim) = self.players.get_mut(&victim_id) else {
                return;
            };
            if !victim.alive || victim.spawn_protected() {
                return;
            }
            let multiplier = if victim.marked_until > 0.0 {
                victim.mark_damage_multiplier
            } else {
                1.0
            };
            let hack_mult = if victim.controls_inverted_until > 0.0 {
                abilities::SONNY_HACK_DAMAGE_MULT
            } else {
                1.0
            };
            let adjusted = ((damage as f32) * multiplier * hack_mult)
                .round()
                .clamp(1.0, f32::from(u16::MAX)) as u16;
            victim.hp = victim.hp.saturating_sub(adjusted);
            victim.hp == 0
        };

        if !died {
            if let Some(killer) = self.players.get_mut(&killer_id) {
                abilities::add_charge(killer, abilities::CHARGE_ON_DAMAGE);
            }
            return;
        }

        if is_zombie {
            self.handle_zombie_killed(killer_id, victim_id);
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
            victim.directors_cut_until = 0.0;
            victim.directors_cut_shots = 0;
            victim.reel_shield_remaining = 0.0;
            victim.reel_shield_hp = 0.0;
            victim.boat_mode_until = 0.0;
            victim.boat_rammed.clear();
            victim.hangover_until = 0.0;
        }

        if let Some(killer) = self.players.get_mut(&killer_id) {
            killer.kills += 1;
            killer.score += 1;
            abilities::add_charge(killer, abilities::CHARGE_ON_KILL);
            if killer.character_id == "bailey" {
                abilities::add_charge(killer, abilities::BAILEY_CHARGE_ON_KILL);
            }
            abilities::on_ability_kill(killer);
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

        if self.gamemode == Gamemode::ZombieHorde {
            if self.humans_eliminated() {
                self.match_ended = true;
                self.winner_id = None;
                self.match_end_reason = Some(MatchEndReason::Score);
                return;
            }

            let time_win =
                self.time_limit_secs > 0 && self.match_elapsed >= self.time_limit_secs as f32;
            if time_win {
                self.match_ended = true;
                self.match_end_reason = Some(MatchEndReason::Time);
                self.winner_id = self.leading_human_id();
            }
            return;
        }

        if self.gamemode == Gamemode::LastMateStanding {
            let contenders: Vec<_> = self
                .players
                .values()
                .filter(|player| !player.is_zombie)
                .collect();
            if contenders.len() >= 2 {
                let any_eliminated = contenders.iter().any(|player| !player.alive);
                let alive: Vec<u8> = contenders
                    .iter()
                    .filter(|player| player.alive)
                    .map(|player| player.id)
                    .collect();
                if any_eliminated && alive.len() <= 1 {
                    self.match_ended = true;
                    self.winner_id = alive.first().copied();
                    self.match_end_reason = Some(MatchEndReason::Score);
                    return;
                }
            }

            let time_win =
                self.time_limit_secs > 0 && self.match_elapsed >= self.time_limit_secs as f32;
            if time_win {
                self.match_ended = true;
                self.match_end_reason = Some(MatchEndReason::Time);
                self.winner_id = self.leading_player_id();
            }
            return;
        }

        let score_win = self.score_limit > 0
            && self
                .players
                .values()
                .filter(|player| !player.is_zombie)
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
            .filter(|player| !player.is_zombie)
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
            gamemode: self.gamemode,
            match_end_reason: self.match_end_reason,
            fog_of_war: self.fog_of_war,
            weapon_pickups: self
                .weapon_pickups
                .iter()
                .map(WeaponPickup::snapshot)
                .collect(),
            wave: self.wave,
            zombies_remaining: self.zombies_remaining,
            wave_state: self.wave_state,
            wave_intermission_secs: self.wave_intermission_timer.max(0.0),
            wave_goal: self.wave_goal,
        }
    }
}

fn apply_hack_inversion(player: &Player, input: &InputSnapshot) -> InputSnapshot {
    if player.controls_inverted_until <= 0.0 {
        return input.clone();
    }

    InputSnapshot {
        dx: -input.dx,
        dy: -input.dy,
        aim_x: -input.aim_x,
        aim_y: -input.aim_y,
        ..input.clone()
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

pub fn wall_impact_point(
    prev_x: f32,
    prev_y: f32,
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
    radius: f32,
    walls: &[Rect],
) -> (f32, f32) {
    for wall in walls {
        if !circle_hits_rect(x, y, radius, wall) {
            continue;
        }
        if !circle_hits_rect(prev_x, prev_y, radius, wall) {
            return ((prev_x + x) * 0.5, (prev_y + y) * 0.5);
        }
        return snap_to_wall_face(x, y, vx, vy, radius, wall);
    }
    (x, y)
}

fn snap_to_wall_face(x: f32, y: f32, vx: f32, vy: f32, radius: f32, wall: &Rect) -> (f32, f32) {
    if vx.abs() >= vy.abs() {
        if vx > 0.0 {
            (
                wall.x - radius,
                y.clamp(wall.y + radius, wall.y + wall.h - radius),
            )
        } else {
            (
                wall.x + wall.w + radius,
                y.clamp(wall.y + radius, wall.y + wall.h - radius),
            )
        }
    } else if vy > 0.0 {
        (
            x.clamp(wall.x + radius, wall.x + wall.w - radius),
            wall.y - radius,
        )
    } else {
        (
            x.clamp(wall.x + radius, wall.x + wall.w - radius),
            wall.y + wall.h + radius,
        )
    }
}

pub fn wall_normal_at(
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
    radius: f32,
    walls: &[Rect],
) -> Option<(f32, f32)> {
    for wall in walls {
        if !circle_hits_rect(x, y, radius, wall) {
            continue;
        }
        if vx.abs() >= vy.abs() {
            if vx > 0.0 {
                return Some((-1.0, 0.0));
            }
            return Some((1.0, 0.0));
        }
        if vy > 0.0 {
            return Some((0.0, -1.0));
        }
        return Some((0.0, 1.0));
    }
    None
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
        world.reset_for_match(
            20,
            0,
            WinCondition::Kills,
            Gamemode::Deathmatch,
            true,
            false,
            0,
        );
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
            bounces_remaining: 0,
        }
    }

    fn test_jacob_player() -> GameWorld {
        let mut world = GameWorld::default();
        world.add_player(
            0,
            "Jacob".to_string(),
            "jacob".to_string(),
            "glock".to_string(),
        );
        world.reset_for_match(
            20,
            0,
            WinCondition::Kills,
            Gamemode::Deathmatch,
            true,
            false,
            0,
        );
        for player in world.players.values_mut() {
            player.spawn_protection = 0.0;
            player.ability_charge = abilities::ABILITY_CHARGE_MAX;
        }
        world
    }

    #[test]
    fn jacob_directors_cut_grants_popcorn_shots() {
        let mut world = test_jacob_player();
        world.inputs.insert(
            0,
            InputSnapshot {
                ability: true,
                ..Default::default()
            },
        );
        world.process_ability_input();
        world.ability_held.insert(0, true);

        let player = world.players.get(&0).unwrap();
        assert_eq!(
            player.directors_cut_shots,
            abilities::JACOB_DIRECTORS_CUT_SHOTS
        );
        assert!(player.directors_cut_until > 0.0);
        assert_eq!(player.ability_charge, 0.0);
    }

    #[test]
    fn popcorn_marks_enemy_on_hit() {
        let mut world = test_world_with_two_players();
        world.players.get_mut(&0).unwrap().character_id = "jacob".to_string();
        let victim_pos = {
            let victim = world.players.get(&1).unwrap();
            (victim.x, victim.y)
        };

        world.bullets.push(Bullet {
            id: 1,
            owner_id: 0,
            weapon_id: abilities::POPCORN_WEAPON_ID.to_string(),
            damage: abilities::POPCORN_DAMAGE,
            radius: abilities::POPCORN_RADIUS,
            x: victim_pos.0 - 12.0,
            y: victim_pos.1,
            vx: 720.0,
            vy: 0.0,
            life: abilities::POPCORN_LIFE,
            bounces_remaining: 0,
        });

        world.process_bullets(1.0 / 60.0);

        let victim = world.players.get(&1).unwrap();
        assert!(victim.marked_until > 0.0);
        assert_eq!(
            victim.mark_damage_multiplier,
            abilities::POPCORN_MARK_DAMAGE_MULT
        );
    }

    #[test]
    fn popcorn_bounces_off_wall() {
        let mut world = GameWorld::default();
        let wall = world
            .map
            .walls
            .iter()
            .find(|wall| wall.w >= 80.0 && wall.h >= 80.0)
            .cloned()
            .expect("interior wall");

        world.bullets.push(Bullet {
            id: 1,
            owner_id: 0,
            weapon_id: abilities::POPCORN_WEAPON_ID.to_string(),
            damage: abilities::POPCORN_DAMAGE,
            radius: abilities::POPCORN_RADIUS,
            x: wall.x - 8.0,
            y: wall.y + wall.h / 2.0,
            vx: 720.0,
            vy: 0.0,
            life: abilities::POPCORN_LIFE,
            bounces_remaining: 3,
        });

        world.process_bullets(1.0 / 60.0);

        assert_eq!(world.bullets.len(), 1);
        let bullet = &world.bullets[0];
        assert_eq!(bullet.bounces_remaining, 2);
        assert!(bullet.life > 0.0);
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
        assert!(world
            .effects
            .iter()
            .any(|effect| effect.kind == EffectKind::WallHit));
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
    fn yoghurt_bullet_applies_slow_on_hit() {
        let mut world = test_world_with_two_players();
        let victim_pos = {
            let victim = world.players.get(&1).unwrap();
            (victim.x, victim.y)
        };
        let weapon = weapons::get_or_default("yoghurt_effect");

        world.bullets.push(Bullet {
            id: 1,
            owner_id: 0,
            weapon_id: weapon.id.to_string(),
            damage: weapon.damage,
            radius: weapon.bullet_radius,
            x: victim_pos.0 - 20.0,
            y: victim_pos.1,
            vx: 720.0,
            vy: 0.0,
            life: weapon.bullet_life,
            bounces_remaining: 0,
        });

        world.process_bullets(1.0 / 60.0);

        let victim = world.players.get(&1).unwrap();
        assert!(victim.slowed_until > 0.0);
        assert_eq!(victim.slow_multiplier, 0.55);
        assert!(!world.effects.is_empty());
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
    fn last_mate_standing_ends_when_one_player_remains() {
        let mut world = test_world_with_two_players();
        world.gamemode = Gamemode::LastMateStanding;
        world.players.get_mut(&1).unwrap().alive = false;

        world.check_match_end();

        assert!(world.match_ended);
        assert_eq!(world.winner_id, Some(0));
    }

    #[test]
    fn last_mate_standing_skips_respawns() {
        let mut world = test_world_with_two_players();
        world.gamemode = Gamemode::LastMateStanding;
        world.players.get_mut(&0).unwrap().alive = false;
        world.players.get_mut(&0).unwrap().respawn_timer = 0.0;

        world.process_respawns(1.0);

        assert!(!world.players.get(&0).unwrap().alive);
    }

    #[test]
    fn last_mate_standing_ignores_score_limit() {
        let mut world = test_world_with_two_players();
        world.gamemode = Gamemode::LastMateStanding;
        world.score_limit = 3;
        world.win_condition = WinCondition::Kills;
        world.players.get_mut(&0).unwrap().score = 5;

        world.check_match_end();

        assert!(!world.match_ended);
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
        use crate::abilities::ABILITY_CHARGE_MAX;

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

        for _ in 0..150 {
            world.tick(1.0 / 60.0);
        }

        let victim = world.players.get(&0).unwrap();
        assert!(victim.hp < PLAYER_MAX_HP);
        assert!(world.effects.iter().any(|effect| {
            effect.kind == EffectKind::TruthExplosion || effect.kind == EffectKind::Explosion
        }));
    }

    #[test]
    fn bailey_truth_nuke_respects_blast_falloff() {
        use crate::abilities::{blast_damage_at_distance, BAILEY_NUKE_DAMAGE, BAILEY_NUKE_RADIUS};

        assert_eq!(
            blast_damage_at_distance(BAILEY_NUKE_DAMAGE, 0.0, BAILEY_NUKE_RADIUS),
            BAILEY_NUKE_DAMAGE
        );
        let edge =
            blast_damage_at_distance(BAILEY_NUKE_DAMAGE, BAILEY_NUKE_RADIUS, BAILEY_NUKE_RADIUS);
        assert!(edge < BAILEY_NUKE_DAMAGE);
        assert!(edge >= 20);
    }

    #[test]
    fn bailey_truth_nuke_damages_even_when_friendly_fire_off() {
        use crate::abilities::ABILITY_CHARGE_MAX;

        let mut world = test_world_with_two_players();
        world.friendly_fire = false;
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

        for _ in 0..150 {
            world.tick(1.0 / 60.0);
        }

        assert!(world.players.get(&0).unwrap().hp < PLAYER_MAX_HP);
    }

    #[test]
    fn sonny_reverse_shell_hacks_nearest_enemy() {
        use crate::abilities::{ABILITY_CHARGE_MAX, SONNY_HACK_DURATION};

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
        assert_eq!(victim.controls_inverted_until, SONNY_HACK_DURATION);
        assert_eq!(world.players.get(&0).unwrap().ability_charge, 18.0);
        assert!(world
            .effects
            .iter()
            .any(|effect| effect.kind == EffectKind::Hack));
    }

    #[test]
    fn apply_hack_inversion_flips_input() {
        let player = {
            let mut world = test_world_with_two_players();
            let player = world.players.remove(&0).unwrap();
            player
        };
        let mut hacked = player.clone();
        hacked.controls_inverted_until = 2.0;
        let input = InputSnapshot {
            dx: 1.0,
            dy: 0.0,
            aim_x: 1.0,
            aim_y: 0.0,
            ..Default::default()
        };

        let flipped = apply_hack_inversion(&hacked, &input);
        assert_eq!(flipped.dx, -1.0);
        assert_eq!(flipped.dy, 0.0);
        assert_eq!(flipped.aim_x, -1.0);
        assert_eq!(flipped.aim_y, 0.0);

        let normal = apply_hack_inversion(&player, &input);
        assert_eq!(normal.dx, 1.0);
        assert_eq!(normal.aim_x, 1.0);
    }

    #[test]
    fn hacked_player_inverts_movement_during_tick() {
        let mut world = test_world_with_two_players();
        {
            let player = world.players.get_mut(&0).unwrap();
            player.controls_inverted_until = 4.0;
            player.x = 960.0;
            player.y = 540.0;
        }

        world.set_input(
            0,
            InputSnapshot {
                dx: 1.0,
                dy: 0.0,
                ..Default::default()
            },
        );
        world.tick(0.1);

        assert!(world.players.get(&0).unwrap().x < 960.0);
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

        world.players.get_mut(&0).unwrap().apply_loadout(
            "bailey".to_string(),
            "glock".to_string(),
            false,
        );

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
    fn apply_loadout_defers_character_change_while_alive_in_match() {
        let mut world = test_world_with_two_players();
        world.players.get_mut(&0).unwrap().apply_loadout(
            "bailey".to_string(),
            "glock".to_string(),
            true,
        );

        let player = world.players.get(&0).unwrap();
        assert_eq!(player.character_id, "sonny");
        assert_eq!(player.pending_character_id.as_deref(), Some("bailey"));

        world.reset_player_for_spawn(0, 0.0);

        let player = world.players.get(&0).unwrap();
        assert_eq!(player.character_id, "bailey");
        assert!(player.pending_character_id.is_none());
    }

    #[test]
    fn apply_loadout_clears_pending_when_reselecting_current_character() {
        let mut world = test_world_with_two_players();
        world.players.get_mut(&0).unwrap().apply_loadout(
            "bailey".to_string(),
            "glock".to_string(),
            true,
        );
        world.players.get_mut(&0).unwrap().apply_loadout(
            "sonny".to_string(),
            "glock".to_string(),
            true,
        );

        let player = world.players.get(&0).unwrap();
        assert_eq!(player.character_id, "sonny");
        assert!(player.pending_character_id.is_none());
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

    #[test]
    fn horde_wave_advances_when_zombies_are_cleared() {
        let mut world = GameWorld::default();
        world.add_player(
            0,
            "Host".to_string(),
            "sonny".to_string(),
            "glock".to_string(),
        );
        world.reset_for_match(
            0,
            0,
            WinCondition::Kills,
            Gamemode::ZombieHorde,
            false,
            false,
            0,
        );
        world.wave_intermission_timer = 0.0;
        world.process_horde(0.0);

        assert_eq!(world.wave, 1);
        assert_eq!(world.wave_state, WaveState::Active);
        assert!(world.zombies_remaining > 0);

        for _ in 0..300 {
            world.process_horde(0.1);
            if let Some(zombie_id) = world
                .players
                .values()
                .find(|player| player.is_zombie && player.alive)
                .map(|player| player.id)
            {
                world.apply_damage(0, zombie_id, PLAYER_MAX_HP * 2);
            }
            if world.zombies_remaining == 0 && !world.has_living_zombies() {
                break;
            }
        }

        assert_eq!(world.zombies_remaining, 0);
        assert!(!world.has_living_zombies());
        world.process_horde(0.0);
        assert_eq!(world.wave_state, WaveState::Intermission);
    }

    #[test]
    fn horde_ends_when_all_humans_are_eliminated() {
        let mut world = GameWorld::default();
        world.add_player(
            0,
            "Host".to_string(),
            "sonny".to_string(),
            "glock".to_string(),
        );
        world.reset_for_match(
            0,
            0,
            WinCondition::Kills,
            Gamemode::ZombieHorde,
            false,
            false,
            0,
        );
        world.players.get_mut(&0).unwrap().alive = false;
        world.players.get_mut(&0).unwrap().respawn_timer = 0.0;

        world.check_match_end();

        assert!(world.match_ended);
        assert_eq!(world.winner_id, None);
    }

    #[test]
    fn horde_wave_goal_ends_match_after_final_wave() {
        let mut world = GameWorld::default();
        world.add_player(
            0,
            "Host".to_string(),
            "sonny".to_string(),
            "glock".to_string(),
        );
        world.reset_for_match(
            0,
            0,
            WinCondition::Kills,
            Gamemode::ZombieHorde,
            false,
            false,
            1,
        );
        world.wave = 1;
        world.wave_state = WaveState::Active;
        world.zombies_remaining = 0;
        world.horde_spawn_queue.clear();

        world.process_horde(0.0);

        assert!(world.match_ended);
        assert_eq!(world.winner_id, Some(0));
    }

    #[test]
    fn zombie_melee_can_damage_humans_when_friendly_fire_is_off() {
        let mut world = GameWorld::default();
        world.add_player(
            0,
            "Host".to_string(),
            "sonny".to_string(),
            "glock".to_string(),
        );
        world.spawn_zombie(200, 0, 1);
        world.friendly_fire = false;
        let victim_hp = world.players.get(&0).unwrap().hp;

        world.apply_damage(200, 0, 20);

        assert!(world.players.get(&0).unwrap().hp < victim_hp);
    }

    #[test]
    fn human_bullets_damage_zombies_when_friendly_fire_is_off() {
        let mut world = GameWorld::default();
        world.add_player(
            0,
            "Host".to_string(),
            "sonny".to_string(),
            "glock".to_string(),
        );
        world.spawn_zombie(200, 0, 1);
        world.friendly_fire = false;
        let zombie_pos = {
            let zombie = world.players.get(&200).unwrap();
            (zombie.x, zombie.y)
        };

        world.bullets.push(test_glock_bullet(
            1,
            0,
            zombie_pos.0 - 20.0,
            zombie_pos.1,
            720.0,
            0.0,
        ));

        world.process_bullets(1.0 / 60.0);

        let zombie = world.players.get(&200).unwrap();
        assert!(zombie.hp < zombie.max_hp);
        assert!(world.bullets.is_empty());
    }

    #[test]
    fn luca_spawns_with_one_hp_and_no_weapons() {
        let mut world = GameWorld::default();
        world.add_player(
            0,
            "Luca".to_string(),
            "luca".to_string(),
            "glock".to_string(),
        );

        let player = world.players.get(&0).unwrap();
        assert_eq!(player.max_hp, LUCA_MAX_HP);
        assert_eq!(player.hp, LUCA_MAX_HP);
        assert!(player.primary.is_none());
        assert!(player.secondary.is_none());
    }

    #[test]
    fn luca_cannot_pick_up_weapons() {
        let mut world = GameWorld::default();
        world.add_player(
            0,
            "Luca".to_string(),
            "luca".to_string(),
            "glock".to_string(),
        );
        world.weapon_pickups.push(WeaponPickup {
            id: 1,
            weapon_id: "glock".to_string(),
            x: world.players.get(&0).unwrap().x,
            y: world.players.get(&0).unwrap().y,
            ammo: 12,
            max_ammo: 12,
        });

        world.inputs.insert(
            0,
            InputSnapshot {
                interact: true,
                ..Default::default()
            },
        );
        world.process_weapon_interactions();

        let player = world.players.get(&0).unwrap();
        assert!(player.primary.is_none());
        assert_eq!(world.weapon_pickups.len(), 1);
    }

    #[test]
    fn luca_loadout_strips_weapons_when_selected() {
        let mut world = GameWorld::default();
        world.add_player(
            0,
            "Host".to_string(),
            "sonny".to_string(),
            "glock".to_string(),
        );
        world.players.get_mut(&0).unwrap().apply_loadout(
            "luca".to_string(),
            "glock".to_string(),
            false,
        );

        let player = world.players.get(&0).unwrap();
        assert_eq!(player.character_id, "luca");
        assert_eq!(player.max_hp, LUCA_MAX_HP);
        assert!(player.primary.is_none());
    }
}
