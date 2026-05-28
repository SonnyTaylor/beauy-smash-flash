use std::collections::HashMap;

use crate::game::WorldEffect;
use crate::game::{
    circle_hits_circle, circle_hits_walls, normalize, GameWorld, Player, Rect, PLAYER_RADIUS,
};
use crate::protocol::{EffectKind, InputSnapshot, WorldEffectSnapshot};

pub const ABILITY_CHARGE_MAX: f32 = 100.0;
pub const CHARGE_ON_KILL: f32 = 25.0;
pub const CHARGE_ON_DAMAGE: f32 = 4.0;
pub const CHARGE_PASSIVE_PER_SEC: f32 = 6.0;
pub const BAILEY_CHARGE_PASSIVE_PER_SEC: f32 = 3.25;
pub const BAILEY_CHARGE_ON_KILL: f32 = 15.0;
pub const TAJ_CHARGE_PASSIVE_IDLE: f32 = 9.0;
pub const TAJ_IDLE_SHOT_THRESHOLD: f32 = 0.5;

pub const BAILEY_AIM_DURATION: f32 = 1.25;
const BAILEY_NUKE_FLIGHT: f32 = 0.9;
const BAILEY_NUKE_ARC_HEIGHT: f32 = 140.0;
const BAILEY_NUKE_RANGE: f32 = 350.0;
pub const BAILEY_NUKE_RADIUS: f32 = 150.0;
pub const BAILEY_NUKE_DAMAGE: u16 = 60;
const BAILEY_NUKE_MIN_FALLOFF: f32 = 0.35;
const BAILEY_NUKE_SLOW_DURATION: f32 = 0.45;
const BAILEY_NUKE_SLOW_MULT: f32 = 0.78;
const TRUTH_EXPLOSION_VFX_LIFE: f32 = 0.65;

pub const SONNY_HACK_RANGE: f32 = 280.0;
pub const SONNY_HACK_DURATION: f32 = 4.0;
pub const SONNY_HACK_DAMAGE_MULT: f32 = 1.3;
const SONNY_HACK_CHARGE_BONUS: f32 = 18.0;
const SONNY_HACK_VFX_LIFE: f32 = 0.55;
const SONNY_MISS_REFUND: f32 = 50.0;

pub const JACOB_DIRECTORS_CUT_DURATION: f32 = 30.0;
pub const JACOB_DIRECTORS_CUT_SHOTS: u8 = 24;
pub const JACOB_DIRECTORS_CUT_SPEED: f32 = 1.67;
pub const POPCORN_WEAPON_ID: &str = "popcorn";
pub const POPCORN_DAMAGE: u16 = 14;
pub const POPCORN_SPEED: f32 = 920.0;
pub const POPCORN_LIFE: f32 = 4.5;
pub const POPCORN_RADIUS: f32 = 8.0;
pub const POPCORN_BOUNCES: u8 = 12;
pub const POPCORN_FIRE_RATE: f32 = 0.11;
pub const POPCORN_MARK_DURATION: f32 = 3.0;
pub const POPCORN_MARK_DAMAGE_MULT: f32 = 1.4;
const POPCORN_INITIAL_SPREAD_DEG: f32 = 6.0;
const POPCORN_BOUNCE_SPREAD_DEG: f32 = 40.0;
const DIRECTORS_CUT_VFX_LIFE: f32 = 0.45;
const DIRECTORS_CUT_KILL_SHOT_REFUND: u8 = 3;

pub const ISAAC_STILLNESS_STACK_TIME: f32 = 1.5;
pub const ISAAC_MAX_STILLNESS_STACKS: u8 = 3;
pub const ISAAC_CHI_WINDUP: f32 = 1.4;
pub const ISAAC_CHI_BASE_DAMAGE: u16 = 55;
pub const ISAAC_CHI_DAMAGE_PER_STACK: u16 = 10;
const ISAAC_CHI_BEAM_HALF_WIDTH: f32 = 14.0;
const ISAAC_CHI_RANGE: f32 = 900.0;
const ISAAC_CHI_SLOW_DURATION: f32 = 1.0;
const ISAAC_CHI_SLOW_MULT: f32 = 0.65;
const ISAAC_CHI_VFX_LIFE: f32 = 0.4;
const ISAAC_CHI_CHANNEL_VFX_LIFE: f32 = 0.25;

pub const TAJ_REEL_COUNT: u8 = 5;

pub const REEL_SHIELD_DURATION: f32 = 5.5;
pub const REEL_SHIELD_HP: f32 = 110.0;
const REEL_SHIELD_HALF_WIDTH: f32 = 58.0;
const REEL_SHIELD_DEPTH: f32 = 16.0;
const REEL_SHIELD_OFFSET: f32 = 44.0;
const REEL_POST_RANGE: f32 = 240.0;
const REEL_POST_DAMAGE: u16 = 32;
const REEL_POST_KNOCKBACK: f32 = 280.0;
const REEL_POST_SLOW_DURATION: f32 = 1.25;
const REEL_POST_SLOW_MULT: f32 = 0.72;
const REEL_POST_CHARGE_REFUND: f32 = 22.0;

pub const FINN_BOAT_DURATION: f32 = 4.0;
pub const FINN_BOAT_SPEED_MULT: f32 = 1.8;
const FINN_RAM_DAMAGE: u16 = 40;
const FINN_RAM_KNOCKBACK: f32 = 320.0;
const FINN_RAM_CHARGE_REFUND: f32 = 22.0;
pub const FINN_HANGOVER_DURATION: f32 = 0.55;
pub const FINN_HANGOVER_SPEED_MULT: f32 = 0.62;
const BOAT_SPLASH_VFX_LIFE: f32 = 0.45;

pub fn add_charge(player: &mut Player, amount: f32) {
    if !player.alive {
        return;
    }
    player.ability_charge = (player.ability_charge + amount).min(ABILITY_CHARGE_MAX);
}

pub fn isaak_chi_damage(stacks: u8) -> u16 {
    ISAAC_CHI_BASE_DAMAGE
        + u16::from(stacks.min(ISAAC_MAX_STILLNESS_STACKS)) * ISAAC_CHI_DAMAGE_PER_STACK
}

