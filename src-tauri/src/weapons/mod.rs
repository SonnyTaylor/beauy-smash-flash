use std::collections::HashMap;
use std::f32::consts::PI;

pub const DEFAULT_WEAPON_ID: &str = "glock";
pub const PICKUP_RADIUS: f32 = 48.0;
pub const DROP_FORWARD_OFFSET: f32 = 34.0;
/// Ground weapons (manual drop or death loot) despawn after this many seconds.
pub const WEAPON_PICKUP_LIFETIME_SECS: f32 = 25.0;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum WeaponKind {
    Bullet,
    Pellets { count: u8, spread_deg: f32 },
    Melee { range: f32, arc_deg: f32 },
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum WeaponOnHit {
    None,
    Slow {
        speed_multiplier: f32,
        duration: f32,
    },
    Marked {
        damage_taken_multiplier: f32,
        duration: f32,
    },
    Poison {
        dps: u16,
        duration: f32,
    },
    Knockback {
        impulse: f32,
    },
}

#[derive(Clone, Debug, PartialEq)]
pub struct WeaponDef {
    pub id: &'static str,
    pub name: &'static str,
    pub kind: WeaponKind,
    pub damage: u16,
    pub fire_rate: f32,
    pub bullet_speed: f32,
    pub bullet_life: f32,
    pub max_ammo: u8,
    pub reload_time: f32,
    pub bullet_radius: f32,
    pub muzzle_offset: f32,
    pub splash_radius: f32,
    pub splash_damage: u16,
    pub on_hit: WeaponOnHit,
}

impl WeaponDef {
    pub fn uses_ammo(&self) -> bool {
        !matches!(self.kind, WeaponKind::Melee { .. })
    }

    pub fn can_reload(&self) -> bool {
        self.uses_ammo() && self.reload_time > 0.0
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WeaponSlotState {
    pub weapon_id: String,
    pub ammo: u8,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ActiveSlot {
    Primary = 0,
    Secondary = 1,
}

impl ActiveSlot {
    pub fn toggle(self) -> Self {
        match self {
            Self::Primary => Self::Secondary,
            Self::Secondary => Self::Primary,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HitVfxKind {
    None,
    Splat,
    Mark,
    Poison,
    Zap,
    Slash,
}

pub struct HitStatusApply<'a> {
    pub slowed_until: &'a mut f32,
    pub slow_multiplier: &'a mut f32,
    pub marked_until: &'a mut f32,
    pub mark_damage_multiplier: &'a mut f32,
    pub poison_until: &'a mut f32,
    pub poison_dps: &'a mut u16,
}

const GLOCK: WeaponDef = WeaponDef {
    id: "glock",
    name: "Glock",
    kind: WeaponKind::Bullet,
    damage: 25,
    fire_rate: 0.18,
    bullet_speed: 720.0,
    bullet_life: 2.0,
    max_ammo: 17,
    reload_time: 1.2,
    bullet_radius: 4.0,
    muzzle_offset: 30.0,
    splash_radius: 0.0,
    splash_damage: 0,
    on_hit: WeaponOnHit::None,
};

const SCAR: WeaponDef = WeaponDef {
    id: "scar",
    name: "SCAR",
    kind: WeaponKind::Bullet,
    damage: 20,
    fire_rate: 0.11,
    bullet_speed: 800.0,
    bullet_life: 2.1,
    max_ammo: 30,
    reload_time: 2.4,
    bullet_radius: 4.0,
    muzzle_offset: 34.0,
    splash_radius: 0.0,
    splash_damage: 0,
    on_hit: WeaponOnHit::None,
};

const SHOTGUN: WeaponDef = WeaponDef {
    id: "shotgun",
    name: "Shotgun",
    kind: WeaponKind::Pellets {
        count: 6,
        spread_deg: 22.0,
    },
    damage: 10,
    fire_rate: 0.78,
    bullet_speed: 620.0,
    bullet_life: 0.38,
    max_ammo: 5,
    reload_time: 2.5,
    bullet_radius: 3.5,
    muzzle_offset: 36.0,
    splash_radius: 0.0,
    splash_damage: 0,
    on_hit: WeaponOnHit::Knockback { impulse: 140.0 },
};

const RAYGUN: WeaponDef = WeaponDef {
    id: "raygun",
    name: "Ray Gun",
    kind: WeaponKind::Bullet,
    damage: 18,
    fire_rate: 0.28,
    bullet_speed: 560.0,
    bullet_life: 1.8,
    max_ammo: 21,
    reload_time: 1.9,
    bullet_radius: 5.0,
    muzzle_offset: 32.0,
    splash_radius: 52.0,
    splash_damage: 10,
    on_hit: WeaponOnHit::None,
};

const LASER_GUN: WeaponDef = WeaponDef {
    id: "laser_gun",
    name: "Laser Gun",
    kind: WeaponKind::Bullet,
    damage: 21,
    fire_rate: 0.19,
    bullet_speed: 1080.0,
    bullet_life: 1.6,
    max_ammo: 30,
    reload_time: 1.4,
    bullet_radius: 3.0,
    muzzle_offset: 32.0,
    splash_radius: 0.0,
    splash_damage: 0,
    on_hit: WeaponOnHit::None,
};

const CHICKEN_BUCKET: WeaponDef = WeaponDef {
    id: "chicken_bucket",
    name: "Chicken Bucket",
    kind: WeaponKind::Bullet,
    damage: 12,
    fire_rate: 0.34,
    bullet_speed: 470.0,
    bullet_life: 1.35,
    max_ammo: 28,
    reload_time: 2.1,
    bullet_radius: 7.0,
    muzzle_offset: 26.0,
    splash_radius: 0.0,
    splash_damage: 0,
    on_hit: WeaponOnHit::Slow {
        speed_multiplier: 0.62,
        duration: 1.6,
    },
};

const JARATE: WeaponDef = WeaponDef {
    id: "jarate",
    name: "Jarate",
    kind: WeaponKind::Bullet,
    damage: 6,
    fire_rate: 0.48,
    bullet_speed: 540.0,
    bullet_life: 1.6,
    max_ammo: 16,
    reload_time: 1.5,
    bullet_radius: 5.0,
    muzzle_offset: 24.0,
    splash_radius: 0.0,
    splash_damage: 0,
    on_hit: WeaponOnHit::Marked {
        damage_taken_multiplier: 1.35,
        duration: 3.5,
    },
};

const FECES: WeaponDef = WeaponDef {
    id: "feces",
    name: "Tom Pearl's Shit",
    kind: WeaponKind::Bullet,
    damage: 5,
    fire_rate: 0.52,
    bullet_speed: 390.0,
    bullet_life: 1.4,
    max_ammo: 18,
    reload_time: 1.7,
    bullet_radius: 6.0,
    muzzle_offset: 22.0,
    splash_radius: 0.0,
    splash_damage: 0,
    on_hit: WeaponOnHit::Poison {
        dps: 5,
        duration: 4.0,
    },
};

const SWORD: WeaponDef = WeaponDef {
    id: "sword",
    name: "Sword",
    kind: WeaponKind::Melee {
        range: 94.0,
        arc_deg: 115.0,
    },
    damage: 44,
    fire_rate: 0.52,
    bullet_speed: 0.0,
    bullet_life: 0.0,
    max_ammo: 1,
    reload_time: 0.0,
    bullet_radius: 0.0,
    muzzle_offset: 44.0,
    splash_radius: 0.0,
    splash_damage: 0,
    on_hit: WeaponOnHit::None,
};

const ZOMBIE_CLAWS: WeaponDef = WeaponDef {
    id: "zombie_claws",
    name: "Claws",
    kind: WeaponKind::Melee {
        range: 72.0,
        arc_deg: 95.0,
    },
    damage: 16,
    fire_rate: 1.15,
    bullet_speed: 0.0,
    bullet_life: 0.0,
    max_ammo: 1,
    reload_time: 0.0,
    bullet_radius: 0.0,
    muzzle_offset: 36.0,
    splash_radius: 0.0,
    splash_damage: 0,
    on_hit: WeaponOnHit::None,
};

const YOGHURT_EFFECT: WeaponDef = WeaponDef {
    id: "yoghurt_effect",
    name: "Yoghurt Effect",
    kind: WeaponKind::Bullet,
    damage: 14,
    fire_rate: 0.42,
    bullet_speed: 520.0,
    bullet_life: 1.5,
    max_ammo: 24,
    reload_time: 1.6,
    bullet_radius: 6.5,
    muzzle_offset: 28.0,
    splash_radius: 0.0,
    splash_damage: 0,
    on_hit: WeaponOnHit::Slow {
        speed_multiplier: 0.55,
        duration: 2.2,
    },
};

static REGISTRY: &[WeaponDef] = &[
    GLOCK,
    SCAR,
    SHOTGUN,
    RAYGUN,
    LASER_GUN,
    CHICKEN_BUCKET,
    JARATE,
    FECES,
    SWORD,
    ZOMBIE_CLAWS,
    YOGHURT_EFFECT,
];

pub fn apply_on_hit(on_hit: WeaponOnHit, target: &mut HitStatusApply<'_>) -> HitVfxKind {
    match on_hit {
        WeaponOnHit::None => HitVfxKind::None,
        WeaponOnHit::Slow {
            speed_multiplier,
            duration,
        } => {
            *target.slowed_until = duration;
            *target.slow_multiplier = speed_multiplier;
            HitVfxKind::Splat
        }
        WeaponOnHit::Marked {
            damage_taken_multiplier,
            duration,
        } => {
            *target.marked_until = duration;
            *target.mark_damage_multiplier = damage_taken_multiplier;
            HitVfxKind::Mark
        }
        WeaponOnHit::Poison { dps, duration } => {
            *target.poison_until = duration;
            *target.poison_dps = dps;
            HitVfxKind::Poison
        }
        WeaponOnHit::Knockback { .. } => HitVfxKind::None,
    }
}

pub fn pellet_directions(base_x: f32, base_y: f32, count: u8, spread_deg: f32) -> Vec<(f32, f32)> {
    if count <= 1 {
        return vec![(base_x, base_y)];
    }
    let spread = spread_deg.to_radians();
    let base_angle = base_y.atan2(base_x);
    let step = spread / (count.saturating_sub(1).max(1) as f32);
    let start = base_angle - spread * 0.5;
    (0..count)
        .map(|i| {
            let angle = start + step * i as f32;
            (angle.cos(), angle.sin())
        })
        .collect()
}

pub fn melee_targets(
    attacker_x: f32,
    attacker_y: f32,
    aim_x: f32,
    aim_y: f32,
    range: f32,
    arc_deg: f32,
    candidates: &[(u8, f32, f32)],
) -> Vec<u8> {
    let aim_angle = aim_y.atan2(aim_x);
    let half_arc = (arc_deg * 0.5).to_radians();
    let mut hits: Vec<(u8, f32)> = Vec::new();

    for &(id, tx, ty) in candidates {
        let dx = tx - attacker_x;
        let dy = ty - attacker_y;
        let dist_sq = dx * dx + dy * dy;
        if dist_sq > range * range {
            continue;
        }
        let angle = dy.atan2(dx);
        let mut delta = angle - aim_angle;
        while delta > PI {
            delta -= 2.0 * PI;
        }
        while delta < -PI {
            delta += 2.0 * PI;
        }
        if delta.abs() <= half_arc {
            hits.push((id, dist_sq));
        }
    }

    hits.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
    hits.into_iter().map(|(id, _)| id).collect()
}

pub fn all() -> &'static [WeaponDef] {
    REGISTRY
}

pub fn get(id: &str) -> Option<&'static WeaponDef> {
    REGISTRY.iter().find(|weapon| weapon.id == id)
}

pub fn get_or_default(id: &str) -> &'static WeaponDef {
    get(id).unwrap_or(&GLOCK)
}

pub fn validate_weapon_id(weapon_id: &str) -> String {
    if get(weapon_id).is_some() {
        weapon_id.to_string()
    } else {
        DEFAULT_WEAPON_ID.to_string()
    }
}

pub fn default_primary_slot() -> WeaponSlotState {
    primary_slot_for(DEFAULT_WEAPON_ID)
}

pub fn primary_slot_for(weapon_id: &str) -> WeaponSlotState {
    let weapon = get_or_default(weapon_id);
    WeaponSlotState {
        weapon_id: weapon.id.to_string(),
        ammo: weapon.max_ammo,
    }
}

pub fn max_ammo_for(id: &str) -> u8 {
    get_or_default(id).max_ammo
}

pub fn registry_map() -> HashMap<&'static str, &'static WeaponDef> {
    REGISTRY.iter().map(|weapon| (weapon.id, weapon)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_weapon_is_glock() {
        let slot = default_primary_slot();
        assert_eq!(slot.weapon_id, "glock");
        assert_eq!(slot.ammo, GLOCK.max_ammo);
    }

    #[test]
    fn shotgun_fires_six_pellets() {
        let dirs = pellet_directions(1.0, 0.0, 6, 22.0);
        assert_eq!(dirs.len(), 6);
    }

    #[test]
    fn melee_finds_closest_target_in_arc() {
        let hits = melee_targets(
            0.0,
            0.0,
            1.0,
            0.0,
            80.0,
            90.0,
            &[(1, 50.0, 0.0), (2, 70.0, 20.0)],
        );
        assert_eq!(hits.first().copied(), Some(1));
    }

    #[test]
    fn validate_weapon_id_accepts_registered_weapons() {
        assert_eq!(validate_weapon_id("raygun"), "raygun");
        assert_eq!(validate_weapon_id("unknown"), "glock");
    }
}
