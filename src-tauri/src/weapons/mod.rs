use std::collections::HashMap;

pub const DEFAULT_WEAPON_ID: &str = "glock";
pub const PICKUP_RADIUS: f32 = 48.0;
pub const DROP_FORWARD_OFFSET: f32 = 34.0;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum WeaponOnHit {
    None,
    Slow {
        speed_multiplier: f32,
        duration: f32,
    },
}

#[derive(Clone, Debug, PartialEq)]
pub struct WeaponDef {
    pub id: &'static str,
    pub name: &'static str,
    pub damage: u16,
    pub fire_rate: f32,
    pub bullet_speed: f32,
    pub bullet_life: f32,
    pub max_ammo: u8,
    pub reload_time: f32,
    pub bullet_radius: f32,
    pub muzzle_offset: f32,
    pub on_hit: WeaponOnHit,
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

const GLOCK: WeaponDef = WeaponDef {
    id: "glock",
    name: "Glock",
    damage: 25,
    fire_rate: 0.18,
    bullet_speed: 720.0,
    bullet_life: 2.0,
    max_ammo: 17,
    reload_time: 1.2,
    bullet_radius: 4.0,
    muzzle_offset: 30.0,
    on_hit: WeaponOnHit::None,
};

const YOGHURT_EFFECT: WeaponDef = WeaponDef {
    id: "yoghurt_effect",
    name: "Yoghurt Effect",
    damage: 14,
    fire_rate: 0.42,
    bullet_speed: 520.0,
    bullet_life: 1.5,
    max_ammo: 24,
    reload_time: 1.6,
    bullet_radius: 6.5,
    muzzle_offset: 28.0,
    on_hit: WeaponOnHit::Slow {
        speed_multiplier: 0.55,
        duration: 2.2,
    },
};

static REGISTRY: &[WeaponDef] = &[GLOCK, YOGHURT_EFFECT];

pub fn apply_on_hit_to_player(
    on_hit: WeaponOnHit,
    slowed_until: &mut f32,
    slow_multiplier: &mut f32,
) {
    match on_hit {
        WeaponOnHit::None => {}
        WeaponOnHit::Slow {
            speed_multiplier,
            duration,
        } => {
            *slowed_until = duration;
            *slow_multiplier = speed_multiplier;
        }
    }
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
    fn unknown_weapon_falls_back_to_glock() {
        assert_eq!(get_or_default("railgun").id, "glock");
    }

    #[test]
    fn yoghurt_effect_applies_slow_on_hit() {
        assert!(matches!(
            get("yoghurt_effect").expect("registered").on_hit,
            WeaponOnHit::Slow {
                speed_multiplier,
                duration,
            } if speed_multiplier == 0.55 && duration == 2.2
        ));
    }

    #[test]
    fn validate_weapon_id_accepts_any_registered_weapon() {
        assert_eq!(validate_weapon_id("yoghurt_effect"), "yoghurt_effect");
        assert_eq!(validate_weapon_id("unknown"), "glock");
    }
}
