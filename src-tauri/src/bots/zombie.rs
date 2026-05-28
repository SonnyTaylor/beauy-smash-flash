use crate::abilities::is_casting;
use crate::game::GameWorld;
use crate::protocol::InputSnapshot;

use super::navigation::{has_clear_path, navigate_toward};
use super::{aim_input, set_bot_input};

pub(crate) const MELEE_RANGE: f32 = 78.0;

pub fn update_zombie_bot(world: &mut GameWorld, id: u8, dt: f32) {
    let Some(zombie) = world.players.get(&id).cloned() else {
        return;
    };
    if !zombie.alive || is_casting(&zombie) {
        return;
    }

    let Some((target_x, target_y)) = nearest_human(world, zombie.x, zombie.y) else {
        set_bot_input(world, id, InputSnapshot::default());
        return;
    };

    let (aim_x, aim_y) = aim_input(zombie.x, zombie.y, target_x, target_y);
    let dist_sq = (target_x - zombie.x).powi(2) + (target_y - zombie.y).powi(2);
    let can_swipe = dist_sq <= MELEE_RANGE * MELEE_RANGE
        && has_clear_path(world, zombie.x, zombie.y, target_x, target_y);

    let (move_x, move_y) = if can_swipe {
        (0.0, 0.0)
    } else {
        navigate_toward(world, id, zombie.x, zombie.y, target_x, target_y, dt)
    };

    set_bot_input(
        world,
        id,
        InputSnapshot {
            dx: move_x,
            dy: move_y,
            aim_x,
            aim_y,
            fire: can_swipe && zombie.fire_cooldown <= 0.0,
            ..InputSnapshot::default()
        },
    );
}

fn nearest_human(world: &GameWorld, x: f32, y: f32) -> Option<(f32, f32)> {
    world
        .players
        .values()
        .filter(|player| !player.is_zombie && player.alive && !player.spawn_protected())
        .map(|player| {
            let dist_sq = (player.x - x).powi(2) + (player.y - y).powi(2);
            (dist_sq, player.x, player.y)
        })
        .min_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(_, tx, ty)| (tx, ty))
}