pub fn on_ability_kill(killer: &mut Player) {
    if killer.character_id == "jacob" && in_directors_cut(killer) {
        killer.directors_cut_shots = killer
            .directors_cut_shots
            .saturating_add(DIRECTORS_CUT_KILL_SHOT_REFUND)
            .min(JACOB_DIRECTORS_CUT_SHOTS);
    }
}

pub fn notify_shot(player: &mut Player) {
    player.last_shot_timer = 0.0;
}

pub fn in_boat_mode(player: &Player) -> bool {
    player.boat_mode_until > 0.0
}

pub fn has_reel_shield(player: &Player) -> bool {
    player.reel_shield_remaining > 0.0 && player.reel_shield_hp > 0.0
}

pub fn tick_status_effects(players: &mut HashMap<u8, Player>, dt: f32) {
    for player in players.values_mut() {
        if player.controls_inverted_until > 0.0 {
            player.controls_inverted_until = (player.controls_inverted_until - dt).max(0.0);
        }
        if player.slowed_until > 0.0 {
            player.slowed_until = (player.slowed_until - dt).max(0.0);
            if player.slowed_until <= 0.0 {
                player.slow_multiplier = 1.0;
            }
        }
        if player.marked_until > 0.0 {
            player.marked_until = (player.marked_until - dt).max(0.0);
            if player.marked_until <= 0.0 {
                player.mark_damage_multiplier = 1.0;
            }
        }
        if player.directors_cut_until > 0.0 {
            player.directors_cut_until = (player.directors_cut_until - dt).max(0.0);
            if player.directors_cut_until <= 0.0 || player.directors_cut_shots == 0 {
                end_directors_cut(player);
            }
        }
        if player.hangover_until > 0.0 {
            player.hangover_until = (player.hangover_until - dt).max(0.0);
        }
        player.last_shot_timer += dt;
    }
}

fn end_directors_cut(player: &mut Player) {
    player.directors_cut_until = 0.0;
    player.directors_cut_shots = 0;
}

pub fn in_directors_cut(player: &Player) -> bool {
    player.directors_cut_until > 0.0 && player.directors_cut_shots > 0
}

pub fn passive_charge_tick(
    players: &mut HashMap<u8, Player>,
    inputs: &HashMap<u8, InputSnapshot>,
    dt: f32,
    dev_mode: bool,
) {
    if dev_mode {
        for player in players.values_mut() {
            if !player.alive || player.ability_windup > 0.0 {
                continue;
            }
            // Isaak stillness needs time standing still between blasts — keep normal charge in dev.
            if player.character_id == "isaak" {
                let rate = passive_charge_rate(player, inputs);
                add_charge(player, rate * dt);
            } else {
                player.ability_charge = ABILITY_CHARGE_MAX;
            }
        }
        return;
    }

    for player in players.values_mut() {
        if player.alive && player.ability_windup <= 0.0 {
            let rate = passive_charge_rate(player, inputs);
            add_charge(player, rate * dt);
        }
    }
}

pub fn tick_character_passives(
    players: &mut HashMap<u8, Player>,
    inputs: &HashMap<u8, InputSnapshot>,
    dt: f32,
) {
    for player in players.values_mut() {
        if !player.alive || player.character_id != "isaak" {
            continue;
        }
        let input = inputs.get(&player.id).cloned().unwrap_or_default();
        let moving = input.dx.abs() + input.dy.abs() > 0.05;
        if moving || is_casting(player) || in_boat_mode(player) {
            player.stillness_timer = 0.0;
            continue;
        }
        player.stillness_timer += dt;
        while player.stillness_timer >= ISAAC_STILLNESS_STACK_TIME
            && player.stillness_stacks < ISAAC_MAX_STILLNESS_STACKS
        {
            player.stillness_timer -= ISAAC_STILLNESS_STACK_TIME;
            player.stillness_stacks += 1;
        }
    }
}

fn passive_charge_rate(player: &Player, _inputs: &HashMap<u8, InputSnapshot>) -> f32 {
    match player.character_id.as_str() {
        "bailey" => BAILEY_CHARGE_PASSIVE_PER_SEC,
        "taj" if player.last_shot_timer >= TAJ_IDLE_SHOT_THRESHOLD => TAJ_CHARGE_PASSIVE_IDLE,
        _ => CHARGE_PASSIVE_PER_SEC,
    }
}

pub fn try_activate(world: &mut GameWorld, player_id: u8) {
    let Some(player) = world.players.get(&player_id) else {
        return;
    };
    if !player.alive || player.spawn_protected() || in_boat_mode(player) {
        return;
    }

    if player.character_id == "taj" && has_reel_shield(player) {
        post_taj_reel_shield(world, player_id);
        return;
    }

    if player.ability_charge < ABILITY_CHARGE_MAX || player.ability_windup > 0.0 {
        return;
    }

    let character_id = player.character_id.clone();
    let (x, y) = (player.x, player.y);

    match character_id.as_str() {
        "sonny" => activate_sonny_reverse_shell(world, player_id, x, y),
        "bailey" => {
            let Some((target_x, target_y)) = bailey_aim_point(world, player_id) else {
                return;
            };
            if let Some(player) = world.players.get_mut(&player_id) {
                player.ability_windup = BAILEY_AIM_DURATION;
                player.ability_aim_x = target_x;
                player.ability_aim_y = target_y;
                player.ability_charge = 0.0;
            }
        }
        "jacob" => activate_jacob_directors_cut(world, player_id),
        "isaak" => activate_isaak_chi_blast(world, player_id),
        "taj" => activate_taj_story_shield(world, player_id),
        "finn" => activate_finn_cheeky_dinghy(world, player_id),
        _ => {}
    }
}

pub fn try_release(_world: &mut GameWorld, _player_id: u8) {}

