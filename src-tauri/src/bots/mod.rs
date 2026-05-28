mod deathmatch;
mod navigation;
mod zombie;

use std::collections::HashSet;

use crate::game::GameWorld;
use crate::protocol::Gamemode;

pub use deathmatch::update_deathmatch_bot;

const SIM_DT: f32 = 1.0 / 60.0;

pub fn update_bot_inputs(world: &mut GameWorld, bot_ids: &HashSet<u8>, dt: f32) {
    if world.match_ended {
        return;
    }

    let step = if dt > 0.0 { dt } else { SIM_DT };

    match world.gamemode {
        Gamemode::ZombieHorde => {
            let zombie_ids: Vec<u8> = world
                .players
                .values()
                .filter(|player| player.is_zombie && player.alive)
                .map(|player| player.id)
                .collect();
            for id in zombie_ids {
                zombie::update_zombie_bot(world, id, step);
            }
        }
        Gamemode::Deathmatch | Gamemode::LastMateStanding => {
            for id in bot_ids {
                if world
                    .players
                    .get(id)
                    .is_some_and(|player| player.is_bot && !player.is_zombie && player.alive)
                {
                    update_deathmatch_bot(world, *id, step);
                }
            }
        }
        _ => {}
    }
}

pub(crate) fn aim_input(from_x: f32, from_y: f32, to_x: f32, to_y: f32) -> (f32, f32) {
    let dx = to_x - from_x;
    let dy = to_y - from_y;
    crate::game::normalize(dx, dy)
}

pub(crate) fn set_bot_input(world: &mut GameWorld, id: u8, input: crate::protocol::InputSnapshot) {
    world.set_input(id, input);
}
