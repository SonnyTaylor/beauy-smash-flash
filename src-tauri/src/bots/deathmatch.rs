use crate::abilities::is_casting;
use crate::game::GameWorld;
use crate::protocol::InputSnapshot;

use super::navigation::navigate_toward;
use super::{aim_input, set_bot_input};

const FIRE_RANGE: f32 = 720.0;

pub fn update_deathmatch_bot(world: &mut GameWorld, id: u8, dt: f32) {
    let Some(bot) = world.players.get(&id).cloned() else {
        return;
    };
    if !bot.alive || is_casting(&bot) {
        return;
    }

    let target = nearest_target(world, id);
    let Some((target_x, target_y)) = target else {
        set_bot_input(world, id, InputSnapshot::default());
        return;
    };

    let (aim_x, aim_y) = aim_input(bot.x, bot.y, target_x, target_y);
    let dist_sq = (target_x - bot.x).powi(2) + (target_y - bot.y).powi(2);
    let in_range = dist_sq <= FIRE_RANGE * FIRE_RANGE;

    let (move_x, move_y) = if dist_sq > 140.0 * 140.0 {
        navigate_toward(world, id, bot.x, bot.y, target_x, target_y, dt)
    } else if dist_sq < 90.0 * 90.0 {
        navigate_toward(
            world,
            id,
            bot.x,
            bot.y,
            bot.x + (bot.x - target_x),
            bot.y + (bot.y - target_y),
            dt,
        )
    } else {
        navigate_toward(
            world,
            id,
            bot.x,
            bot.y,
            bot.x - (target_y - bot.y),
            bot.y + (target_x - bot.x),
            dt,
        )
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
            fire: in_range && bot.fire_cooldown <= 0.0 && bot.ammo > 0 && !needs_reload,
            reload: needs_reload,
            ..InputSnapshot::default()
        },
    );
}

fn nearest_target(world: &GameWorld, bot_id: u8) -> Option<(f32, f32)> {
    world
        .players
        .values()
        .filter(|player| player.id != bot_id && player.alive && !player.spawn_protected())
        .map(|player| {
            let dist_sq = (player.x - world.players[&bot_id].x).powi(2)
                + (player.y - world.players[&bot_id].y).powi(2);
            (dist_sq, player.x, player.y)
        })
        .min_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(_, x, y)| (x, y))
}
