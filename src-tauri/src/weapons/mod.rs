use std::collections::HashMap;

pub const DEFAULT_WEAPON_ID: &str = "glock";
pub const PICKUP_RADIUS: f32 = 48.0;
pub const DROP_FORWARD_OFFSET: f32 = 34.0;

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
};

static REGISTRY: &[WeaponDef] = &[GLOCK];

pub fn all() -> &'static [WeaponDef] {
    REGISTRY
}

pub fn get(id: &str) -> Option<&'static WeaponDef> {
    REGISTRY.iter().find(|weapon| weapon.id == id)
}

pub fn get_or_default(id: &str) -> &'static WeaponDef {
    get(id).unwrap_or(&GLOCK)
}

pub fn default_primary_slot() -> WeaponSlotState {
    let weapon = get_or_default(DEFAULT_WEAPON_ID);
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
}
