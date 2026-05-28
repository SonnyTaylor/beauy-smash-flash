use std::collections::HashMap;

use crate::game::WorldEffect;
use crate::game::{circle_hits_circle, normalize, GameWorld, Player, PLAYER_RADIUS};
use crate::protocol::{EffectKind, WorldEffectSnapshot};

pub const ABILITY_CHARGE_MAX: f32 = 100.0;
pub const CHARGE_ON_KILL: f32 = 25.0;
pub const CHARGE_ON_DAMAGE: f32 = 4.0;
pub const CHARGE_PASSIVE_PER_SEC: f32 = 6.0;
pub const BAILEY_CHARGE_PASSIVE_PER_SEC: f32 = 3.25;

pub const BAILEY_AIM_DURATION: f32 = 1.25;
const BAILEY_NUKE_FLIGHT: f32 = 0.9;
const BAILEY_NUKE_ARC_HEIGHT: f32 = 140.0;
const BAILEY_NUKE_RANGE: f32 = 350.0;
pub const BAILEY_NUKE_RADIUS: f32 = 150.0;
pub const BAILEY_NUKE_DAMAGE: u16 = 60;
const BAILEY_NUKE_MIN_FALLOFF: f32 = 0.35;
const TRUTH_EXPLOSION_VFX_LIFE: f32 = 0.65;

pub const SONNY_HACK_RANGE: f32 = 280.0;
pub const SONNY_HACK_DURATION: f32 = 4.0;
const SONNY_HACK_VFX_LIFE: f32 = 0.55;

pub const JACOB_DIRECTORS_CUT_DURATION: f32 = 30.0;
pub const JACOB_DIRECTORS_CUT_SHOTS: u8 = 15;
pub const JACOB_DIRECTORS_CUT_SPEED: f32 = 1.67;
pub const POPCORN_WEAPON_ID: &str = "popcorn";
pub const POPCORN_DAMAGE: u16 = 14;
pub const POPCORN_SPEED: f32 = 684.0;
pub const POPCORN_LIFE: f32 = 4.5;
pub const POPCORN_RADIUS: f32 = 5.0;
pub const POPCORN_BOUNCES: u8 = 12;
pub const POPCORN_FIRE_RATE: f32 = 0.11;
pub const POPCORN_MARK_DURATION: f32 = 3.0;
pub const POPCORN_MARK_DAMAGE_MULT: f32 = 1.4;
const POPCORN_INITIAL_SPREAD_DEG: f32 = 20.0;
const POPCORN_BOUNCE_SPREAD_DEG: f32 = 50.0;
const DIRECTORS_CUT_VFX_LIFE: f32 = 0.45;

pub fn add_charge(player: &mut Player, amount: f32) {
    if !player.alive {
        return;
    }
    player.ability_charge = (player.ability_charge + amount).min(ABILITY_CHARGE_MAX);
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
    }
}

fn end_directors_cut(player: &mut Player) {
    player.directors_cut_until = 0.0;
    player.directors_cut_shots = 0;
}

pub fn in_directors_cut(player: &Player) -> bool {
    player.directors_cut_until > 0.0 && player.directors_cut_shots > 0
}

pub fn passive_charge_tick(players: &mut HashMap<u8, Player>, dt: f32) {
    for player in players.values_mut() {
        if player.alive && player.ability_windup <= 0.0 {
            let rate = passive_charge_rate(&player.character_id);
            add_charge(player, rate * dt);
        }
    }
}

fn passive_charge_rate(character_id: &str) -> f32 {
    match character_id {
        "bailey" => BAILEY_CHARGE_PASSIVE_PER_SEC,
        _ => CHARGE_PASSIVE_PER_SEC,
    }
}

pub fn try_activate(world: &mut GameWorld, player_id: u8) {
    let Some(player) = world.players.get(&player_id) else {
        return;
    };
    if !player.alive
        || player.ability_charge < ABILITY_CHARGE_MAX
        || player.ability_windup > 0.0
        || player.spawn_protected()
    {
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
        _ => {}
    }
}

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
        }

        let new_windup = windup - dt;
        if let Some(player) = world.players.get_mut(&player_id) {
            player.ability_windup = new_windup.max(0.0);
        }

        if new_windup <= 0.0 && character_id == "bailey" {
            let (from_x, from_y) = world
                .players
                .get(&player_id)
                .map(|player| (player.x, player.y))
                .unwrap_or((aim_x, aim_y));
            launch_bailey_nuke(world, player_id, from_x, from_y, aim_x, aim_y);
        }
    }
}

pub fn process_projectile_effects(world: &mut GameWorld, dt: f32) {
    let mut detonations: Vec<(u8, f32, f32)> = Vec::new();

    for effect in &mut world.effects {
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

    world
        .effects
        .retain(|effect| effect.kind != EffectKind::TruthNuke || effect.life > 0.0);

    for (owner_id, x, y) in detonations {
        detonate_bailey_nuke(world, owner_id, x, y);
    }
}

pub fn process_effects(world: &mut GameWorld, dt: f32) {
    for effect in &mut world.effects {
        if effect.kind == EffectKind::TruthNuke {
            continue;
        }
        effect.life -= dt;
    }
    world.effects.retain(|effect| effect.life > 0.0);
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
        return;
    };

    if let Some(target) = world.players.get_mut(&target_id) {
        target.controls_inverted_until = SONNY_HACK_DURATION;
    }
    if let Some(caster) = world.players.get_mut(&caster_id) {
        caster.ability_charge = 0.0;
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
