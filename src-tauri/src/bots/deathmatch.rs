use crate::abilities::is_casting;
use crate::game::GameWorld;
use crate::protocol::InputSnapshot;

use super::navigation::{has_clear_path, navigate_toward};
use super::{aim_input, set_bot_input};

const FIRE_RANGE: f32 = 720.0;
const TARGET_REACQUIRE_INTERVAL: f32 = 1.5;
const AIM_JITTER_INTERVAL: f32 = 0.35;
const AIM_JITTER_MAX: f32 = 16.0;
const STRAFE_SPEED_MULT: f32 = 0.68;
const BACKPEDAL_SPEED_MULT: f32 = 0.55;
const CIRCLE_STRAFE_CHANCE: f32 = 0.45;
const REACTION_DELAY: f32 = 0.18;

fn bot_rng(world: &GameWorld, bot_id: u8, salt: u32) -> f32 {
    let seed = (world.tick as u32)
        .wrapping_mul(131)
        .wrapping_add(bot_id as u32)
        .wrapping_mul(1103515245)
        .wrapping_add(salt);
    ((seed >> 16) as f32) / 32768.0
}

fn bot_rng_bool(world: &GameWorld, bot_id: u8, salt: u32, chance: f32) -> bool {
    bot_rng(world, bot_id, salt) < chance
}

fn bot_rng_range(world: &GameWorld, bot_id: u8, salt: u32, min: f32, max: f32) -> f32 {
    min + bot_rng(world, bot_id, salt) * (max - min)
}

pub fn update_deathmatch_bot(world: &mut GameWorld, id: u8, dt: f32) {
    let Some(bot) = world.players.get(&id).cloned() else {
        return;
    };
    if !bot.alive || is_casting(&bot) {
        return;
    }

    // Target persistence with periodic re-roll
    let mut nav = world.bot_nav.get(&id).copied().unwrap_or_default();
    nav.target_reacquire_timer -= dt;
    if nav.target_reacquire_timer <= 0.0 || nav.target_id.is_none() {
        nav.target_id = pick_target(world, id);
        nav.target_reacquire_timer =
            TARGET_REACQUIRE_INTERVAL + bot_rng_range(world, id, 7, -0.3, 0.6);
    }
    let target_id = nav.target_id;
    world.bot_nav.insert(id, nav);

    let Some(target_id) = target_id else {
        set_bot_input(world, id, InputSnapshot::default());
        return;
    };

    let Some(target) = world.players.get(&target_id).cloned() else {
        if let Some(nav) = world.bot_nav.get_mut(&id) {
            nav.target_id = None;
        }
        return;
    };

    // Jittered aim (changes every AIM_JITTER_INTERVAL)
    let mut nav = world.bot_nav.get(&id).copied().unwrap_or_default();
    nav.aim_jitter_timer -= dt;
    if nav.aim_jitter_timer <= 0.0 {
        nav.aim_jitter_x = bot_rng_range(world, id, 13, -AIM_JITTER_MAX, AIM_JITTER_MAX);
        nav.aim_jitter_y = bot_rng_range(world, id, 29, -AIM_JITTER_MAX, AIM_JITTER_MAX);
        nav.aim_jitter_timer = AIM_JITTER_INTERVAL;
    }

    // Smooth aim toward target (bots track with delay, not frame-perfect snap)
    let aim_target_x = target.x + nav.aim_jitter_x;
    let aim_target_y = target.y + nav.aim_jitter_y;
    let (raw_aim_x, raw_aim_y) = aim_input(bot.x, bot.y, aim_target_x, aim_target_y);

    let smooth_t = (dt / REACTION_DELAY).min(1.0);
    nav.aim_smoothed_x += (raw_aim_x - nav.aim_smoothed_x) * smooth_t;
    nav.aim_smoothed_y += (raw_aim_y - nav.aim_smoothed_y) * smooth_t;

    let aim_x = nav.aim_smoothed_x;
    let aim_y = nav.aim_smoothed_y;
    world.bot_nav.insert(id, nav);

    let dist_sq = (target.x - bot.x).powi(2) + (target.y - bot.y).powi(2);
    let in_range = dist_sq <= FIRE_RANGE * FIRE_RANGE;
    let los = has_clear_path(world, bot.x, bot.y, target.x, target.y);

    // Movement: throttle based on range and situation
    let (move_x, move_y) = if in_range && los {
        if dist_sq > 200.0 * 200.0 {
            // Mid-range: approach cautiously
            let (dx, dy) = navigate_toward(world, id, bot.x, bot.y, target.x, target.y, dt);
            (dx * 0.8, dy * 0.8)
        } else if dist_sq < 110.0 * 110.0 {
            // Too close: backpedal
            let retreat_x = bot.x + (bot.x - target.x);
            let retreat_y = bot.y + (bot.y - target.y);
            let (dx, dy) = navigate_toward(world, id, bot.x, bot.y, retreat_x, retreat_y, dt);
            (dx * BACKPEDAL_SPEED_MULT, dy * BACKPEDAL_SPEED_MULT)
        } else {
            // Comfortable range: circle strafe or small jitter
            let tangent_x = -(target.y - bot.y);
            let tangent_y = target.x - bot.x;
            let (tx, ty) = normalize(tangent_x, tangent_y);
            if bot_rng_bool(world, id, 3, CIRCLE_STRAFE_CHANCE) {
                (tx * STRAFE_SPEED_MULT, ty * STRAFE_SPEED_MULT)
            } else {
                // Small random walk to feel less robotic
                let jitter = bot_rng_range(world, id, 11, -0.4, 0.4);
                (
                    (tx + jitter) * STRAFE_SPEED_MULT * 0.6,
                    (ty + jitter) * STRAFE_SPEED_MULT * 0.6,
                )
            }
        }
    } else {
        // Out of range or no LoS: move toward target at full speed
        navigate_toward(world, id, bot.x, bot.y, target.x, target.y, dt)
    };

    let needs_reload = bot.ammo == 0 && bot.reload_timer <= 0.0;

    set_bot_input(
        world,
        id,
        InputSnapshot {
            dx: move_x,
            dy: move_y,
            aim_x,
            aim_y,
            fire: in_range && los && bot.fire_cooldown <= 0.0 && bot.ammo > 0 && !needs_reload,
            reload: needs_reload,
            ..InputSnapshot::default()
        },
    );
}

fn pick_target(world: &GameWorld, bot_id: u8) -> Option<u8> {
    world
        .players
        .values()
        .filter(|player| {
            player.id != bot_id && player.alive && !player.spawn_protected() && !player.is_zombie
        })
        .map(|player| {
            let dist_sq = (player.x - world.players[&bot_id].x).powi(2)
                + (player.y - world.players[&bot_id].y).powi(2);
            (dist_sq, player.id)
        })
        .min_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(_, id)| id)
}

fn normalize(x: f32, y: f32) -> (f32, f32) {
    let len = (x * x + y * y).sqrt();
    if len > 0.001 {
        (x / len, y / len)
    } else {
        (0.0, 0.0)
    }
}