pub fn process_abilities(world: &mut GameWorld, dt: f32) {
    let casting: Vec<(u8, f32, f32, f32, String)> = world
        .players
        .values()
        .filter(|player| player.alive && player.ability_windup > 0.0)
        .map(|player| {
            (
                player.id,
                player.ability_windup,
                player.ability_aim_x,
                player.ability_aim_y,
                player.character_id.clone(),
            )
        })
        .collect();

    for (player_id, windup, mut aim_x, mut aim_y, character_id) in casting {
        if character_id == "bailey" {
            if let Some((next_x, next_y)) = bailey_aim_point(world, player_id) {
                aim_x = next_x;
                aim_y = next_y;
                if let Some(player) = world.players.get_mut(&player_id) {
                    player.ability_aim_x = aim_x;
                    player.ability_aim_y = aim_y;
                }
            }
        } else if character_id == "isaak" {
            if let Some((dir_x, dir_y)) = aim_direction(world, player_id) {
                aim_x = dir_x;
                aim_y = dir_y;
                if let Some(player) = world.players.get_mut(&player_id) {
                    player.ability_aim_x = dir_x;
                    player.ability_aim_y = dir_y;
                }
            }
            emit_isaak_channel_pulse(world, player_id);
        }

        let new_windup = windup - dt;
        if let Some(player) = world.players.get_mut(&player_id) {
            player.ability_windup = new_windup.max(0.0);
        }

        if new_windup <= 0.0 {
            match character_id.as_str() {
                "bailey" => {
                    let (from_x, from_y) = world
                        .players
                        .get(&player_id)
                        .map(|player| (player.x, player.y))
                        .unwrap_or((aim_x, aim_y));
                    launch_bailey_nuke(world, player_id, from_x, from_y, aim_x, aim_y);
                }
                "isaak" => fire_isaak_chi_blast(world, player_id, aim_x, aim_y),
                _ => {}
            }
        }
    }
}

pub fn process_active_modes(world: &mut GameWorld, dt: f32) {
    let mut ended_boats: Vec<(u8, f32, f32)> = Vec::new();
    let mut expired_shields: Vec<u8> = Vec::new();
    let shield_ids: Vec<u8> = world
        .players
        .values()
        .filter(|player| player.reel_shield_remaining > 0.0)
        .map(|player| player.id)
        .collect();

    for player_id in shield_ids {
        if let Some((dir_x, dir_y)) = aim_direction(world, player_id) {
            if let Some(player) = world.players.get_mut(&player_id) {
                player.reel_shield_angle = dir_y.atan2(dir_x);
            }
        }
    }

    for player in world.players.values_mut() {
        if player.boat_mode_until > 0.0 {
            player.boat_mode_until = (player.boat_mode_until - dt).max(0.0);
            if player.boat_mode_until <= 0.0 {
                ended_boats.push((player.id, player.x, player.y));
                player.hangover_until = FINN_HANGOVER_DURATION;
                player.boat_rammed.clear();
            }
        }

        if player.reel_shield_remaining > 0.0 {
            player.reel_shield_remaining = (player.reel_shield_remaining - dt).max(0.0);
            if player.reel_shield_remaining <= 0.0 || player.reel_shield_hp <= 0.0 {
                expired_shields.push(player.id);
            }
        }
    }

    for (player_id, x, y) in ended_boats {
        let id = world.next_effect_id;
        world.next_effect_id += 1;
        world.effects.push(WorldEffect::burst(
            id,
            EffectKind::BoatSplash,
            x,
            y,
            52.0,
            BOAT_SPLASH_VFX_LIFE,
            player_id,
        ));
    }

    for player_id in expired_shields {
        if let Some(player) = world.players.get_mut(&player_id) {
            player.reel_shield_remaining = 0.0;
            player.reel_shield_hp = 0.0;
        }
    }
}

pub fn process_boat_rams(world: &mut GameWorld) {
    if !world.friendly_fire {
        return;
    }

    let boaters: Vec<(u8, f32, f32, f32, f32)> = world
        .players
        .values()
        .filter(|player| player.alive && in_boat_mode(player))
        .map(|player| {
            (
                player.id,
                player.x,
                player.y,
                player.angle.cos(),
                player.angle.sin(),
            )
        })
        .collect();

    for (boater_id, bx, by, dir_x, dir_y) in boaters {
        let targets: Vec<u8> = world
            .players
            .values()
            .filter(|player| {
                player.alive
                    && player.id != boater_id
                    && !player.spawn_protected()
                    && circle_hits_circle(
                        player.x,
                        player.y,
                        PLAYER_RADIUS,
                        bx,
                        by,
                        PLAYER_RADIUS + 10.0,
                    )
            })
            .map(|player| player.id)
            .collect();

        for target_id in targets {
            let already_hit = world
                .players
                .get(&boater_id)
                .map(|player| player.boat_rammed.contains(&target_id))
                .unwrap_or(true);
            if already_hit {
                continue;
            }

            if let Some(boater) = world.players.get_mut(&boater_id) {
                boater.boat_rammed.push(target_id);
            }

            world.apply_damage(boater_id, target_id, FINN_RAM_DAMAGE);
            apply_knockback(world, target_id, dir_x, dir_y, FINN_RAM_KNOCKBACK);
            add_charge(
                world.players.get_mut(&boater_id).expect("boater exists"),
                FINN_RAM_CHARGE_REFUND,
            );

            let (tx, ty) = world
                .players
                .get(&target_id)
                .map(|player| (player.x, player.y))
                .unwrap_or((bx, by));
            let id = world.next_effect_id;
            world.next_effect_id += 1;
            world.effects.push(WorldEffect::burst(
                id,
                EffectKind::BoatSplash,
                tx,
                ty,
                38.0,
                BOAT_SPLASH_VFX_LIFE * 0.85,
                boater_id,
            ));
        }
    }
}

pub fn check_shield_block(
    world: &GameWorld,
    bullet_owner_id: u8,
    prev_x: f32,
    prev_y: f32,
    x: f32,
    y: f32,
) -> Option<(u8, f32, f32)> {
    let shields: Vec<(u8, f32, f32, f32)> = world
        .players
        .values()
        .filter(|player| player.alive && has_reel_shield(player))
        .map(|player| (player.id, player.x, player.y, player.reel_shield_angle))
        .collect();
    check_shield_block_with(&shields, bullet_owner_id, prev_x, prev_y, x, y)
}

