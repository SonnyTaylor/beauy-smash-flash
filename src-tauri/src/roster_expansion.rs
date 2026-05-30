//! Playable roster expansion: Sifan, Connor, Archie, Arthur, Oscar, Vlad,
//! Mango, Andrew, Lee, Martin, Tristan, Andy, Xander.

use std::collections::HashMap;

use crate::abilities::{add_charge, aim_direction, ABILITY_CHARGE_MAX};
use crate::game::{
    circle_hits_circle, circle_hits_walls, normalize, FollowerDrone, FollowerDroneKind, GameWorld,
    Player, WorldEffect, PLAYER_RADIUS,
};
use crate::protocol::{EffectKind, InputSnapshot};

// --- Sifan — Juice Heist ---
pub const SIFAN_STEAL_RANGE: f32 = 260.0;
const SIFAN_STEAL_AMOUNT: f32 = 40.0;
const SIFAN_GAIN_AMOUNT: f32 = 25.0;
pub const SIFAN_STEROID_DURATION: f32 = 5.0;
pub const SIFAN_STEROID_SPEED_MULT: f32 = 1.15;
pub const SIFAN_STEROID_DAMAGE_MULT: f32 = 1.15;
pub const SIFAN_CRASH_DURATION: f32 = 2.0;
pub const SIFAN_CRASH_SPEED_MULT: f32 = 0.85;

// --- Connor — MALICE Drop (v1: DoT + slow, no LoS occlusion) ---
const CONNOR_ZONE_RANGE: f32 = 300.0;
pub const CONNOR_ZONE_RADIUS: f32 = 170.0;
pub const CONNOR_ZONE_DURATION: f32 = 6.0;
const CONNOR_ZONE_DPS: f32 = 10.0;
const CONNOR_ZONE_SLOW_MULT: f32 = 0.85;

// --- Archie — Dexie Rush (jump_cut) ---
pub const ARCHIE_BLINK_RANGE: f32 = 280.0;
pub const ARCHIE_BLINK_BOOST_DURATION: f32 = 0.4;
pub const ARCHIE_BLINK_SPEED_MULT: f32 = 1.2;
pub const ARCHIE_CHARGE_PASSIVE_BONUS: f32 = 4.0;
pub const ARCHIE_RESTLESS_BONUS: f32 = 5.0;

// --- Arthur — Hot Lap ---
pub const ARTHUR_MAX_HP: u16 = 110;
pub const ARTHUR_HIT_RADIUS_MULT: f32 = 1.18;
pub const ARTHUR_KART_DURATION: f32 = 5.0;
pub const ARTHUR_KART_SPEED_MULT: f32 = 1.35;
const ARTHUR_OIL_INTERVAL: f32 = 0.2;
pub const ARTHUR_OIL_LIFE: f32 = 5.5;
const ARTHUR_OIL_RADIUS: f32 = 36.0;
const ARTHUR_OIL_DPS: f32 = 6.0;
const ARTHUR_OIL_SLOW_MULT: f32 = 0.7;

// --- Oscar — Deep Fried ---
pub const OSCAR_CHARGE_PASSIVE_PER_SEC: f32 = 4.5;
const OSCAR_OIL_RANGE: f32 = 280.0;
pub const OSCAR_OIL_RADIUS: f32 = 140.0;
pub const OSCAR_OIL_DURATION: f32 = 6.0;
pub const OSCAR_OIL_DPS: f32 = 12.0;
pub const OSCAR_OIL_BURST_DAMAGE: f32 = 40.0;

// --- Vlad — Going Viral ---
pub const VLAD_DRONE_COUNT: u8 = 3;
pub const VLAD_DRONE_DURATION: f32 = 7.0;
pub const VLAD_DRONE_HP: u16 = 15;
const VLAD_DRONE_DAMAGE: u16 = 6;
const VLAD_DRONE_FIRE_RATE: f32 = 0.8;
const VLAD_DRONE_RANGE: f32 = 520.0;
const VLAD_DRONE_ORBIT_RADIUS: f32 = 52.0;

// --- Mango — Overthink ---
pub const MANGO_OVERTHINK_RANGE: f32 = 400.0;
const MANGO_OVERTHINK_SPEED: f32 = 700.0;
const MANGO_OVERTHINK_ROOT_DURATION: f32 = 1.2;
const MANGO_OVERTHINK_MISS_REFUND: f32 = 50.0;
const MANGO_OVERTHINK_RADIUS: f32 = 12.0;
const MANGO_OVERTHINK_VFX_LIFE: f32 = 0.35;

// --- Andrew — Blur ---
const ANDREW_BLUR_RANGE: f32 = 300.0;
const ANDREW_BLUR_DURATION: f32 = 3.5;
const ANDREW_BLUR_DAMAGE_OUTPUT_MULT: f32 = 0.6;
const ABILITY_MISS_REFUND: f32 = 50.0;

// --- Lee — Feast ---
const LEE_FEAST_HEAL_INSTANT: u16 = 20;
const LEE_FEAST_DURATION: f32 = 6.0;
pub const LEE_FEAST_LIFESTEAL: f32 = 0.4;

// --- Martin — Off the Meds ---
pub const MARTIN_MAX_HP: u16 = 90;
const MARTIN_MEDS_DURATION: f32 = 5.0;
pub const MARTIN_MEDS_LIFESTEAL: f32 = 0.15;
const MARTIN_MEDS_FIRE_RATE_MULT: f32 = 1.3;
const MARTIN_MEDS_SPEED_MULT: f32 = 1.2;
const MARTIN_MEDS_DAMAGE_TAKEN_MULT: f32 = 1.25;

// --- Tristan — Ragebait ---
pub const TRISTAN_MAX_HP: u16 = 110;
const TRISTAN_RAGEBAIT_DURATION: f32 = 2.5;
const TRISTAN_RAGEBAIT_DAMAGE_MULT: f32 = 0.6;
pub const TRISTAN_RAGEBAIT_REFLECT: f32 = 0.4;

// --- Andy — Liquid Courage ---
const ANDY_LIQUID_COURAGE_DURATION: f32 = 5.0;
const ANDY_LIQUID_COURAGE_DAMAGE_MULT: f32 = 0.65;
const ANDY_LIQUID_COURAGE_HEAL_PER_SEC: f32 = 4.0;
const ANDY_AIM_SWAY: f32 = 0.08;
const LACHY_HP: u16 = 20;
const LACHY_DAMAGE: u16 = 12;
const LACHY_BITE_INTERVAL: f32 = 1.0;
const LACHY_MELEE_RANGE: f32 = 72.0;
const LACHY_CHASE_RANGE: f32 = 220.0;
const LACHY_MOVE_SPEED: f32 = 420.0;
const LACHY_FOLLOW_RADIUS: f32 = 72.0;
const LACHY_IDLE_OFFSET_X: f32 = -0.82;
const LACHY_IDLE_OFFSET_Y: f32 = 0.38;
const LACHY_PET_HIT_RADIUS: f32 = 18.0;

// --- Xander — Hyperfixation ---
pub const XANDER_HYPERFIXATION_WINDUP: f32 = 0.3;
const XANDER_HYPERFIXATION_DURATION: f32 = 1.5;
pub const XANDER_HYPERFIXATION_MOVE_MULT: f32 = 0.8;

pub fn is_kart_mode(player: &Player) -> bool {
    player.kart_mode_until > 0.0
}

pub fn hit_radius_for(player: &Player) -> f32 {
    if player.character_id == "arthur" {
        PLAYER_RADIUS * ARTHUR_HIT_RADIUS_MULT
    } else {
        PLAYER_RADIUS
    }
}

