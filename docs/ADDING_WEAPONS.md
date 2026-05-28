# Adding Weapons

This guide explains how to add a new weapon to Beauy Smash Flash. Weapons are split across two layers:

| Layer | Location | Purpose |
|-------|----------|---------|
| **Gameplay (authoritative)** | `src-tauri/src/weapons/mod.rs` | Damage, fire rate, ammo, reload, bullet physics |
| **Visuals (frontend)** | `src/content/weapons/` + `public/assets/weapons/` | Sprite, pivot, muzzle, orbit, HUD name |

Both layers must use the **same `id`** string (e.g. `"shotgun"`). Rust runs the simulation; React/Pixi only render state from snapshots.

---

## Quick checklist

1. Add a transparent PNG to `public/assets/weapons/<id>.png`
2. Create `src/content/weapons/<id>.json` (visual metadata)
3. Create `src/content/weapons/<id>.ts` (import JSON)
4. Register in `src/content/weapons/index.ts`
5. Add stats to `REGISTRY` in `src-tauri/src/weapons/mod.rs`
6. Run verification commands (below)

---

## 1. Prepare the sprite

Weapons are top-down transparent PNGs, same style as the glock:

- **Path:** `public/assets/weapons/<id>.png`
- **Background:** transparent (not black — black gets keyed out if you use the glock processor)
- **Orientation:** barrel pointing **right** (0°), like the glock source art

The glock has a helper script that keys black to transparent and auto-detects pivot/muzzle:

```powershell
# Edit scripts/process-glock.py paths for your weapon, or copy the script.
bun run assets:glock
```

For a new weapon you can either adapt `scripts/process-glock.py` or set pivot/muzzle manually in JSON (see section 3).

---

## 2. Visual metadata JSON

Create `src/content/weapons/<id>.json`. Copy `glock.json` and adjust values.

```json
{
  "id": "shotgun",
  "sprite": "weapons/shotgun.png",
  "width": 1500,
  "height": 1500,
  "displayScale": 0.032,
  "orbitRadius": 34,
  "pivot": { "x": 0.20, "y": 0.53 },
  "muzzle": { "x": 0.95, "y": 0.30 },
  "defaultRotation": 0
}
```

### Field reference

| Field | Description |
|-------|-------------|
| `id` | Must match Rust registry id and filename stem |
| `sprite` | Path under `public/assets/` (e.g. `weapons/shotgun.png`) |
| `width`, `height` | Source image dimensions in pixels |
| `displayScale` | Multiplier so the gun fits next to the player circle (~26px radius). Tune in-game. |
| `orbitRadius` | Distance from player center to gun pivot, in world pixels |
| `pivot` | Normalized grip point (0–1). Gun rotates around this point on the sprite. |
| `muzzle` | Normalized barrel tip (0–1). Used for VFX alignment helpers. |
| `defaultRotation` | Extra rotation offset if source art isn't barrel-right |

**Tuning tips**

- If the gun floats too far from the player, lower `orbitRadius`.
- If it looks tiny or huge, change `displayScale` (not `width`/`height` unless the PNG size changed).
- Pivot should sit on the grip; muzzle on the barrel tip. Values are fractions of image size.

---

## 3. TypeScript module

Create `src/content/weapons/<id>.ts`:

```ts
import meta from './shotgun.json';
import type { WeaponMeta } from './types';

export const SHOTGUN_WEAPON: WeaponMeta = meta;
```

---

## 4. Frontend registry

Edit `src/content/weapons/index.ts`:

```ts
import { SHOTGUN_WEAPON } from './shotgun';

const SHOTGUN: WeaponDefinition = {
  id: 'shotgun',
  name: 'Shotgun',
  meta: SHOTGUN_WEAPON,
};

export const WEAPONS: Record<string, WeaponDefinition> = {
  [GLOCK.id]: GLOCK,
  [SHOTGUN.id]: SHOTGUN,
};
```

`getWeapon()`, `listWeapons()`, and `ArenaRenderer` pick up new entries automatically. The HUD weapon bar shows the `name` from this registry.

---

## 5. Rust gameplay stats

Edit `src-tauri/src/weapons/mod.rs`. Add a constant and append it to `REGISTRY`:

```rust
const SHOTGUN: WeaponDef = WeaponDef {
    id: "shotgun",
    name: "Shotgun",
    damage: 18,
    fire_rate: 0.55,      // seconds between shots
    bullet_speed: 640.0,
    bullet_life: 1.4,
    max_ammo: 8,
    reload_time: 2.0,
    bullet_radius: 5.0,
    muzzle_offset: 34.0,  // world pixels from player center to bullet spawn
};

static REGISTRY: &[WeaponDef] = &[GLOCK, SHOTGUN];
```

### Rust field reference

| Field | Description |
|-------|-------------|
| `damage` | HP removed per bullet hit |
| `fire_rate` | Minimum seconds between shots (cooldown) |
| `bullet_speed` | World pixels per second |
| `bullet_life` | Seconds before bullet despawns |
| `max_ammo` | Magazine size (also used when picking up a full weapon) |
| `reload_time` | Seconds to reload; sent to HUD as `reload_duration` |
| `bullet_radius` | Hitbox radius for collisions |
| `muzzle_offset` | Distance from player center along aim vector where bullets spawn |

Unknown weapon ids fall back to glock (`get_or_default`).

---

## 6. Verify

```powershell
bunx tsc --noEmit
bun run build
cd src-tauri; cargo fmt; cargo check; cargo test
```

Optional: add a small Rust test in `weapons/mod.rs` or `game.rs` if the weapon has special behavior (e.g. burst fire later).

---

## How weapons work in-game

Players spawn with a **primary** glock and an **empty secondary** slot.

| Key | Action |
|-----|--------|
| **Q** | Swap primary ↔ secondary (if secondary has a weapon) |
| **G** | Drop active weapon; spawns a ground pickup in front of the player |
| **F** | Pick up nearest weapon within ~48px |

**Pickup rules**

- Empty secondary → weapon goes to secondary, auto-switches to it
- Both slots full → active slot swaps with the ground pickup (old weapon dropped in place)

Ground pickups appear in snapshots as `weapon_pickups` and render in the arena with a subtle glow.

---

## Protocol notes

Weapon state is included in every `StateSnapshot` (protocol v6+):

- `PlayerSnapshot`: `active_weapon`, `active_slot`, `primary_weapon`, `secondary_weapon`, `reload_duration`
- `StateSnapshot`: `weapon_pickups`
- `BulletSnapshot`: `weapon_id`

Do not change gameplay in the frontend — only add content and tune Rust stats.

---

## Example: minimal “SMG” add

**Files to touch**

```
public/assets/weapons/smg.png
src/content/weapons/smg.json
src/content/weapons/smg.ts
src/content/weapons/index.ts          (register)
src-tauri/src/weapons/mod.rs          (stats + REGISTRY)
```

**Ids must match everywhere:** `"smg"`

No changes needed to `ArenaRenderer`, `InputController`, or `GameOverlay` for a standard hitscan-style weapon.

---

## Future extensions

Not implemented yet — design hooks exist if you extend the system later:

- Per-weapon SFX (today gunshot is shared)
- Pellet / spread shots (would need `process_combat` changes in `game.rs`)
- Melee or charged weapons (new input + ability-style windup)
- Map-placed weapon spawns (spawn pickups in `GameWorld::reset_for_match`)

For those, keep stats in Rust and extend the protocol in `src-tauri/src/protocol.rs` with mirrored types in `src/shared/types.ts`.