pub fn check_shield_block_with(
    shields: &[(u8, f32, f32, f32)],
    bullet_owner_id: u8,
    prev_x: f32,
    prev_y: f32,
    x: f32,
    y: f32,
) -> Option<(u8, f32, f32)> {
    for (owner_id, px, py, angle) in shields {
        if *owner_id == bullet_owner_id {
            continue;
        }
        if segment_hits_reel_shield(prev_x, prev_y, x, y, *px, *py, *angle) {
            let (cx, cy) = reel_shield_center(*px, *py, *angle);
            return Some((*owner_id, cx, cy));
        }
    }
    None
}

pub fn apply_shield_block(world: &mut GameWorld, owner_id: u8, damage: u16, _cx: f32, _cy: f32) {
    if let Some(owner) = world.players.get_mut(&owner_id) {
        owner.reel_shield_hp -= damage as f32;
        if owner.reel_shield_hp <= 0.0 {
            owner.reel_shield_remaining = 0.0;
            owner.reel_shield_hp = 0.0;
        }
    }
}

pub fn process_projectile_effects(world: &mut GameWorld, dt: f32) {
    let mut detonations: Vec<(u8, f32, f32)> = Vec::new();
    let mut reel_posts: Vec<(u8, f32, f32, f32, f32)> = Vec::new();

    for effect in &mut world.effects {
        if effect.kind == EffectKind::ReelPost {
            effect.life -= dt;
            let duration = effect.max_life.max(0.001);
            let progress = (1.0 - (effect.life / duration)).clamp(0.0, 1.0);
            let travel = REEL_POST_RANGE * progress;
            effect.x = effect.origin_x + effect.target_x * travel;
            effect.y = effect.origin_y + effect.target_y * travel;

            if effect.life <= 0.0 {
                reel_posts.push((
                    effect.owner_id,
                    effect.x,
                    effect.y,
                    effect.target_x,
                    effect.target_y,
                ));
            }
            continue;
        }

        if effect.kind != EffectKind::TruthNuke {
            continue;
        }

        effect.life -= dt;
        let duration = effect.max_life.max(0.001);
        let progress = (1.0 - (effect.life / duration)).clamp(0.0, 1.0);
        effect.x = effect.origin_x + (effect.target_x - effect.origin_x) * progress;
        effect.y = effect.origin_y + (effect.target_y - effect.origin_y) * progress;
        effect.y -= bailey_arc_lift(progress, BAILEY_NUKE_ARC_HEIGHT);

        if effect.life <= 0.0 {
            detonations.push((effect.owner_id, effect.target_x, effect.target_y));
        }
    }

    world.effects.retain(|effect| {
        (effect.kind != EffectKind::TruthNuke || effect.life > 0.0)
            && (effect.kind != EffectKind::ReelPost || effect.life > 0.0)
    });

    for (owner_id, x, y) in detonations {
        detonate_bailey_nuke(world, owner_id, x, y);
    }

    for (owner_id, x, y, dir_x, dir_y) in reel_posts {
        apply_reel_post_hit(world, owner_id, x, y, dir_x, dir_y);
    }
}

pub fn process_effects(world: &mut GameWorld, dt: f32) {
    for effect in &mut world.effects {
        if effect.kind == EffectKind::TruthNuke || effect.kind == EffectKind::ReelPost {
            continue;
        }
        effect.life -= dt;
    }
    world.effects.retain(|effect| effect.life > 0.0);
}

fn activate_isaak_chi_blast(world: &mut GameWorld, player_id: u8) {
    let Some((dir_x, dir_y)) = aim_direction(world, player_id) else {
        return;
    };
    if let Some(player) = world.players.get_mut(&player_id) {
        player.ability_windup = ISAAC_CHI_WINDUP;
        player.ability_aim_x = dir_x;
        player.ability_aim_y = dir_y;
        player.ability_charge = 0.0;
    }
}

fn activate_taj_story_shield(world: &mut GameWorld, player_id: u8) {
    let Some((dir_x, dir_y)) = aim_direction(world, player_id) else {
        return;
    };
    let angle = dir_y.atan2(dir_x);
    let reel_index = {
        let index = world.next_reel_index % TAJ_REEL_COUNT;
        world.next_reel_index = world.next_reel_index.wrapping_add(1);
        index
    };
    if let Some(player) = world.players.get_mut(&player_id) {
        player.reel_shield_remaining = REEL_SHIELD_DURATION;
        player.reel_shield_hp = REEL_SHIELD_HP;
        player.reel_shield_angle = angle;
        player.reel_index = reel_index;
        player.ability_charge = 0.0;
    }
}

fn post_taj_reel_shield(world: &mut GameWorld, player_id: u8) {
    let Some(player) = world.players.get(&player_id) else {
        return;
    };
    if !has_reel_shield(player) {
        return;
    }

    let (origin_x, origin_y) = reel_shield_center(player.x, player.y, player.reel_shield_angle);
    let dir_x = player.reel_shield_angle.cos();
    let dir_y = player.reel_shield_angle.sin();
    let reel_index = player.reel_index;

    if let Some(player) = world.players.get_mut(&player_id) {
        player.reel_shield_remaining = 0.0;
        player.reel_shield_hp = 0.0;
        add_charge(player, REEL_POST_CHARGE_REFUND);
    }

    let id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect {
        id,
        kind: EffectKind::ReelPost,
        x: origin_x,
        y: origin_y,
        radius: reel_index as f32,
        life: 0.55,
        owner_id: player_id,
        origin_x,
        origin_y,
        target_x: dir_x,
        target_y: dir_y,
        max_life: 0.55,
    });
}

fn activate_finn_cheeky_dinghy(world: &mut GameWorld, player_id: u8) {
    if let Some(player) = world.players.get_mut(&player_id) {
        player.boat_mode_until = FINN_BOAT_DURATION;
        player.boat_rammed.clear();
        player.ability_charge = 0.0;
        player.reload_timer = 0.0;
        player.hangover_until = 0.0;
    }

    let (x, y) = world
        .players
        .get(&player_id)
        .map(|player| (player.x, player.y))
        .unwrap_or((0.0, 0.0));
    let id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect::burst(
        id,
        EffectKind::BoatSplash,
        x,
        y,
        48.0,
        BOAT_SPLASH_VFX_LIFE,
        player_id,
    ));
}