pub fn archie_passive_charge_bonus(player: &Player, inputs: &HashMap<u8, InputSnapshot>) -> f32 {
    if player.character_id != "archie" {
        return 0.0;
    }
    let input = inputs.get(&player.id).cloned().unwrap_or_default();
    let mut bonus = ARCHIE_CHARGE_PASSIVE_BONUS;
    if input.dx.abs() + input.dy.abs() > 0.05 {
        bonus += ARCHIE_RESTLESS_BONUS;
    }
    bonus
}

pub fn movement_speed_multiplier(player: &Player) -> f32 {
    let mut mult = 1.0;
    if player.steroid_buff_until > 0.0 {
        mult *= SIFAN_STEROID_SPEED_MULT;
    }
    if player.steroid_crash_until > 0.0 {
        mult *= SIFAN_CRASH_SPEED_MULT;
    }
    if player.jump_cut_boost_until > 0.0 {
        mult *= ARCHIE_BLINK_SPEED_MULT;
    }
    if is_kart_mode(player) {
        mult *= ARTHUR_KART_SPEED_MULT;
    }
    if player.off_the_meds_until > 0.0 {
        mult *= MARTIN_MEDS_SPEED_MULT;
    }
    mult
}

pub fn incoming_damage_multiplier(victim: &Player) -> f32 {
    let mut mult = 1.0;
    if victim.ragebait_until > 0.0 {
        mult *= TRISTAN_RAGEBAIT_DAMAGE_MULT;
    }
    if victim.liquid_courage_until > 0.0 {
        mult *= ANDY_LIQUID_COURAGE_DAMAGE_MULT;
    }
    if victim.off_the_meds_until > 0.0 {
        mult *= MARTIN_MEDS_DAMAGE_TAKEN_MULT;
    }
    mult
}

pub fn effective_fire_rate(player: &Player, base_fire_rate: f32) -> f32 {
    if player.off_the_meds_until > 0.0 {
        base_fire_rate / MARTIN_MEDS_FIRE_RATE_MULT
    } else {
        base_fire_rate
    }
}

pub fn combat_aim(player: &Player, aim_x: f32, aim_y: f32) -> (f32, f32) {
    if player.liquid_courage_until > 0.0 {
        normalize(aim_x + player.aim_sway_x, aim_y + player.aim_sway_y)
    } else {
        normalize(aim_x, aim_y)
    }
}

pub fn cleanse_debuffs(player: &mut Player) {
    player.controls_inverted_until = 0.0;
    player.slowed_until = 0.0;
    player.slow_multiplier = 1.0;
    player.marked_until = 0.0;
    player.mark_damage_multiplier = 1.0;
    player.rooted_until = 0.0;
    player.blur_until = 0.0;
    player.damage_output_multiplier = 1.0;
}

pub fn try_activate(world: &mut GameWorld, player_id: u8) {
    let character_id = world
        .players
        .get(&player_id)
        .map(|p| p.character_id.clone())
        .unwrap_or_default();

    match character_id.as_str() {
        "sifan" => activate_sifan(world, player_id),
        "connor" => activate_connor(world, player_id),
        "archie" => activate_archie(world, player_id),
        "arthur" => activate_arthur(world, player_id),
        "oscar" => activate_oscar(world, player_id),
        "vlad" => activate_vlad(world, player_id),
        "mango" => activate_mango(world, player_id),
        "andrew" => activate_andrew(world, player_id),
        "lee" => activate_lee(world, player_id),
        "martin" => activate_martin(world, player_id),
        "tristan" => activate_tristan(world, player_id),
        "andy" => activate_andy(world, player_id),
        "xander" => activate_xander(world, player_id),
        _ => {}
    }
}

pub fn tick_player_buffs(players: &mut HashMap<u8, Player>, dt: f32) {
    for player in players.values_mut() {
        if player.steroid_buff_until > 0.0 {
            player.steroid_buff_until = (player.steroid_buff_until - dt).max(0.0);
            player.damage_dealt_multiplier = SIFAN_STEROID_DAMAGE_MULT;
            if player.steroid_buff_until <= 0.0 {
                player.damage_dealt_multiplier = 1.0;
                player.steroid_crash_until = SIFAN_CRASH_DURATION;
            }
        }
        if player.steroid_crash_until > 0.0 {
            player.steroid_crash_until = (player.steroid_crash_until - dt).max(0.0);
        }
        if player.jump_cut_boost_until > 0.0 {
            player.jump_cut_boost_until = (player.jump_cut_boost_until - dt).max(0.0);
        }
        if player.kart_mode_until > 0.0 {
            player.kart_mode_until = (player.kart_mode_until - dt).max(0.0);
            player.kart_oil_timer += dt;
        }
        if player.off_the_meds_until > 0.0 {
            player.off_the_meds_until = (player.off_the_meds_until - dt).max(0.0);
        }
        if player.ragebait_until > 0.0 {
            player.ragebait_until = (player.ragebait_until - dt).max(0.0);
        }
        if player.liquid_courage_until > 0.0 {
            player.liquid_courage_until = (player.liquid_courage_until - dt).max(0.0);
            player.aim_sway_x = ((player.id as f32 * 17.0 + player.liquid_courage_until * 31.0)
                .sin())
                * ANDY_AIM_SWAY;
            player.aim_sway_y = ((player.id as f32 * 23.0 + player.liquid_courage_until * 37.0)
                .cos())
                * ANDY_AIM_SWAY;
            player.hp = player
                .hp
                .saturating_add((ANDY_LIQUID_COURAGE_HEAL_PER_SEC * dt).round() as u16)
                .min(player.max_hp);
            if player.liquid_courage_until <= 0.0 {
                player.aim_sway_x = 0.0;
                player.aim_sway_y = 0.0;
            }
        }
        if player.invulnerable_until > 0.0 {
            player.invulnerable_until = (player.invulnerable_until - dt).max(0.0);
        }
    }
}

pub fn process_world_systems(world: &mut GameWorld, dt: f32) {
    process_overthink_projectiles(world, dt);
    process_zones(world, dt);
    process_drones(world, dt);
    process_arthur_oil_spawns(world, dt);
}

fn activate_sifan(world: &mut GameWorld, caster_id: u8) {
    let (cx, cy) = world
        .players
        .get(&caster_id)
        .map(|p| (p.x, p.y))
        .unwrap_or((0.0, 0.0));

    if let Some(target_id) = nearest_enemy(world, caster_id, cx, cy, SIFAN_STEAL_RANGE) {
        if let Some(target) = world.players.get_mut(&target_id) {
            target.ability_charge = (target.ability_charge - SIFAN_STEAL_AMOUNT).max(0.0);
        }
    }

    if let Some(caster) = world.players.get_mut(&caster_id) {
        caster.ability_charge = 0.0;
        add_charge(caster, SIFAN_GAIN_AMOUNT);
        caster.steroid_buff_until = SIFAN_STEROID_DURATION;
        caster.steroid_crash_until = 0.0;
        caster.damage_dealt_multiplier = SIFAN_STEROID_DAMAGE_MULT;
    }

    let id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect::burst(
        id,
        EffectKind::Hack,
        cx,
        cy,
        40.0,
        0.45,
        caster_id,
    ));
}

fn activate_connor(world: &mut GameWorld, player_id: u8) {
    let Some((tx, ty)) = placement_point(world, player_id, CONNOR_ZONE_RANGE) else {
        return;
    };
    if let Some(player) = world.players.get_mut(&player_id) {
        player.ability_charge = 0.0;
    }
    spawn_zone_effect(
        world,
        player_id,
        tx,
        ty,
        EffectKind::MaliceZone,
        CONNOR_ZONE_RADIUS,
        CONNOR_ZONE_DURATION,
        0.0,
    );
}

