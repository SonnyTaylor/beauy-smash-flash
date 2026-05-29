use crate::abilities::is_casting;
use crate::game::GameWorld;
use crate::protocol::InputSnapshot;
use crate::weapons::{self, WeaponKind};

use super::navigation::{has_clear_path, navigate_toward};
use super::{aim_input, set_bot_input};

const APPROACH_BUFFER: f32 = 10.0;
const TARGET_CROWD_PENALTY: f32 = 140.0;
const CHASE_SCAN_RADIUS: f32 = 320.0;

pub fn update_zombie_bot(world: &mut GameWorld, id: u8, dt: f32) {
    let Some(zombie) = world.players.get(&id).cloned() else {
        return;
    };
    if !zombie.alive || is_casting(&zombie) {
        return;
    }

    let Some((target_x, target_y)) = pick_human_target(world, id, zombie.x, zombie.y) else {
        set_bot_input(world, id, InputSnapshot::default());
        return;
    };

    let (aim_x, aim_y) = aim_input(zombie.x, zombie.y, target_x, target_y);
    let dist_sq = (target_x - zombie.x).powi(2) + (target_y - zombie.y).powi(2);

    // Use the actual weapon range, minus a buffer so we're comfortably inside strike distance
    let weapon = weapons::get_or_default("zombie_claws");
    let melee_range = match weapon.kind {
        WeaponKind::Melee { range, .. } => range,
        _ => 72.0,
    };
    let effective_range = (melee_range - APPROACH_BUFFER).max(48.0);

    let can_swipe = dist_sq <= effective_range * effective_range
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

fn pick_human_target(world: &GameWorld, zombie_id: u8, x: f32, y: f32) -> Option<(f32, f32)> {
    let mut best: Option<(f32, f32, f32)> = None; // (x, y, score)

    for player in world.players.values() {
        if player.is_zombie || !player.alive || player.spawn_protected() {
            continue;
        }
        let dx = player.x - x;
        let dy = player.y - y;
        let dist = (dx * dx + dy * dy).sqrt();
        if dist > CHASE_SCAN_RADIUS * 3.0 {
            continue;
        }

        // Penalise targets that already have many zombies nearby
        let chasers = world
            .players
            .values()
            .filter(|p| {
                p.is_zombie
                    && p.alive
                    && p.id != zombie_id
                    && !p.spawn_protected()
            })
            .filter(|p| {
                let ddx = p.x - player.x;
                let ddy = p.y - player.y;
                ddx * ddx + ddy * ddy < 280.0 * 280.0
            })
            .count() as f32;

        let score = dist + chasers * TARGET_CROWD_PENALTY;
        if best.map(|(_, _, best_score)| score < best_score).unwrap_or(true) {
            best = Some((player.x, player.y, score));
        }
    }

    best.map(|(x, y, _)| (x, y))
}