fn fire_isaak_chi_blast(world: &mut GameWorld, player_id: u8, dir_x: f32, dir_y: f32) {
    let (origin_x, origin_y, stacks) = {
        let Some(player) = world.players.get(&player_id) else {
            return;
        };
        (
            player.x + dir_x * (PLAYER_RADIUS + 8.0),
            player.y + dir_y * (PLAYER_RADIUS + 8.0),
            player.stillness_stacks,
        )
    };

    let hit = raycast_chi_beam(
        world,
        player_id,
        origin_x,
        origin_y,
        dir_x,
        dir_y,
        ISAAC_CHI_RANGE,
    );
    let end_x = hit.map(|(_, x, y, _)| (x, y)).unwrap_or((
        origin_x + dir_x * ISAAC_CHI_RANGE,
        origin_y + dir_y * ISAAC_CHI_RANGE,
    ));

    let id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect {
        id,
        kind: EffectKind::ChiBeam,
        x: origin_x,
        y: origin_y,
        radius: ISAAC_CHI_BEAM_HALF_WIDTH,
        life: ISAAC_CHI_VFX_LIFE,
        owner_id: player_id,
        origin_x,
        origin_y,
        target_x: end_x.0,
        target_y: end_x.1,
        max_life: ISAAC_CHI_VFX_LIFE,
    });

    if let Some((victim_id, hit_x, hit_y, _)) = hit {
        let damage = isaak_chi_damage(stacks);
        world.apply_damage(player_id, victim_id, damage);
        if stacks > 0 {
            if let Some(victim) = world.players.get_mut(&victim_id) {
                let stack_ratio = stacks as f32 / ISAAC_MAX_STILLNESS_STACKS as f32;
                let slow_duration = ISAAC_CHI_SLOW_DURATION * stack_ratio;
                let slow_mult = 1.0 - (1.0 - ISAAC_CHI_SLOW_MULT) * stack_ratio;
                victim.slowed_until = victim.slowed_until.max(slow_duration);
                victim.slow_multiplier = victim.slow_multiplier.min(slow_mult);
            }
        }
        let mark_id = world.next_effect_id;
        world.next_effect_id += 1;
        world.effects.push(WorldEffect::burst(
            mark_id,
            EffectKind::Mark,
            hit_x,
            hit_y,
            36.0,
            0.35,
            player_id,
        ));
    }

    if let Some(player) = world.players.get_mut(&player_id) {
        player.stillness_stacks = 0;
        player.stillness_timer = 0.0;
    }
}

fn emit_isaak_channel_pulse(world: &mut GameWorld, player_id: u8) {
    let Some(player) = world.players.get(&player_id) else {
        return;
    };
    if player.ability_windup <= 0.0 {
        return;
    }
    let id = world.next_effect_id;
    world.next_effect_id += 1;
    let pulse = 28.0 + (ISAAC_CHI_WINDUP - player.ability_windup) * 18.0;
    world.effects.push(WorldEffect::burst(
        id,
        EffectKind::ChiChannel,
        player.x,
        player.y,
        pulse,
        ISAAC_CHI_CHANNEL_VFX_LIFE,
        player_id,
    ));
}

fn apply_reel_post_hit(
    world: &mut GameWorld,
    owner_id: u8,
    x: f32,
    y: f32,
    dir_x: f32,
    dir_y: f32,
) {
    if !world.friendly_fire {
        return;
    }

    let victims: Vec<u8> = world
        .players
        .values()
        .filter(|player| {
            player.alive
                && player.id != owner_id
                && !player.spawn_protected()
                && circle_hits_circle(
                    player.x,
                    player.y,
                    PLAYER_RADIUS,
                    x,
                    y,
                    REEL_SHIELD_HALF_WIDTH * 0.85,
                )
        })
        .map(|player| player.id)
        .collect();

    for victim_id in victims {
        world.apply_damage(owner_id, victim_id, REEL_POST_DAMAGE);
        apply_knockback(world, victim_id, dir_x, dir_y, REEL_POST_KNOCKBACK);
        if let Some(victim) = world.players.get_mut(&victim_id) {
            victim.slowed_until = victim.slowed_until.max(REEL_POST_SLOW_DURATION);
            victim.slow_multiplier = REEL_POST_SLOW_MULT;
        }
    }
}

fn raycast_chi_beam(
    world: &GameWorld,
    owner_id: u8,
    origin_x: f32,
    origin_y: f32,
    dir_x: f32,
    dir_y: f32,
    max_dist: f32,
) -> Option<(u8, f32, f32, f32)> {
    let mut pierced_wall = false;
    let mut cursor_x = origin_x;
    let mut cursor_y = origin_y;
    let mut remaining = max_dist;

    loop {
        let wall_dist = next_wall_hit_distance(
            cursor_x,
            cursor_y,
            dir_x,
            dir_y,
            remaining,
            &world.map.walls,
        );
        let player_hit = next_player_hit_distance(
            world,
            owner_id,
            cursor_x,
            cursor_y,
            dir_x,
            dir_y,
            remaining,
            ISAAC_CHI_BEAM_HALF_WIDTH,
        );

        match (wall_dist, player_hit) {
            (Some(w_dist), Some((victim_id, p_dist, hx, hy))) if p_dist <= w_dist => {
                return Some((victim_id, hx, hy, p_dist));
            }
            (Some(w_dist), _) if !pierced_wall => {
                pierced_wall = true;
                cursor_x += dir_x * (w_dist + 4.0);
                cursor_y += dir_y * (w_dist + 4.0);
                remaining -= w_dist + 4.0;
                if remaining <= 0.0 {
                    return None;
                }
            }
            (_, Some((victim_id, _, hx, hy))) => return Some((victim_id, hx, hy, 0.0)),
            _ => return None,
        }
    }
}