fn activate_archie(world: &mut GameWorld, player_id: u8) {
    let Some((dir_x, dir_y)) = aim_direction(world, player_id) else {
        return;
    };
    blink_player(world, player_id, dir_x, dir_y, ARCHIE_BLINK_RANGE);
    if let Some(player) = world.players.get_mut(&player_id) {
        player.ability_charge = 0.0;
        player.jump_cut_boost_until = ARCHIE_BLINK_BOOST_DURATION;
    }
    let (x, y) = world
        .players
        .get(&player_id)
        .map(|p| (p.x, p.y))
        .unwrap_or((0.0, 0.0));
    let id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect::burst(
        id,
        EffectKind::Zap,
        x,
        y,
        36.0,
        0.35,
        player_id,
    ));
}

fn activate_arthur(world: &mut GameWorld, player_id: u8) {
    if let Some(player) = world.players.get_mut(&player_id) {
        player.kart_mode_until = ARTHUR_KART_DURATION;
        player.kart_oil_timer = 0.0;
        player.ability_charge = 0.0;
    }
    let (x, y) = world
        .players
        .get(&player_id)
        .map(|p| (p.x, p.y))
        .unwrap_or((0.0, 0.0));
    let id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect::burst(
        id,
        EffectKind::BoatSplash,
        x,
        y,
        44.0,
        0.4,
        player_id,
    ));
}

fn activate_oscar(world: &mut GameWorld, player_id: u8) {
    let Some((tx, ty)) = placement_point(world, player_id, OSCAR_OIL_RANGE) else {
        return;
    };
    if let Some(player) = world.players.get_mut(&player_id) {
        player.ability_charge = 0.0;
    }
    
    // Apply burst damage to enemies in the landing zone
    for victim_id in players_in_zone(world, tx, ty, OSCAR_OIL_RADIUS, player_id, true) {
        if world.damage_allowed(player_id, victim_id) {
            world.apply_damage(player_id, victim_id, OSCAR_OIL_BURST_DAMAGE as u16);
        }
    }

    spawn_zone_effect(
        world,
        player_id,
        tx,
        ty,
        EffectKind::OilSlick,
        OSCAR_OIL_RADIUS,
        OSCAR_OIL_DURATION,
        0.0,
    );
    
    let id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect::burst(
        id,
        EffectKind::BoatSplash, // reuse splash/shatter fx
        tx,
        ty,
        OSCAR_OIL_RADIUS,
        0.4,
        player_id,
    ));
}

fn activate_vlad(world: &mut GameWorld, player_id: u8) {
    if let Some(player) = world.players.get_mut(&player_id) {
        player.ability_charge = 0.0;
    }
    let (ox, oy) = world
        .players
        .get(&player_id)
        .map(|p| (p.x, p.y))
        .unwrap_or((0.0, 0.0));

    for i in 0..VLAD_DRONE_COUNT {
        let angle = (i as f32) * std::f32::consts::TAU / VLAD_DRONE_COUNT as f32;
        let id = world.next_drone_id;
        world.next_drone_id += 1;
        world.follower_drones.push(FollowerDrone {
            id,
            owner_id: player_id,
            x: ox + angle.cos() * VLAD_DRONE_ORBIT_RADIUS,
            y: oy + angle.sin() * VLAD_DRONE_ORBIT_RADIUS,
            hp: VLAD_DRONE_HP,
            life: VLAD_DRONE_DURATION,
            fire_cooldown: 0.15 * i as f32,
            orbit_angle: angle,
            kind: FollowerDroneKind::OrbitRanged,
        });
    }

    let id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect::burst(
        id,
        EffectKind::DirectorsCut,
        ox,
        oy,
        48.0,
        0.4,
        player_id,
    ));
}

fn activate_martin(world: &mut GameWorld, player_id: u8) {
    if let Some(player) = world.players.get_mut(&player_id) {
        player.ability_charge = 0.0;
        player.off_the_meds_until = MARTIN_MEDS_DURATION;
    }
    let (cx, cy) = world
        .players
        .get(&player_id)
        .map(|p| (p.x, p.y))
        .unwrap_or((0.0, 0.0));
    let id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect::burst(
        id,
        EffectKind::DirectorsCut,
        cx,
        cy,
        44.0,
        0.45,
        player_id,
    ));
}

fn activate_tristan(world: &mut GameWorld, player_id: u8) {
    if let Some(player) = world.players.get_mut(&player_id) {
        player.ability_charge = 0.0;
        player.ragebait_until = TRISTAN_RAGEBAIT_DURATION;
    }
    let (cx, cy) = world
        .players
        .get(&player_id)
        .map(|p| (p.x, p.y))
        .unwrap_or((0.0, 0.0));
    let id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect::burst(
        id,
        EffectKind::ReelShield,
        cx,
        cy,
        40.0,
        0.35,
        player_id,
    ));
}

fn activate_andy(world: &mut GameWorld, player_id: u8) {
    if let Some(player) = world.players.get_mut(&player_id) {
        player.ability_charge = 0.0;
        player.liquid_courage_until = ANDY_LIQUID_COURAGE_DURATION;
    }

    world
        .follower_drones
        .retain(|d| !(d.owner_id == player_id && d.kind == FollowerDroneKind::MeleePet));

    let (ox, oy) = world
        .players
        .get(&player_id)
        .map(|p| (p.x, p.y))
        .unwrap_or((0.0, 0.0));
    let id = world.next_drone_id;
    world.next_drone_id += 1;
    world.follower_drones.push(FollowerDrone {
        id,
        owner_id: player_id,
        x: ox + LACHY_FOLLOW_RADIUS * LACHY_IDLE_OFFSET_X,
        y: oy + LACHY_FOLLOW_RADIUS * LACHY_IDLE_OFFSET_Y,
        hp: LACHY_HP,
        life: ANDY_LIQUID_COURAGE_DURATION,
        fire_cooldown: 0.0,
        orbit_angle: 0.0,
        kind: FollowerDroneKind::MeleePet,
    });

    let vfx_id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect::burst(
        vfx_id,
        EffectKind::BoatSplash,
        ox,
        oy,
        36.0,
        0.4,
        player_id,
    ));
}

fn activate_xander(world: &mut GameWorld, player_id: u8) {
    if let Some(player) = world.players.get_mut(&player_id) {
        player.ability_windup = XANDER_HYPERFIXATION_WINDUP;
        player.ability_charge = 0.0;
    }
}

pub fn fire_xander_hyperfixation(world: &mut GameWorld, player_id: u8) {
    if let Some(player) = world.players.get_mut(&player_id) {
        cleanse_debuffs(player);
        player.invulnerable_until = XANDER_HYPERFIXATION_DURATION;
    }
    let (cx, cy) = world
        .players
        .get(&player_id)
        .map(|p| (p.x, p.y))
        .unwrap_or((0.0, 0.0));
    let id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect::burst(
        id,
        EffectKind::ChiChannel,
        cx,
        cy,
        36.0,
        0.35,
        player_id,
    ));
}

fn activate_mango(world: &mut GameWorld, player_id: u8) {
    let Some((dir_x, dir_y)) = aim_direction(world, player_id) else {
        return;
    };
    let (origin_x, origin_y) = {
        let Some(player) = world.players.get(&player_id) else {
            return;
        };
        (
            player.x + dir_x * (PLAYER_RADIUS + 8.0),
            player.y + dir_y * (PLAYER_RADIUS + 8.0),
        )
    };

    if let Some(player) = world.players.get_mut(&player_id) {
        player.ability_charge = 0.0;
    }

    let travel_time = MANGO_OVERTHINK_RANGE / MANGO_OVERTHINK_SPEED;
    let id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect {
        id,
        kind: EffectKind::Overthink,
        x: origin_x,
        y: origin_y,
        radius: MANGO_OVERTHINK_RADIUS,
        life: travel_time,
        owner_id: player_id,
        origin_x,
        origin_y,
        target_x: dir_x,
        target_y: dir_y,
        max_life: travel_time,
        hit_players: Vec::new(),
        zone_hp: 0.0,
        zone_damage_accum: 0.0,
        zone_heal_accum: 0.0,
    });
}

