//! Playable roster expansion: Sifan, Connor, Archie, Arthur, Oscar, Vlad.

use std::collections::HashMap;

use crate::abilities::{add_charge, aim_direction, ABILITY_CHARGE_MAX};
use crate::game::{
    circle_hits_circle, circle_hits_walls, normalize, FollowerDrone, GameWorld, Player,
    WorldEffect, PLAYER_RADIUS,
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
pub const ARCHIE_RESTLESS_BONUS: f32 = 3.0;

// --- Arthur — Hot Lap ---
pub const ARTHUR_MAX_HP: u16 = 110;
pub const ARTHUR_HIT_RADIUS_MULT: f32 = 1.18;
pub const ARTHUR_KART_DURATION: f32 = 5.0;
pub const ARTHUR_KART_SPEED_MULT: f32 = 1.35;
const ARTHUR_OIL_INTERVAL: f32 = 0.2;
pub const ARTHUR_OIL_LIFE: f32 = 3.0;
const ARTHUR_OIL_RADIUS: f32 = 36.0;
const ARTHUR_OIL_DPS: f32 = 6.0;
const ARTHUR_OIL_SLOW_MULT: f32 = 0.7;

// --- Oscar — Chippy's Special ---
pub const OSCAR_CHARGE_PASSIVE_PER_SEC: f32 = 4.5;
const OSCAR_TRAY_RANGE: f32 = 280.0;
pub const OSCAR_TRAY_RADIUS: f32 = 140.0;
pub const OSCAR_TRAY_DURATION: f32 = 6.0;
pub const OSCAR_TRAY_HP: f32 = 60.0;
const OSCAR_TRAY_HIT_RADIUS: f32 = 42.0;
pub const OSCAR_HEAL_PER_SEC: f32 = 8.0;

// --- Vlad — Going Viral ---
pub const VLAD_DRONE_COUNT: u8 = 3;
pub const VLAD_DRONE_DURATION: f32 = 7.0;
pub const VLAD_DRONE_HP: u16 = 15;
const VLAD_DRONE_DAMAGE: u16 = 6;
const VLAD_DRONE_FIRE_RATE: f32 = 0.8;
const VLAD_DRONE_RANGE: f32 = 520.0;
const VLAD_DRONE_ORBIT_RADIUS: f32 = 52.0;

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
    if input.dx.abs() + input.dy.abs() > 0.05 {
        ARCHIE_RESTLESS_BONUS
    } else {
        0.0
    }
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
    mult
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
    }
}

pub fn process_world_systems(world: &mut GameWorld, dt: f32) {
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
    let Some((tx, ty)) = placement_point(world, player_id, OSCAR_TRAY_RANGE) else {
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
        EffectKind::FoodTray,
        OSCAR_TRAY_RADIUS,
        OSCAR_TRAY_DURATION,
        OSCAR_TRAY_HP,
    );
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
            EffectKind::FoodTray if effect.zone_hp > 0.0 => {
                effect.zone_heal_accum += OSCAR_HEAL_PER_SEC * dt;
                while effect.zone_heal_accum >= 1.0 {
                    effect.zone_heal_accum -= 1.0;
                    heal_ticks += 1;
                }
            }
            EffectKind::OilSlick => {
                effect.zone_damage_accum += ARTHUR_OIL_DPS * dt;
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

    for drone in &mut world.follower_drones {
        drone.life -= dt;
        drone.fire_cooldown = (drone.fire_cooldown - dt).max(0.0);
        if let Some((ox, oy)) = owners.get(&drone.owner_id) {
            drone.orbit_angle += dt * 2.2;
            drone.x = ox + drone.orbit_angle.cos() * VLAD_DRONE_ORBIT_RADIUS;
            drone.y = oy + drone.orbit_angle.sin() * VLAD_DRONE_ORBIT_RADIUS;
        }
    }

    let drone_snapshots: Vec<(u8, f32, f32, f32, f32, u16)> = world
        .follower_drones
        .iter()
        .map(|d| (d.owner_id, d.x, d.y, d.fire_cooldown, d.life, d.hp))
        .collect();

    let mut shots: Vec<(u8, u8, f32, f32)> = Vec::new();
    let mut fire_owners: Vec<u8> = Vec::new();

    for (owner, x, y, cooldown, life, hp) in drone_snapshots {
        if cooldown <= 0.0 && life > 0.0 && hp > 0 {
            if let Some(target_id) = nearest_enemy(world, owner, x, y, VLAD_DRONE_RANGE) {
                if world.damage_allowed(owner, target_id) {
                    shots.push((owner, target_id, x, y));
                    fire_owners.push(owner);
                }
            }
        }
    }

    for drone in &mut world.follower_drones {
        if fire_owners.contains(&drone.owner_id) && drone.fire_cooldown <= 0.0 {
            drone.fire_cooldown = VLAD_DRONE_FIRE_RATE;
        }
    }

    for (owner_id, target_id, x, y) in shots {
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

    world.follower_drones.retain(|d| d.life > 0.0 && d.hp > 0);
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
                OSCAR_TRAY_HIT_RADIUS,
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
            if circle_hits_circle(bullet.x, bullet.y, bullet.radius, drone.x, drone.y, 12.0) {
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
            world
                .follower_drones
                .iter()
                .any(|d| circle_hits_circle(b.x, b.y, b.radius, d.x, d.y, 12.0))
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
    fn arthur_hot_lap_enters_kart_mode() {
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
}