fn next_player_hit_distance(
    world: &GameWorld,
    owner_id: u8,
    origin_x: f32,
    origin_y: f32,
    dir_x: f32,
    dir_y: f32,
    max_dist: f32,
    half_width: f32,
) -> Option<(u8, f32, f32, f32)> {
    let mut best: Option<(u8, f32, f32, f32)> = None;

    for player in world.players.values() {
        if !player.alive
            || player.id == owner_id
            || player.spawn_protected()
            || !world.friendly_fire
        {
            continue;
        }
        if let Some(dist) = ray_hits_circle(
            origin_x,
            origin_y,
            dir_x,
            dir_y,
            player.x,
            player.y,
            PLAYER_RADIUS + half_width,
            max_dist,
        ) {
            let hit_x = origin_x + dir_x * dist;
            let hit_y = origin_y + dir_y * dist;
            if best
                .map(|(_, best_dist, _, _)| dist < best_dist)
                .unwrap_or(true)
            {
                best = Some((player.id, dist, hit_x, hit_y));
            }
        }
    }

    best
}

fn next_wall_hit_distance(
    x: f32,
    y: f32,
    dir_x: f32,
    dir_y: f32,
    max_dist: f32,
    walls: &[Rect],
) -> Option<f32> {
    let mut best: Option<f32> = None;
    for wall in walls {
        if let Some(dist) = ray_hits_rect(x, y, dir_x, dir_y, max_dist, wall) {
            if best.map(|best_dist| dist < best_dist).unwrap_or(true) {
                best = Some(dist);
            }
        }
    }
    best
}

fn ray_hits_rect(
    x: f32,
    y: f32,
    dir_x: f32,
    dir_y: f32,
    max_dist: f32,
    wall: &Rect,
) -> Option<f32> {
    let x_min = wall.x;
    let y_min = wall.y;
    let x_max = wall.x + wall.w;
    let y_max = wall.y + wall.h;

    let mut t_min = 0.0_f32;
    let mut t_max = max_dist;

    let axes = [(dir_x, x - x_min, x - x_max), (dir_y, y - y_min, y - y_max)];
    for (dir, t1, t2) in axes {
        if dir.abs() < 0.0001 {
            if t1 < 0.0 || t2 > 0.0 {
                return None;
            }
        } else {
            let inv = 1.0 / dir;
            let mut t_near = t1 * inv;
            let mut t_far = t2 * inv;
            if t_near > t_far {
                std::mem::swap(&mut t_near, &mut t_far);
            }
            t_min = t_min.max(t_near);
            t_max = t_max.min(t_far);
            if t_min > t_max {
                return None;
            }
        }
    }

    if t_min >= 0.0 && t_min <= max_dist {
        Some(t_min)
    } else {
        None
    }
}

fn ray_hits_circle(
    ox: f32,
    oy: f32,
    dx: f32,
    dy: f32,
    cx: f32,
    cy: f32,
    radius: f32,
    max_dist: f32,
) -> Option<f32> {
    let fx = ox - cx;
    let fy = oy - cy;
    let a = dx * dx + dy * dy;
    let b = 2.0 * (fx * dx + fy * dy);
    let c = fx * fx + fy * fy - radius * radius;
    let discriminant = b * b - 4.0 * a * c;
    if discriminant < 0.0 {
        return None;
    }
    let sqrt_d = discriminant.sqrt();
    let t1 = (-b - sqrt_d) / (2.0 * a);
    if t1 >= 0.0 && t1 <= max_dist {
        return Some(t1);
    }
    let t2 = (-b + sqrt_d) / (2.0 * a);
    if t2 >= 0.0 && t2 <= max_dist {
        return Some(t2);
    }
    None
}

fn reel_shield_center(px: f32, py: f32, angle: f32) -> (f32, f32) {
    (
        px + angle.cos() * REEL_SHIELD_OFFSET,
        py + angle.sin() * REEL_SHIELD_OFFSET,
    )
}

fn segment_hits_reel_shield(
    x0: f32,
    y0: f32,
    x1: f32,
    y1: f32,
    px: f32,
    py: f32,
    angle: f32,
) -> bool {
    let (cx, cy) = reel_shield_center(px, py, angle);
    let fx = angle.cos();
    let fy = angle.sin();
    let perp_x = -fy;
    let perp_y = fx;
    let dx = x1 - x0;
    let dy = y1 - y0;

    for step in 0..=10 {
        let t = step as f32 / 10.0;
        let x = x0 + dx * t;
        let y = y0 + dy * t;
        let rel_x = x - cx;
        let rel_y = y - cy;
        let forward = rel_x * fx + rel_y * fy;
        let lateral = (rel_x * perp_x + rel_y * perp_y).abs();
        if forward.abs() <= REEL_SHIELD_DEPTH * 0.55 && lateral <= REEL_SHIELD_HALF_WIDTH {
            return true;
        }
    }
    false
}

fn apply_knockback(world: &mut GameWorld, victim_id: u8, dir_x: f32, dir_y: f32, impulse: f32) {
    let (dir_x, dir_y) = normalize(dir_x, dir_y);
    let Some(victim) = world.players.get_mut(&victim_id) else {
        return;
    };
    let next_x =
        (victim.x + dir_x * impulse).clamp(PLAYER_RADIUS, world.config.width - PLAYER_RADIUS);
    let next_y =
        (victim.y + dir_y * impulse).clamp(PLAYER_RADIUS, world.config.height - PLAYER_RADIUS);
    if !circle_hits_walls(next_x, victim.y, PLAYER_RADIUS, &world.map.walls) {
        victim.x = next_x;
    }
    if !circle_hits_walls(victim.x, next_y, PLAYER_RADIUS, &world.map.walls) {
        victim.y = next_y;
    }
}

fn aim_direction(world: &GameWorld, player_id: u8) -> Option<(f32, f32)> {
    let player = world.players.get(&player_id)?;
    let input = world.inputs.get(&player_id).cloned().unwrap_or_default();
    let (ax, ay) = normalize(input.aim_x, input.aim_y);
    if ax == 0.0 && ay == 0.0 {
        Some((player.angle.cos(), player.angle.sin()))
    } else {
        Some((ax, ay))
    }
}