fn activate_andrew(world: &mut GameWorld, player_id: u8) {
    let (cx, cy) = world
        .players
        .get(&player_id)
        .map(|p| (p.x, p.y))
        .unwrap_or((0.0, 0.0));

    let target_id = nearest_enemy(world, player_id, cx, cy, ANDREW_BLUR_RANGE);

    let Some(target_id) = target_id else {
        if let Some(caster) = world.players.get_mut(&player_id) {
            caster.ability_charge = ABILITY_MISS_REFUND;
        }
        return;
    };

    if let Some(target) = world.players.get_mut(&target_id) {
        target.blur_until = ANDREW_BLUR_DURATION;
        target.damage_output_multiplier = ANDREW_BLUR_DAMAGE_OUTPUT_MULT;
    }
    if let Some(caster) = world.players.get_mut(&player_id) {
        caster.ability_charge = 0.0;
    }

    let (tx, ty) = world
        .players
        .get(&target_id)
        .map(|player| (player.x, player.y))
        .unwrap_or((cx, cy));
    let id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect::burst(
        id,
        EffectKind::Hack,
        tx,
        ty,
        ANDREW_BLUR_RANGE,
        0.45,
        player_id,
    ));
}

fn activate_lee(world: &mut GameWorld, player_id: u8) {
    if let Some(player) = world.players.get_mut(&player_id) {
        player.ability_charge = 0.0;
        player.hp = player
            .hp
            .saturating_add(LEE_FEAST_HEAL_INSTANT)
            .min(player.max_hp);
        player.feast_until = LEE_FEAST_DURATION;
    }

    let (cx, cy) = world
        .players
        .get(&player_id)
        .map(|p| (p.x, p.y))
        .unwrap_or((0.0, 0.0));
    let id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect::burst(
        id,
        EffectKind::Mark,
        cx,
        cy,
        36.0,
        0.4,
        player_id,
    ));
}

fn process_overthink_projectiles(world: &mut GameWorld, dt: f32) {
    let walls = world.map.walls.clone();
    let mut hits: Vec<(u8, u8, f32, f32)> = Vec::new();
    let mut misses: Vec<u8> = Vec::new();
    let mut expired_ids: Vec<u32> = Vec::new();

    let snapshots: Vec<(u32, u8, f32, f32, f32, f32, f32)> = world
        .effects
        .iter()
        .filter(|effect| effect.kind == EffectKind::Overthink)
        .map(|effect| {
            (
                effect.id,
                effect.owner_id,
                effect.x,
                effect.y,
                effect.target_x,
                effect.target_y,
                effect.life,
            )
        })
        .collect();

    for (id, owner_id, mut x, mut y, dir_x, dir_y, life) in snapshots {
        x += dir_x * MANGO_OVERTHINK_SPEED * dt;
        y += dir_y * MANGO_OVERTHINK_SPEED * dt;
        let new_life = life - dt;

        if let Some(effect) = world.effects.iter_mut().find(|effect| effect.id == id) {
            effect.x = x;
            effect.y = y;
            effect.life = new_life;
        }

        if circle_hits_walls(x, y, MANGO_OVERTHINK_RADIUS, &walls) {
            misses.push(owner_id);
            expired_ids.push(id);
            continue;
        }

        if let Some(victim_id) = find_overthink_hit(world, owner_id, x, y) {
            hits.push((owner_id, victim_id, x, y));
            expired_ids.push(id);
            continue;
        }

        if new_life <= 0.0 {
            misses.push(owner_id);
            expired_ids.push(id);
        }
    }

    world
        .effects
        .retain(|effect| effect.kind != EffectKind::Overthink || !expired_ids.contains(&effect.id));

    for (owner_id, victim_id, hit_x, hit_y) in hits {
        if let Some(victim) = world.players.get_mut(&victim_id) {
            victim.rooted_until = MANGO_OVERTHINK_ROOT_DURATION;
        }
        let id = world.next_effect_id;
        world.next_effect_id += 1;
        world.effects.push(WorldEffect::burst(
            id,
            EffectKind::Hack,
            hit_x,
            hit_y,
            28.0,
            MANGO_OVERTHINK_VFX_LIFE,
            owner_id,
        ));
    }

    for owner_id in misses {
        if let Some(caster) = world.players.get_mut(&owner_id) {
            caster.ability_charge = MANGO_OVERTHINK_MISS_REFUND;
        }
    }
}

fn find_overthink_hit(world: &GameWorld, owner_id: u8, proj_x: f32, proj_y: f32) -> Option<u8> {
    let mut best: Option<(u8, f32)> = None;
    for player in world.players.values() {
        if !player.alive || player.id == owner_id || player.spawn_protected() {
            continue;
        }
        let hit_radius = hit_radius_for(player);
        if circle_hits_circle(
            proj_x,
            proj_y,
            MANGO_OVERTHINK_RADIUS,
            player.x,
            player.y,
            hit_radius,
        ) {
            let dist_sq = distance_sq(proj_x, proj_y, player.x, player.y);
            if best
                .map(|(_, best_dist)| dist_sq < best_dist)
                .unwrap_or(true)
            {
                best = Some((player.id, dist_sq));
            }
        }
    }
    best.map(|(id, _)| id)
}

fn spawn_zone_effect(
    world: &mut GameWorld,
    owner_id: u8,
    x: f32,
    y: f32,
    kind: EffectKind,
    radius: f32,
    duration: f32,
    zone_hp: f32,
) {
    let id = world.next_effect_id;
    world.next_effect_id += 1;
    world.effects.push(WorldEffect {
        id,
        kind,
        x,
        y,
        radius,
        life: duration,
        owner_id,
        origin_x: x,
        origin_y: y,
        target_x: 0.0,
        target_y: 0.0,
        max_life: duration,
        hit_players: Vec::new(),
        zone_hp,
        zone_damage_accum: 0.0,
        zone_heal_accum: 0.0,
    });
}

