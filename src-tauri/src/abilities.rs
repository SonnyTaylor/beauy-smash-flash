use std::collections::HashMap;

use crate::game::WorldEffect;
use crate::game::{circle_hits_circle, normalize, GameWorld, Player, PLAYER_RADIUS};
use crate::protocol::{EffectKind, WorldEffectSnapshot};

pub const ABILITY_CHARGE_MAX: f32 = 100.0;
pub const CHARGE_ON_KILL: f32 = 25.0;
pub const CHARGE_ON_DAMAGE: f32 = 4.0;
pub const CHARGE_PASSIVE_PER_SEC: f32 = 6.0;

const BAILEY_WINDUP: f32 = 1.2;
const BAILEY_NUKE_RANGE: f32 = 350.0;
const BAILEY_NUKE_RADIUS: f32 = 150.0;
pub const BAILEY_NUKE_DAMAGE: u16 = 60;
const EXPLOSION_VFX_LIFE: f32 = 0.45;

const SONNY_HACK_RANGE: f32 = 280.0;
const SONNY_HACK_DURATION: f32 = 3.0;
const SONNY_HACK_VFX_LIFE: f32 = 0.4;

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
    }
}

pub fn passive_charge_tick(players: &mut HashMap<u8, Player>, dt: f32) {
    for player in players.values_mut() {
        if player.alive && player.ability_windup <= 0.0 {
            add_charge(player, CHARGE_PASSIVE_PER_SEC * dt);
        }
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
    let (angle, x, y) = {
        let input = world.inputs.get(&player_id).cloned().unwrap_or_default();
        let (ax, ay) = normalize(input.aim_x, input.aim_y);
        let angle = if ax == 0.0 && ay == 0.0 {
            player.angle
        } else {
            ay.atan2(ax)
        };
        (angle, player.x, player.y)
    };

    match character_id.as_str() {
        "sonny" => activate_sonny_reverse_shell(world, player_id, x, y),
        "bailey" => {
            let target_x = (x + angle.cos() * BAILEY_NUKE_RANGE)
                .clamp(PLAYER_RADIUS, world.config.width - PLAYER_RADIUS);
            let target_y = (y + angle.sin() * BAILEY_NUKE_RANGE)
                .clamp(PLAYER_RADIUS, world.config.height - PLAYER_RADIUS);
            if let Some(player) = world.players.get_mut(&player_id) {
                player.ability_windup = BAILEY_WINDUP;
                player.ability_aim_x = target_x;
                player.ability_aim_y = target_y;
                player.ability_charge = 0.0;
            }
            let id = world.next_effect_id;
            world.next_effect_id += 1;
            world.effects.push(WorldEffect {
                id,
                kind: EffectKind::AimReticle,
                x: target_x,
                y: target_y,
                radius: BAILEY_NUKE_RADIUS,
                life: BAILEY_WINDUP,
                owner_id: player_id,
            });
        }
        _ => {}
    }
}

pub fn process_abilities(world: &mut GameWorld, dt: f32) {
    let casting: Vec<(u8, f32, f32, f32)> = world
        .players
        .values()
        .filter(|player| player.alive && player.ability_windup > 0.0)
        .map(|player| {
            (
                player.id,
                player.ability_windup,
                player.ability_aim_x,
                player.ability_aim_y,
            )
        })
        .collect();

    for (player_id, windup, aim_x, aim_y) in casting {
        let new_windup = windup - dt;
        if let Some(player) = world.players.get_mut(&player_id) {
            player.ability_windup = new_windup.max(0.0);
        }
        if new_windup <= 0.0 {
            let is_bailey = world
                .players
                .get(&player_id)
                .map(|player| player.character_id == "bailey")
                .unwrap_or(false);
            if is_bailey {
                detonate_bailey_nuke(world, player_id, aim_x, aim_y);
            }
        }
    }
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
        kind: EffectKind::AimReticle,
        x: tx,
        y: ty,
        radius: 36.0,
        life: SONNY_HACK_VFX_LIFE,
        owner_id: caster_id,
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
    world.effects.push(WorldEffect {
        id,
        kind: EffectKind::Explosion,
        x,
        y,
        radius: BAILEY_NUKE_RADIUS,
        life: EXPLOSION_VFX_LIFE,
        owner_id,
    });
    apply_explosion_damage(
        world,
        owner_id,
        x,
        y,
        BAILEY_NUKE_RADIUS,
        BAILEY_NUKE_DAMAGE,
    );
}

pub fn process_effects(world: &mut GameWorld, dt: f32) {
    for effect in &mut world.effects {
        effect.life -= dt;
    }
    world.effects.retain(|effect| effect.life > 0.0);
}

fn apply_explosion_damage(
    world: &mut GameWorld,
    owner_id: u8,
    x: f32,
    y: f32,
    radius: f32,
    damage: u16,
) {
    if !world.friendly_fire {
        return;
    }

    let victims: Vec<u8> = world
        .players
        .values()
        .filter(|player| {
            player.alive
                && !player.spawn_protected()
                && circle_hits_circle(player.x, player.y, PLAYER_RADIUS, x, y, radius)
        })
        .map(|player| player.id)
        .collect();

    for victim_id in victims {
        world.apply_damage(owner_id, victim_id, damage);
    }
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
    }
}

pub fn is_casting(player: &Player) -> bool {
    player.ability_windup > 0.0
}