fn bailey_aim_point(world: &GameWorld, player_id: u8) -> Option<(f32, f32)> {
    let player = world.players.get(&player_id)?;
    let input = world.inputs.get(&player_id).cloned().unwrap_or_default();
    let (ax, ay) = normalize(input.aim_x, input.aim_y);
    let angle = if ax == 0.0 && ay == 0.0 {
        player.angle
    } else {
        ay.atan2(ax)
    };
    let target_x = (player.x + angle.cos() * BAILEY_NUKE_RANGE)
        .clamp(PLAYER_RADIUS, world.config.width - PLAYER_RADIUS);
    let target_y = (player.y + angle.sin() * BAILEY_NUKE_RANGE)
        .clamp(PLAYER_RADIUS, world.config.height - PLAYER_RADIUS);
    Some((target_x, target_y))
}

fn bailey_arc_lift(progress: f32, height: f32) -> f32 {
    let centered = progress * 2.0 - 1.0;
    (1.0 - centered * centered).max(0.0) * height
}

fn launch_bailey_nuke(
    world: &mut GameWorld,
    owner_id: u8,
    from_x: f32,
    from_y: f32,
    target_x: f32,
    target_y: f32,
) {
    let id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect {
        id,
        kind: EffectKind::TruthNuke,
        x: from_x,
        y: from_y,
        radius: BAILEY_NUKE_RADIUS,
        life: BAILEY_NUKE_FLIGHT,
        owner_id,
        origin_x: from_x,
        origin_y: from_y,
        target_x,
        target_y,
        max_life: BAILEY_NUKE_FLIGHT,
    });
}

fn activate_sonny_reverse_shell(world: &mut GameWorld, caster_id: u8, x: f32, y: f32) {
    let target_id = world
        .players
        .values()
        .filter(|player| {
            player.alive
                && player.id != caster_id
                && !player.spawn_protected()
                && distance_sq(x, y, player.x, player.y) <= SONNY_HACK_RANGE * SONNY_HACK_RANGE
        })
        .min_by(|a, b| {
            distance_sq(x, y, a.x, a.y)
                .partial_cmp(&distance_sq(x, y, b.x, b.y))
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|player| player.id);

    let Some(target_id) = target_id else {
        if let Some(caster) = world.players.get_mut(&caster_id) {
            caster.ability_charge = SONNY_MISS_REFUND;
        }
        return;
    };

    if let Some(target) = world.players.get_mut(&target_id) {
        target.controls_inverted_until = SONNY_HACK_DURATION;
    }
    if let Some(caster) = world.players.get_mut(&caster_id) {
        caster.ability_charge = 0.0;
        add_charge(caster, SONNY_HACK_CHARGE_BONUS);
    }

    let (tx, ty) = world
        .players
        .get(&target_id)
        .map(|player| (player.x, player.y))
        .unwrap_or((x, y));
    let id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect {
        id,
        kind: EffectKind::Hack,
        x: tx,
        y: ty,
        radius: SONNY_HACK_RANGE,
        life: SONNY_HACK_VFX_LIFE,
        owner_id: caster_id,
        origin_x: x,
        origin_y: y,
        target_x: tx,
        target_y: ty,
        max_life: SONNY_HACK_VFX_LIFE,
    });
}

fn distance_sq(x1: f32, y1: f32, x2: f32, y2: f32) -> f32 {
    let dx = x1 - x2;
    let dy = y1 - y2;
    dx * dx + dy * dy
}

fn detonate_bailey_nuke(world: &mut GameWorld, owner_id: u8, x: f32, y: f32) {
    let id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect::burst(
        id,
        EffectKind::TruthExplosion,
        x,
        y,
        BAILEY_NUKE_RADIUS,
        TRUTH_EXPLOSION_VFX_LIFE,
        owner_id,
    ));
    apply_explosion_damage(
        world,
        owner_id,
        x,
        y,
        BAILEY_NUKE_RADIUS,
        BAILEY_NUKE_DAMAGE,
    );
}

fn apply_explosion_damage(
    world: &mut GameWorld,
    owner_id: u8,
    x: f32,
    y: f32,
    radius: f32,
    max_damage: u16,
) {
    let victims: Vec<(u8, u16)> = world
        .players
        .values()
        .filter(|player| {
            player.alive
                && !player.spawn_protected()
                && circle_hits_circle(player.x, player.y, PLAYER_RADIUS, x, y, radius)
        })
        .filter_map(|player| {
            let distance = distance(player.x, player.y, x, y);
            let damage = blast_damage_at_distance(max_damage, distance, radius);
            if damage > 0 {
                Some((player.id, damage))
            } else {
                None
            }
        })
        .collect();

    for (victim_id, damage) in victims {
        world.apply_damage(owner_id, victim_id, damage);
        if let Some(victim) = world.players.get_mut(&victim_id) {
            victim.slowed_until = victim.slowed_until.max(BAILEY_NUKE_SLOW_DURATION);
            victim.slow_multiplier = victim.slow_multiplier.min(BAILEY_NUKE_SLOW_MULT);
        }
    }
}

pub fn blast_damage_at_distance(max_damage: u16, distance: f32, radius: f32) -> u16 {
    if distance >= radius + PLAYER_RADIUS {
        return 0;
    }
    let t = (distance / radius.max(0.001)).clamp(0.0, 1.0);
    let factor = 1.0 - t * (1.0 - BAILEY_NUKE_MIN_FALLOFF);
    ((max_damage as f32) * factor).round().max(1.0) as u16
}

fn distance(x1: f32, y1: f32, x2: f32, y2: f32) -> f32 {
    distance_sq(x1, y1, x2, y2).sqrt()
}

pub fn effect_snapshot(effect: &WorldEffect) -> WorldEffectSnapshot {
    WorldEffectSnapshot {
        id: effect.id,
        kind: effect.kind,
        x: effect.x,
        y: effect.y,
        radius: effect.radius,
        life: effect.life.max(0.0),
        owner_id: effect.owner_id,
        origin_x: effect.origin_x,
        origin_y: effect.origin_y,
        target_x: effect.target_x,
        target_y: effect.target_y,
        max_life: effect.max_life,
    }
}

pub fn is_casting(player: &Player) -> bool {
    player.ability_windup > 0.0
}