fn process_zones(world: &mut GameWorld, dt: f32) {
    #[derive(Clone, Copy)]
    struct ZoneSnap {
        kind: EffectKind,
        x: f32,
        y: f32,
        radius: f32,
        owner_id: u8,
        zone_hp: f32,
        damage_ticks: u32,
        heal_ticks: u32,
    }

    let mut snaps: Vec<ZoneSnap> = Vec::new();

    for effect in &mut world.effects {
        if effect.kind != EffectKind::MaliceZone
            && effect.kind != EffectKind::FoodTray
            && effect.kind != EffectKind::OilSlick
        {
            continue;
        }

        effect.life -= dt;
        let mut damage_ticks = 0u32;
        let mut heal_ticks = 0u32;

        match effect.kind {
            EffectKind::MaliceZone => {
                effect.zone_damage_accum += CONNOR_ZONE_DPS * dt;
                while effect.zone_damage_accum >= 1.0 {
                    effect.zone_damage_accum -= 1.0;
                    damage_ticks += 1;
                }
            }
            EffectKind::FoodTray => {
                // Not used anymore, replaced by Deep Fried
            }
            EffectKind::OilSlick => {
                let dps = if effect.owner_id == 11 { OSCAR_OIL_DPS } else { ARTHUR_OIL_DPS };
                effect.zone_damage_accum += dps * dt;
                while effect.zone_damage_accum >= 1.0 {
                    effect.zone_damage_accum -= 1.0;
                    damage_ticks += 1;
                }
            }
            _ => {}
        }

        snaps.push(ZoneSnap {
            kind: effect.kind,
            x: effect.x,
            y: effect.y,
            radius: effect.radius,
            owner_id: effect.owner_id,
            zone_hp: effect.zone_hp,
            damage_ticks,
            heal_ticks,
        });
    }

    let mut damage_events: Vec<(u8, u8)> = Vec::new();
    let mut slow_targets: Vec<(u8, f32)> = Vec::new();

    for zone in snaps {
        if zone.damage_ticks > 0
            && matches!(zone.kind, EffectKind::MaliceZone | EffectKind::OilSlick)
        {
            let slow_mult = if zone.kind == EffectKind::MaliceZone {
                CONNOR_ZONE_SLOW_MULT
            } else {
                ARTHUR_OIL_SLOW_MULT
            };
            for victim_id in
                players_in_zone(world, zone.x, zone.y, zone.radius, zone.owner_id, true)
            {
                if zone.kind == EffectKind::OilSlick && victim_id == zone.owner_id {
                    continue;
                }
                slow_targets.push((victim_id, slow_mult));
            }
            for _ in 0..zone.damage_ticks {
                for victim_id in
                    players_in_zone(world, zone.x, zone.y, zone.radius, zone.owner_id, true)
                {
                    if zone.kind == EffectKind::OilSlick && victim_id == zone.owner_id {
                        continue;
                    }
                    if world.damage_allowed(zone.owner_id, victim_id) {
                        damage_events.push((zone.owner_id, victim_id));
                    }
                }
            }
        }

        if zone.heal_ticks > 0 && zone.kind == EffectKind::FoodTray && zone.zone_hp > 0.0 {
            for _ in 0..zone.heal_ticks {
                for pid in players_in_zone(world, zone.x, zone.y, zone.radius, zone.owner_id, false)
                {
                    if let Some(player) = world.players.get_mut(&pid) {
                        if player.alive {
                            player.hp = (player.hp + 1).min(player.max_hp);
                        }
                    }
                }
            }
        }
    }

    for (victim_id, slow_mult) in slow_targets {
        if let Some(victim) = world.players.get_mut(&victim_id) {
            victim.slowed_until = victim.slowed_until.max(0.15);
            victim.slow_multiplier = victim.slow_multiplier.min(slow_mult);
        }
    }

    for (owner_id, victim_id) in damage_events {
        world.apply_damage(owner_id, victim_id, 1);
    }

    world.effects.retain(|e| {
        if e.kind == EffectKind::MaliceZone || e.kind == EffectKind::OilSlick {
            return e.life > 0.0;
        }
        if e.kind == EffectKind::FoodTray {
            return e.life > 0.0 && e.zone_hp > 0.0;
        }
        true
    });
}

fn process_arthur_oil_spawns(world: &mut GameWorld, _dt: f32) {
    let spawners: Vec<(u8, f32, f32, f32)> = world
        .players
        .values()
        .filter(|p| p.alive && is_kart_mode(p))
        .map(|p| (p.id, p.x, p.y, p.kart_oil_timer))
        .collect();

    for (id, x, y, timer) in spawners {
        if let Some(player) = world.players.get_mut(&id) {
            if timer >= ARTHUR_OIL_INTERVAL {
                player.kart_oil_timer = 0.0;
                spawn_zone_effect(
                    world,
                    id,
                    x,
                    y,
                    EffectKind::OilSlick,
                    ARTHUR_OIL_RADIUS,
                    ARTHUR_OIL_LIFE,
                    0.0,
                );
            }
        }
    }
}

fn process_drones(world: &mut GameWorld, dt: f32) {
    let owners: HashMap<u8, (f32, f32)> = world
        .players
        .iter()
        .filter(|(_, p)| p.alive)
        .map(|(id, p)| (*id, (p.x, p.y)))
        .collect();

    let walls = world.map.walls.clone();

    let pet_moves: Vec<(u32, f32, f32)> = world
        .follower_drones
        .iter()
        .filter(|d| d.kind == FollowerDroneKind::MeleePet)
        .map(|d| {
            let (ox, oy) = owners.get(&d.owner_id).copied().unwrap_or((d.x, d.y));
            let (target_x, target_y, in_bite_range) =
                melee_pet_target(world, d.owner_id, d.x, d.y, ox, oy);
            if in_bite_range {
                return (d.id, d.x, d.y);
            }
            let (dir_x, dir_y) = normalize(target_x - d.x, target_y - d.y);
            let step = LACHY_MOVE_SPEED * dt;
            let next_x = d.x + dir_x * step;
            let next_y = d.y + dir_y * step;
            if circle_hits_walls(next_x, next_y, 12.0, &walls) {
                (d.id, d.x, d.y)
            } else {
                (d.id, next_x, next_y)
            }
        })
        .collect();

    for drone in &mut world.follower_drones {
        drone.life -= dt;
        drone.fire_cooldown = (drone.fire_cooldown - dt).max(0.0);
        if let Some((ox, oy)) = owners.get(&drone.owner_id).copied() {
            match drone.kind {
                FollowerDroneKind::OrbitRanged => {
                    drone.orbit_angle += dt * 2.2;
                    drone.x = ox + drone.orbit_angle.cos() * VLAD_DRONE_ORBIT_RADIUS;
                    drone.y = oy + drone.orbit_angle.sin() * VLAD_DRONE_ORBIT_RADIUS;
                }
                FollowerDroneKind::MeleePet => {
                    if let Some((_, x, y)) = pet_moves.iter().find(|(id, _, _)| *id == drone.id) {
                        drone.x = *x;
                        drone.y = *y;
                    }
                }
            }
        }
    }

    let ranged_snapshots: Vec<(u32, u8, f32, f32, f32, f32, u16)> = world
        .follower_drones
        .iter()
        .filter(|d| d.kind == FollowerDroneKind::OrbitRanged)
        .map(|d| (d.id, d.owner_id, d.x, d.y, d.fire_cooldown, d.life, d.hp))
        .collect();

    let mut ranged_shots: Vec<(u8, u8, f32, f32)> = Vec::new();
    let mut ranged_fire_ids: Vec<u32> = Vec::new();

    for (id, owner, x, y, cooldown, life, hp) in ranged_snapshots {
        if cooldown <= 0.0 && life > 0.0 && hp > 0 {
            if let Some(target_id) = nearest_enemy(world, owner, x, y, VLAD_DRONE_RANGE) {
                if world.damage_allowed(owner, target_id) {
                    ranged_shots.push((owner, target_id, x, y));
                    ranged_fire_ids.push(id);
                }
            }
        }
    }

    for drone in &mut world.follower_drones {
        if ranged_fire_ids.contains(&drone.id) && drone.fire_cooldown <= 0.0 {
            drone.fire_cooldown = VLAD_DRONE_FIRE_RATE;
        }
    }

    for (owner_id, target_id, x, y) in ranged_shots {
        world.apply_damage(owner_id, target_id, VLAD_DRONE_DAMAGE);
        let id = world.next_effect_id;
        world.next_effect_id += 1;
        world.effects.push(WorldEffect::burst(
            id,
            EffectKind::Zap,
            x,
            y,
            14.0,
            0.2,
            owner_id,
        ));
    }

    let melee_snapshots: Vec<(u32, u8, f32, f32, f32, u16)> = world
        .follower_drones
        .iter()
        .filter(|d| d.kind == FollowerDroneKind::MeleePet)
        .map(|d| (d.id, d.owner_id, d.x, d.y, d.fire_cooldown, d.hp))
        .collect();

    let mut melee_bites: Vec<(u8, u8, f32, f32)> = Vec::new();
    let mut melee_fire_ids: Vec<u32> = Vec::new();

    for (id, owner, x, y, cooldown, hp) in melee_snapshots {
        if cooldown <= 0.0 && hp > 0 {
            if let Some(target_id) = nearest_enemy(world, owner, x, y, LACHY_MELEE_RANGE) {
                if world.damage_allowed(owner, target_id) {
                    melee_bites.push((owner, target_id, x, y));
                    melee_fire_ids.push(id);
                }
            }
        }
    }

    for drone in &mut world.follower_drones {
        if melee_fire_ids.contains(&drone.id) {
            drone.fire_cooldown = LACHY_BITE_INTERVAL;
        }
    }

    for (owner_id, target_id, x, y) in melee_bites {
        world.apply_damage(owner_id, target_id, LACHY_DAMAGE);
        let id = world.next_effect_id;
        world.next_effect_id += 1;
        world.effects.push(WorldEffect::burst(
            id,
            EffectKind::Slash,
            x,
            y,
            18.0,
            0.25,
            owner_id,
        ));
    }

    world.follower_drones.retain(|d| d.life > 0.0 && d.hp > 0);
}

fn melee_pet_target(
    world: &GameWorld,
    owner_id: u8,
    pet_x: f32,
    pet_y: f32,
    owner_x: f32,
    owner_y: f32,
) -> (f32, f32, bool) {
    if let Some(target_id) = nearest_enemy(world, owner_id, pet_x, pet_y, LACHY_CHASE_RANGE) {
        if let Some(target) = world.players.get(&target_id) {
            let dx = target.x - pet_x;
            let dy = target.y - pet_y;
            let in_bite_range = dx * dx + dy * dy <= LACHY_MELEE_RANGE * LACHY_MELEE_RANGE;
            return (target.x, target.y, in_bite_range);
        }
    }

    let to_pet_x = pet_x - owner_x;
    let to_pet_y = pet_y - owner_y;
    let dist_sq = to_pet_x * to_pet_x + to_pet_y * to_pet_y;
    let (ux, uy) = if dist_sq > 1.0 {
        let dist = dist_sq.sqrt();
        (to_pet_x / dist, to_pet_y / dist)
    } else {
        let len = (LACHY_IDLE_OFFSET_X * LACHY_IDLE_OFFSET_X
            + LACHY_IDLE_OFFSET_Y * LACHY_IDLE_OFFSET_Y)
            .sqrt()
            .max(0.001);
        (LACHY_IDLE_OFFSET_X / len, LACHY_IDLE_OFFSET_Y / len)
    };
    let anchor_x = owner_x + ux * LACHY_FOLLOW_RADIUS;
    let anchor_y = owner_y + uy * LACHY_FOLLOW_RADIUS;

    let to_anchor_x = anchor_x - pet_x;
    let to_anchor_y = anchor_y - pet_y;
    if to_anchor_x * to_anchor_x + to_anchor_y * to_anchor_y <= 36.0 {
        return (pet_x, pet_y, false);
    }
    (anchor_x, anchor_y, false)
}

pub fn process_tray_bullet_hits(world: &mut GameWorld) {
    let trays: Vec<(u32, f32, f32)> = world
        .effects
        .iter()
        .filter(|e| e.kind == EffectKind::FoodTray && e.zone_hp > 0.0)
        .map(|e| (e.id, e.x, e.y))
        .collect();

    if trays.is_empty() {
        return;
    }

    let mut remove_bullet_ids = Vec::new();
    for bullet in &world.bullets {
        for (tray_id, tx, ty) in &trays {
            if circle_hits_circle(
                bullet.x,
                bullet.y,
                bullet.radius,
                *tx,
                *ty,
                42.0, // Former OSCAR_TRAY_HIT_RADIUS
            ) {
                if let Some(effect) = world.effects.iter_mut().find(|e| e.id == *tray_id) {
                    effect.zone_hp -= bullet.damage as f32;
                }
                remove_bullet_ids.push(bullet.id);
                break;
            }
        }
    }

    if !remove_bullet_ids.is_empty() {
        world.bullets.retain(|b| !remove_bullet_ids.contains(&b.id));
    }
}

pub fn process_drone_bullet_hits(world: &mut GameWorld) {
    let mut hits: Vec<(u32, u16)> = Vec::new();
    for bullet in &world.bullets {
        for drone in &world.follower_drones {
            let hit_radius = if drone.kind == FollowerDroneKind::MeleePet {
                LACHY_PET_HIT_RADIUS
            } else {
                12.0
            };
            if circle_hits_circle(
                bullet.x,
                bullet.y,
                bullet.radius,
                drone.x,
                drone.y,
                hit_radius,
            ) {
                hits.push((drone.id, bullet.damage));
                break;
            }
        }
    }
    if hits.is_empty() {
        return;
    }
    let remove_ids: std::collections::HashSet<u32> = world
        .bullets
        .iter()
        .filter(|b| {
            world.follower_drones.iter().any(|d| {
                let hit_radius = if d.kind == FollowerDroneKind::MeleePet {
                    LACHY_PET_HIT_RADIUS
                } else {
                    12.0
                };
                circle_hits_circle(b.x, b.y, b.radius, d.x, d.y, hit_radius)
            })
        })
        .map(|b| b.id)
        .collect();

    for (drone_id, damage) in hits {
        if let Some(drone) = world.follower_drones.iter_mut().find(|d| d.id == drone_id) {
            drone.hp = drone.hp.saturating_sub(damage);
        }
    }
    world.bullets.retain(|b| !remove_ids.contains(&b.id));
}

fn players_in_zone(
    world: &GameWorld,
    zx: f32,
    zy: f32,
    radius: f32,
    owner_id: u8,
    enemies_only: bool,
) -> Vec<u8> {
    world
        .players
        .values()
        .filter(|p| {
            if !p.alive || p.spawn_protected() {
                return false;
            }
            if enemies_only && !world.damage_allowed(owner_id, p.id) {
                return false;
            }
            if !enemies_only {
                // heal allies + owner
                if p.id != owner_id && world.damage_allowed(owner_id, p.id) {
                    return false;
                }
            }
            circle_hits_circle(p.x, p.y, hit_radius_for(p), zx, zy, radius)
        })
        .map(|p| p.id)
        .collect()
}