pub fn try_fire_popcorn(
    world: &mut GameWorld,
    owner_id: u8,
    x: f32,
    y: f32,
    aim_x: f32,
    aim_y: f32,
) -> bool {
    let shots_remaining = world
        .players
        .get(&owner_id)
        .map(|player| player.directors_cut_shots)
        .unwrap_or(0);
    if shots_remaining == 0 {
        return false;
    }

    let spread = spread_from_seed(
        (owner_id as u32)
            .wrapping_mul(131)
            .wrapping_add(shots_remaining as u32),
        POPCORN_INITIAL_SPREAD_DEG,
    );
    let base_angle = aim_y.atan2(aim_x);
    let angle = base_angle + spread;
    let (dir_x, dir_y) = (angle.cos(), angle.sin());
    let spawn_x = x + dir_x * (PLAYER_RADIUS + 18.0);
    let spawn_y = y + dir_y * (PLAYER_RADIUS + 18.0);

    if let Some(player) = world.players.get_mut(&owner_id) {
        player.directors_cut_shots = player.directors_cut_shots.saturating_sub(1);
        if player.directors_cut_shots == 0 {
            end_directors_cut(player);
        }
    }

    let id = world.next_bullet_id;
    world.next_bullet_id += 1;
    world.bullets.push(crate::game::Bullet {
        id,
        owner_id,
        weapon_id: POPCORN_WEAPON_ID.to_string(),
        damage: POPCORN_DAMAGE,
        radius: POPCORN_RADIUS,
        x: spawn_x,
        y: spawn_y,
        vx: dir_x * POPCORN_SPEED,
        vy: dir_y * POPCORN_SPEED,
        life: POPCORN_LIFE,
        bounces_remaining: POPCORN_BOUNCES,
    });
    true
}

pub fn deflect_popcorn(vx: f32, vy: f32, nx: f32, ny: f32, seed: u32) -> (f32, f32) {
    let dot = vx * nx + vy * ny;
    let rx = vx - 2.0 * dot * nx;
    let ry = vy - 2.0 * dot * ny;
    let speed = (rx * rx + ry * ry).sqrt().max(0.001);
    let angle = ry.atan2(rx) + spread_from_seed(seed, POPCORN_BOUNCE_SPREAD_DEG);
    (angle.cos() * speed, angle.sin() * speed)
}

fn spread_from_seed(seed: u32, max_deg: f32) -> f32 {
    let t = ((seed.wrapping_mul(1103515245).wrapping_add(12345)) >> 16) as f32 / 32768.0;
    (t * 2.0 - 1.0) * max_deg.to_radians()
}

fn activate_jacob_directors_cut(world: &mut GameWorld, caster_id: u8) {
    let Some(caster) = world.players.get(&caster_id) else {
        return;
    };
    if in_directors_cut(caster) {
        return;
    }

    if let Some(caster) = world.players.get_mut(&caster_id) {
        caster.directors_cut_until = JACOB_DIRECTORS_CUT_DURATION;
        caster.directors_cut_shots = JACOB_DIRECTORS_CUT_SHOTS;
        caster.ability_charge = 0.0;
        caster.fire_cooldown = 0.0;
        caster.reload_timer = 0.0;
    }

    let (x, y) = world
        .players
        .get(&caster_id)
        .map(|player| (player.x, player.y))
        .unwrap_or((0.0, 0.0));
    let id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect::burst(
        id,
        EffectKind::DirectorsCut,
        x,
        y,
        42.0,
        DIRECTORS_CUT_VFX_LIFE,
        caster_id,
    ));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game::GameWorld;
    use crate::protocol::WinCondition;
    use std::collections::HashMap;

    fn test_world_with_taj() -> GameWorld {
        let mut world = GameWorld::default();
        world.add_player(0, "Taj".to_string(), "taj".to_string(), "glock".to_string());
        world.reset_for_match(
            20,
            0,
            WinCondition::Kills,
            crate::protocol::Gamemode::Deathmatch,
            true,
            false,
        );
        if let Some(player) = world.players.get_mut(&0) {
            player.spawn_protection = 0.0;
            player.x = 300.0;
            player.y = 300.0;
            player.reel_shield_remaining = 2.0;
            player.reel_shield_hp = REEL_SHIELD_HP;
            player.reel_shield_angle = 0.0;
        }
        world
    }

    #[test]
    fn isaak_chi_damage_scales_with_stacks() {
        assert_eq!(isaak_chi_damage(0), 55);
        assert_eq!(isaak_chi_damage(1), 65);
        assert_eq!(isaak_chi_damage(3), 85);
    }

    #[test]
    fn sonny_refunds_charge_when_no_target() {
        let mut world = GameWorld::default();
        world.add_player(
            0,
            "Sonny".to_string(),
            "sonny".to_string(),
            "glock".to_string(),
        );
        world.reset_for_match(
            20,
            0,
            WinCondition::Kills,
            crate::protocol::Gamemode::Deathmatch,
            true,
            false,
        );
        if let Some(player) = world.players.get_mut(&0) {
            player.spawn_protection = 0.0;
            player.ability_charge = ABILITY_CHARGE_MAX;
        }
        activate_sonny_reverse_shell(&mut world, 0, 100.0, 100.0);
        assert_eq!(
            world.players.get(&0).unwrap().ability_charge,
            SONNY_MISS_REFUND
        );
    }

    #[test]
    fn isaak_stillness_builds_while_idle() {
        let mut players = HashMap::new();
        let mut world = GameWorld::default();
        world.add_player(
            1,
            "Isaak".to_string(),
            "isaak".to_string(),
            "glock".to_string(),
        );
        if let Some(player) = world.players.remove(&1) {
            players.insert(1, player);
        }
        let inputs = HashMap::new();
        for _ in 0..120 {
            tick_character_passives(&mut players, &inputs, 0.05);
        }
        assert_eq!(players.get(&1).unwrap().stillness_stacks, 3);
    }

    #[test]
    fn taj_shield_blocks_bullets() {
        let mut world = test_world_with_taj();
        let blocked = check_shield_block(&world, 1, 180.0, 300.0, 360.0, 300.0);
        assert!(blocked.is_some());
        apply_shield_block(&mut world, 0, 25, 344.0, 300.0);
        assert!(world.players.get(&0).unwrap().reel_shield_hp < REEL_SHIELD_HP);
    }
}