fn nearest_enemy(world: &GameWorld, caster_id: u8, x: f32, y: f32, range: f32) -> Option<u8> {
    let range_sq = range * range;
    world
        .players
        .values()
        .filter(|p| {
            p.alive
                && p.id != caster_id
                && !p.spawn_protected()
                && distance_sq(x, y, p.x, p.y) <= range_sq
        })
        .min_by(|a, b| {
            distance_sq(x, y, a.x, a.y)
                .partial_cmp(&distance_sq(x, y, b.x, b.y))
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|p| p.id)
}

fn placement_point(world: &GameWorld, player_id: u8, range: f32) -> Option<(f32, f32)> {
    let player = world.players.get(&player_id)?;
    let input = world.inputs.get(&player_id).cloned().unwrap_or_default();
    let (ax, ay) = normalize(input.aim_x, input.aim_y);
    let angle = if ax == 0.0 && ay == 0.0 {
        player.angle
    } else {
        ay.atan2(ax)
    };
    let tx =
        (player.x + angle.cos() * range).clamp(PLAYER_RADIUS, world.config.width - PLAYER_RADIUS);
    let ty =
        (player.y + angle.sin() * range).clamp(PLAYER_RADIUS, world.config.height - PLAYER_RADIUS);
    Some((tx, ty))
}

fn blink_player(world: &mut GameWorld, player_id: u8, dir_x: f32, dir_y: f32, max_dist: f32) {
    let (dir_x, dir_y) = normalize(dir_x, dir_y);
    let Some(player) = world.players.get(&player_id) else {
        return;
    };
    let walls = world.map.walls.clone();
    let start_x = player.x;
    let start_y = player.y;
    let radius = hit_radius_for(player);

    let step = 8.0;
    let mut travelled = 0.0_f32;
    let mut best_x = start_x;
    let mut best_y = start_y;

    while travelled < max_dist {
        let next_travel = (travelled + step).min(max_dist);
        let nx = start_x + dir_x * next_travel;
        let ny = start_y + dir_y * next_travel;
        if circle_hits_walls(nx, ny, radius, &walls) {
            break;
        }
        best_x = nx;
        best_y = ny;
        travelled = next_travel;
    }

    if let Some(player) = world.players.get_mut(&player_id) {
        player.x = best_x.clamp(PLAYER_RADIUS, world.config.width - PLAYER_RADIUS);
        player.y = best_y.clamp(PLAYER_RADIUS, world.config.height - PLAYER_RADIUS);
    }
}

fn distance_sq(x1: f32, y1: f32, x2: f32, y2: f32) -> f32 {
    let dx = x1 - x2;
    let dy = y1 - y2;
    dx * dx + dy * dy
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game::GameWorld;
    use crate::protocol::{Gamemode, WinCondition};

    #[test]
    fn sifan_drains_enemy_charge() {
        let mut world = GameWorld::default();
        world.add_player(0, "Sifan".into(), "sifan".into(), "glock".into());
        world.add_player(1, "Victim".into(), "bailey".into(), "glock".into());
        world.reset_for_match(
            20,
            0,
            WinCondition::Kills,
            Gamemode::Deathmatch,
            true,
            false,
            0,
        );
        world.players.get_mut(&0).unwrap().ability_charge = ABILITY_CHARGE_MAX;
        world.players.get_mut(&0).unwrap().spawn_protection = 0.0;
        world.players.get_mut(&1).unwrap().spawn_protection = 0.0;
        world.players.get_mut(&1).unwrap().ability_charge = 80.0;
        world.players.get_mut(&0).unwrap().x = 100.0;
        world.players.get_mut(&1).unwrap().x = 200.0;
        world.players.get_mut(&0).unwrap().y = 100.0;
        world.players.get_mut(&1).unwrap().y = 100.0;

        activate_sifan(&mut world, 0);
        assert!(world.players.get(&1).unwrap().ability_charge <= 40.0);
        assert!(world.players.get(&0).unwrap().steroid_buff_until > 0.0);
    }

    #[test]
    fn archie_blink_moves_player() {
        let mut world = GameWorld::default();
        world.add_player(0, "Archie".into(), "archie".into(), "glock".into());
        world.reset_for_match(
            20,
            0,
            WinCondition::Kills,
            Gamemode::Deathmatch,
            true,
            false,
            0,
        );
        let start_x = world.players.get(&0).unwrap().x;
        blink_player(&mut world, 0, 1.0, 0.0, ARCHIE_BLINK_RANGE);
        assert!(world.players.get(&0).unwrap().x > start_x);
    }

    #[test]
    fn arthur_number_77_enters_kart_mode() {
        let mut world = GameWorld::default();
        world.add_player(0, "Arthur".into(), "arthur".into(), "glock".into());
        world.reset_for_match(
            20,
            0,
            WinCondition::Kills,
            Gamemode::Deathmatch,
            true,
            false,
            0,
        );
        world.players.get_mut(&0).unwrap().spawn_protection = 0.0;
        activate_arthur(&mut world, 0);
        assert!(world.players.get(&0).unwrap().kart_mode_until > 0.0);
    }

    #[test]
    fn arthur_oil_does_not_harm_caster() {
        let mut world = GameWorld::default();
        world.friendly_fire = true;
        world.add_player(0, "Arthur".into(), "arthur".into(), "glock".into());
        world.reset_for_match(
            20,
            0,
            WinCondition::Kills,
            Gamemode::Deathmatch,
            true,
            false,
            0,
        );
        world.players.get_mut(&0).unwrap().spawn_protection = 0.0;
        let (x, y) = {
            let p = world.players.get(&0).unwrap();
            (p.x, p.y)
        };
        let hp_before = world.players.get(&0).unwrap().hp;
        spawn_zone_effect(
            &mut world,
            0,
            x,
            y,
            EffectKind::OilSlick,
            ARTHUR_OIL_RADIUS,
            2.0,
            0.0,
        );
        process_zones(&mut world, 1.0);
        let p = world.players.get(&0).unwrap();
        assert_eq!(p.hp, hp_before);
        assert!(p.slowed_until <= 0.0);
    }

    #[test]
    fn connor_malice_zone_respects_friendly_fire_off() {
        let mut world = GameWorld::default();
        world.friendly_fire = false;
        world.add_player(0, "Connor".into(), "connor".into(), "glock".into());
        world.add_player(1, "Victim".into(), "sonny".into(), "glock".into());
        world.reset_for_match(
            20,
            0,
            WinCondition::Kills,
            Gamemode::Deathmatch,
            false,
            false,
            0,
        );
        world.players.get_mut(&1).unwrap().spawn_protection = 0.0;
        let (vx, vy) = {
            let v = world.players.get(&1).unwrap();
            (v.x, v.y)
        };
        let hp_before = world.players.get(&1).unwrap().hp;
        spawn_zone_effect(
            &mut world,
            0,
            vx,
            vy,
            EffectKind::MaliceZone,
            CONNOR_ZONE_RADIUS,
            1.0,
            0.0,
        );
        for _ in 0..30 {
            process_zones(&mut world, 1.0 / 10.0);
        }
        assert_eq!(world.players.get(&1).unwrap().hp, hp_before);
    }

    #[test]
    fn mango_overthink_roots_but_allows_fire() {
        use crate::protocol::InputSnapshot;

        let mut world = GameWorld::default();
        world.add_player(0, "Mango".into(), "mango".into(), "glock".into());
        world.add_player(1, "Target".into(), "sonny".into(), "glock".into());
        world.reset_for_match(
            20,
            0,
            WinCondition::Kills,
            Gamemode::Deathmatch,
            true,
            false,
            0,
        );
        {
            let mango = world.players.get_mut(&0).unwrap();
            mango.x = 100.0;
            mango.y = 200.0;
            mango.spawn_protection = 0.0;
            mango.ability_charge = ABILITY_CHARGE_MAX;
            let target = world.players.get_mut(&1).unwrap();
            target.x = 250.0;
            target.y = 200.0;
            target.spawn_protection = 0.0;
        }
        world.inputs.insert(
            0,
            InputSnapshot {
                aim_x: 1.0,
                aim_y: 0.0,
                ..Default::default()
            },
        );

        activate_mango(&mut world, 0);
        for _ in 0..60 {
            process_overthink_projectiles(&mut world, 1.0 / 60.0);
        }
        assert!(world.players.get(&1).unwrap().rooted_until > 0.0);

        let start_x = world.players.get(&1).unwrap().x;
        world.inputs.insert(
            1,
            InputSnapshot {
                dx: 1.0,
                aim_x: 1.0,
                fire: true,
                ..Default::default()
            },
        );
        world.tick(1.0 / 60.0);
        assert_eq!(world.players.get(&1).unwrap().x, start_x);
        assert!(world.players.get(&1).unwrap().fire_cooldown > 0.0);
    }

    #[test]
    fn andrew_blur_reduces_target_outgoing_damage() {
        let mut world = GameWorld::default();
        world.add_player(0, "Andrew".into(), "andrew".into(), "glock".into());
        world.add_player(1, "Blurred".into(), "sonny".into(), "glock".into());
        world.add_player(2, "Victim".into(), "bailey".into(), "glock".into());
        world.reset_for_match(
            20,
            0,
            WinCondition::Kills,
            Gamemode::Deathmatch,
            true,
            false,
            0,
        );
        world.players.get_mut(&0).unwrap().spawn_protection = 0.0;
        world.players.get_mut(&1).unwrap().spawn_protection = 0.0;
        world.players.get_mut(&2).unwrap().spawn_protection = 0.0;
        world.players.get_mut(&0).unwrap().x = 100.0;
        world.players.get_mut(&1).unwrap().x = 200.0;
        world.players.get_mut(&0).unwrap().y = 100.0;
        world.players.get_mut(&1).unwrap().y = 100.0;
        world.players.get_mut(&0).unwrap().ability_charge = ABILITY_CHARGE_MAX;

        activate_andrew(&mut world, 0);
        assert!(world.players.get(&1).unwrap().blur_until > 0.0);

        let hp_before = world.players.get(&2).unwrap().hp;
        world.apply_damage(1, 2, 100);
        let damage_dealt = hp_before - world.players.get(&2).unwrap().hp;
        assert_eq!(damage_dealt, 60);
    }

    #[test]
    fn lee_feast_lifesteals_40_percent() {
        let mut world = GameWorld::default();
        world.add_player(0, "Lee".into(), "lee".into(), "glock".into());
        world.add_player(1, "Victim".into(), "sonny".into(), "glock".into());
        world.reset_for_match(
            20,
            0,
            WinCondition::Kills,
            Gamemode::Deathmatch,
            true,
            false,
            0,
        );
        world.players.get_mut(&0).unwrap().spawn_protection = 0.0;
        world.players.get_mut(&1).unwrap().spawn_protection = 0.0;
        world.players.get_mut(&0).unwrap().hp = 80;
        world.players.get_mut(&0).unwrap().ability_charge = ABILITY_CHARGE_MAX;

        activate_lee(&mut world, 0);
        assert_eq!(world.players.get(&0).unwrap().hp, 100);
        assert!(world.players.get(&0).unwrap().feast_until > 0.0);

        world.players.get_mut(&0).unwrap().hp = 70;
        world.apply_damage(0, 1, 25);
        assert_eq!(world.players.get(&0).unwrap().hp, 80);
    }

    #[test]
    fn martin_off_the_meds_buffs_and_increases_damage_taken() {
        let mut world = GameWorld::default();
        world.add_player(0, "Martin".into(), "martin".into(), "glock".into());
        world.add_player(1, "Attacker".into(), "sonny".into(), "glock".into());
        world.reset_for_match(
            20,
            0,
            WinCondition::Kills,
            Gamemode::Deathmatch,
            true,
            false,
            0,
        );
        world.players.get_mut(&0).unwrap().spawn_protection = 0.0;
        world.players.get_mut(&1).unwrap().spawn_protection = 0.0;
        assert_eq!(world.players.get(&0).unwrap().max_hp, MARTIN_MAX_HP);

        activate_martin(&mut world, 0);
        assert!(world.players.get(&0).unwrap().off_the_meds_until > 0.0);

        let hp_before = world.players.get(&0).unwrap().hp;
        world.apply_damage(1, 0, 40);
        assert_eq!(hp_before - world.players.get(&0).unwrap().hp, 50);

        let base_rate = 0.18;
        assert!(effective_fire_rate(world.players.get(&0).unwrap(), base_rate) < base_rate);
    }

    #[test]
    fn tristan_ragebait_reflects_and_reduces() {
        let mut world = GameWorld::default();
        world.add_player(0, "Tristan".into(), "tristan".into(), "glock".into());
        world.add_player(1, "Attacker".into(), "sonny".into(), "glock".into());
        world.reset_for_match(
            20,
            0,
            WinCondition::Kills,
            Gamemode::Deathmatch,
            true,
            false,
            0,
        );
        world.players.get_mut(&0).unwrap().spawn_protection = 0.0;
        world.players.get_mut(&1).unwrap().spawn_protection = 0.0;
        assert_eq!(world.players.get(&0).unwrap().max_hp, TRISTAN_MAX_HP);

        activate_tristan(&mut world, 0);
        let tristan_hp = world.players.get(&0).unwrap().hp;
        let attacker_hp = world.players.get(&1).unwrap().hp;

        world.apply_damage(1, 0, 100);
        assert_eq!(tristan_hp - world.players.get(&0).unwrap().hp, 60);
        assert_eq!(attacker_hp - world.players.get(&1).unwrap().hp, 24);
    }

    #[test]
    fn tristan_reflect_no_loop() {
        let mut world = GameWorld::default();
        world.add_player(0, "Tristan".into(), "tristan".into(), "glock".into());
        world.add_player(1, "Attacker".into(), "sonny".into(), "glock".into());
        world.reset_for_match(
            20,
            0,
            WinCondition::Kills,
            Gamemode::Deathmatch,
            true,
            false,
            0,
        );
        world.players.get_mut(&0).unwrap().spawn_protection = 0.0;
        world.players.get_mut(&1).unwrap().spawn_protection = 0.0;
        activate_tristan(&mut world, 0);

        let attacker_hp = world.players.get(&1).unwrap().hp;
        world.apply_damage(1, 0, 100);
        assert_eq!(attacker_hp - world.players.get(&1).unwrap().hp, 24);
    }

    #[test]
    fn andy_liquid_courage_resist_and_pet_spawn() {
        let mut world = GameWorld::default();
        world.add_player(0, "Andy".into(), "andy".into(), "glock".into());
        world.add_player(1, "Attacker".into(), "sonny".into(), "glock".into());
        world.reset_for_match(
            20,
            0,
            WinCondition::Kills,
            Gamemode::Deathmatch,
            true,
            false,
            0,
        );
        world.players.get_mut(&0).unwrap().spawn_protection = 0.0;
        world.players.get_mut(&1).unwrap().spawn_protection = 0.0;

        activate_andy(&mut world, 0);
        assert!(world.players.get(&0).unwrap().liquid_courage_until > 0.0);
        assert_eq!(world.follower_drones.len(), 1);
        assert_eq!(world.follower_drones[0].kind, FollowerDroneKind::MeleePet);

        let hp_before = world.players.get(&0).unwrap().hp;
        world.apply_damage(1, 0, 100);
        assert_eq!(hp_before - world.players.get(&0).unwrap().hp, 65);
    }

    #[test]
    fn xander_hyperfixation_blocks_all_damage_and_cleanses() {
        let mut world = GameWorld::default();
        world.add_player(0, "Xander".into(), "xander".into(), "glock".into());
        world.add_player(1, "Attacker".into(), "sonny".into(), "glock".into());
        world.reset_for_match(
            20,
            0,
            WinCondition::Kills,
            Gamemode::Deathmatch,
            true,
            false,
            0,
        );
        world.players.get_mut(&0).unwrap().spawn_protection = 0.0;
        world.players.get_mut(&1).unwrap().spawn_protection = 0.0;
        world.players.get_mut(&0).unwrap().rooted_until = 3.0;
        world.players.get_mut(&0).unwrap().blur_until = 3.0;

        fire_xander_hyperfixation(&mut world, 0);
        assert_eq!(world.players.get(&0).unwrap().rooted_until, 0.0);
        assert_eq!(world.players.get(&0).unwrap().blur_until, 0.0);
        assert!(world.players.get(&0).unwrap().invulnerable_until > 0.0);

        let hp = world.players.get(&0).unwrap().hp;
        world.apply_damage(1, 0, 100);
        assert_eq!(world.players.get(&0).unwrap().hp, hp);
    }
}
