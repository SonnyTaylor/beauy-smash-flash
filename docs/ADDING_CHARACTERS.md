# Adding Characters & Abilities

This guide explains how to add a new playable character to Beauy Smash Flash and how to design or tune their power. Characters are split across three layers:

| Layer | Location | Purpose |
|-------|----------|---------|
| **Gameplay (authoritative)** | `src-tauri/src/abilities.rs`, `game.rs` | Charge, activation, damage, debuffs, movement rules |
| **Content (frontend)** | `src/content/characters.ts` | Name, color, sprite path, HUD/lobby copy |
| **Visuals (frontend)** | `ArenaRenderer.ts`, `VfxManager.ts`, HUD components | Ability VFX, status rings, character-specific rendering |

Rust runs the simulation. React shows lobby/loadout/HUD text. Pixi renders arena effects from snapshots. Do not put gameplay logic in React or Pixi.

For the current roster and exact numbers, see [CHARACTERS.md](./CHARACTERS.md).

---

## Quick checklist

1. Add a face sprite to `public/assets/heads/<id>.png`
2. Add an entry to `CHARACTERS` in `src/content/characters.ts`
3. Register the id in `clean_character_id()` in `src-tauri/src/commands.rs`
4. Add ability constants and handlers in `src-tauri/src/abilities.rs`
5. Wire movement/combat hooks in `src-tauri/src/game.rs` if the power changes speed, firing, or damage
6. Extend `Player` + `PlayerSnapshot` if you need new synced state (`protocol.rs`, `types.ts`)
7. Add VFX in `VfxManager.ts` / `ArenaRenderer.ts` and HUD hints in `HudAbilityButton.tsx`
8. Add Rust tests for deterministic rules (charge refund, passive ticks, blocking, falloff)
9. Run verification commands (below)

---

## 1. Character content (frontend)

Create `src/content/characters.ts` entry:

```ts
{
  id: 'alex',
  name: 'Alex',
  color: [120, 200, 255],
  sprite: 'heads/alex.png',
  initials: 'AX',
  abilityId: 'some_snake_case_id',
  abilityName: 'Power Name',
  abilityDescription: 'One sentence the player reads in lobby/HUD.',
}
```

### Field reference

| Field | Description |
|-------|-------------|
| `id` | Lowercase slug. Must match Rust `character_id` checks and `clean_character_id()`. |
| `color` | RGB accent for HUD rings, cards, crosshair tint. |
| `sprite` | Path under `public/assets/` (e.g. `heads/alex.png`). |
| `initials` | Fallback label if the PNG fails to load. |
| `abilityId` | Stable string for analytics/copy; gameplay routing uses `character_id`, not this field. |
| `abilityName` / `abilityDescription` | Player-facing copy. Keep descriptions honest about windups, tradeoffs, and second-press behavior. |

The roster auto-appears in:

- `src/ui/loadout/CharacterGrid.tsx` (character select)
- `src/ui/main-menu/FloatingHeads.tsx`
- HUD via `getCharacter(player.character_id)`

No extra React registration is needed beyond `characters.ts`.

### Head sprite

- **Path:** `public/assets/heads/<id>.png`
- **Style:** Face/portrait, readable at ~48px in the HUD ability button
- **Fallback:** Initials render if the image fails

---

## 2. Register the character id (Rust)

Add your id to `clean_character_id()` in `src-tauri/src/commands.rs`. Unknown ids fall back to **Sonny**.

```rust
fn clean_character_id(character_id: Option<String>) -> String {
    match character_id.as_deref() {
        Some("bailey") => "bailey",
        Some("alex") => "alex",
        // ...
        _ => "sonny",
    }
    .to_string()
}
```

Without this, lobby loadout updates may silently pick the wrong character.

---

## 3. Ability implementation (Rust)

All ability logic lives in `src-tauri/src/abilities.rs`.

### Shared charge system

| Constant | Default | Meaning |
|----------|---------|---------|
| `ABILITY_CHARGE_MAX` | 100 | Full charge required to activate |
| `CHARGE_PASSIVE_PER_SEC` | 6 | ~16.7s idle refill |
| `CHARGE_ON_KILL` | 25 | Bonus charge on kill (all characters) |
| `CHARGE_ON_DAMAGE` | 4 | Bonus charge per damage event dealt |

Character-specific passive rates go in `passive_charge_rate()`. Character-specific passives that aren't charge (e.g. Isaak stillness) go in `tick_character_passives()`.

**Dev builds:** `GameWorld.dev_mode` is `true` when `cfg!(debug_assertions)`. In dev mode, `passive_charge_tick()` instantly refills charge for most characters. **Isaak keeps normal charge rates** so you can stand still and test stillness stacks between blasts.

### Activation flow

Abilities use **E on press** (edge-triggered), not hold-to-release:

1. `game.rs` → `process_ability_input()` calls `abilities::try_activate()`
2. Windups tick in `process_abilities()` each frame
3. Ongoing modes tick in `process_active_modes()` (boat, reel shield, status effects)

`try_release()` is currently unused — design powers around tap/press unless you deliberately extend it.

### Where to hook a new power

| Pattern | Example | Rust entry points |
|---------|---------|-------------------|
| Instant on full charge | Sonny hack, Jacob Director's Cut, Finn boat | `try_activate()` match arm |
| Windup then auto-fire | Bailey nuke, Isaak chi beam | Set `ability_windup`, finish in `process_abilities()` |
| Active mode with duration | Jacob popcorn, Finn boat, Taj shield | Player timer fields + `process_active_modes()` |
| Second press while active | Taj post shield | Early return in `try_activate()` before charge check |
| Passive buildup | Isaak stillness, Taj idle charge, Bailey slow charge | `tick_character_passives()` / `passive_charge_rate()` |
| Blocks or modifies combat | Taj shield, Jacob popcorn | `game.rs` fire/movement/damage hooks + `abilities` helpers |

Add a match arm in `try_activate()`:

```rust
"alex" => activate_alex_power(world, player_id),
```

Keep tuning numbers as `pub const` at the top of `abilities.rs` so tests and docs can reference them.

### Player state fields

If the power needs synced state beyond charge/windup, extend:

1. `Player` struct in `src-tauri/src/game.rs`
2. `PlayerSnapshot` in `src-tauri/src/protocol.rs`
3. `PlayerSnapshot` in `src/shared/types.ts`
4. Reset fields in `Player` respawn / match reset / death cleanup in `game.rs`

Existing examples:

- `stillness_stacks` — Isaak passive
- `reel_shield_remaining`, `reel_shield_hp`, `reel_shield_angle`, `reel_index` — Taj shield
- `boat_mode_until`, `boat_rammed`, `hangover_until` — Finn boat
- `controls_inverted_until` — Sonny hack
- `directors_cut_until`, `directors_cut_shots` — Jacob mode

Only add fields the client must render or the HUD must show. Purely internal timers can stay on `Player` without protocol exposure if the UI does not need them.

### World effects (VFX + projectiles)

Short-lived visuals and traveling objects use `WorldEffect` with an `EffectKind` in `protocol.rs` (mirrored in `src/shared/types.ts`).

Add a new `EffectKind` only when `ArenaRenderer` or `VfxManager` needs a distinct visual. Reuse `Mark`, `Explosion`, etc. when possible.

Projectile-like effects (Bailey nuke, Taj reel post) tick in `process_projectile_effects()`. Simple bursts expire in `process_effects()`.

---

## 4. Game loop hooks (`game.rs`)

After implementing the ability, check whether you need to touch:

| System | When to hook |
|--------|----------------|
| `process_movement()` | Speed multipliers, movement lock during channel, boat/hangover/director's cut |
| Fire / reload | Block shooting in boat mode or during channel (`in_boat_mode`, `is_casting`) |
| `apply_damage()` | Kill/damage charge bonuses, character-specific on-kill passives |
| Bullet simulation | Shield blocking (`check_shield_block`), custom projectile types |
| `notify_shot()` | Passives that care about time since last shot (Taj idle charge) |

Call existing helpers from `abilities.rs` instead of duplicating character checks in `game.rs`.

---

## 5. Frontend visuals & HUD

### VFX

- **`src/game/vfx/VfxManager.ts`** — draw bursts, beams, splashes
- **`src/game/ArenaRenderer.ts`** — map `effect.kind` from snapshots to VFX; attach persistent visuals to player views (Taj reel shield uses `TajReelVisuals.ts`)

Keep heavy assets in `public/assets/` and paths in content files (see `src/content/reels.ts` for Taj).

### HUD

- **`src/ui/game/HudAbilityButton.tsx`** — charge ring, windup progress, mode labels ("E to post", "Channeling…", popcorn shot count)
- **`src/ui/game/GameOverlay.tsx`** — passes player snapshot fields into the HUD

If you add windup or duration UI, mirror the Rust constants (or share a small content file like `reels.ts`) so the ring math stays accurate.

---

## 6. How powers should be designed

Abilities should feel like **personality**, not a generic ult button. Avoid "press E → flat damage" unless the character is intentionally simple.

### Design goals

1. **Express the friend** — The power should match how people actually joke about this person (setup vs chaos vs defense vs mobility).
2. **Create a decision** — When do I use this? Do I hold position? Do I spend the shield or post it?
3. **Trade something** — Charge time, windup, can't shoot, miss penalty, self-slow, positional requirement.
4. **Interact with gunplay** — Powers complement the glock/loadout loop; they don't replace it entirely.

### Good patterns in this project

| Pattern | Characters | Why it works |
|---------|------------|--------------|
| **Conditional charge** | Bailey (slow passive), Taj (faster when not shooting) | Rewards playstyle without extra buttons |
| **Setup / payoff** | Isaak (stillness → beam), Bailey (aim windup → nuke) | Visible skill expression |
| **Miss forgiveness** | Sonny (50% charge refund if no target in range) | Reduces feel-bad whiffs on skillshots |
| **Mode shift** | Jacob (speed + popcorn), Finn (speed + ram, no shoot) | Temporary identity change |
| **Defense + follow-up** | Taj (block → post) | Two-part expression in one charge |
| **Kill synergy** | Bailey (+15 charge on kill) | Snowball without raw damage buff |

### Activation shapes

Pick one primary shape per character:

- **Instant debuff** — Sonny
- **Telegraphed area damage** — Bailey
- **Long buff window** — Jacob
- **Channel skillshot** — Isaak
- **Deployable / shield** — Taj
- **Mobility burst with downside** — Finn

Mixing shapes across the roster keeps FFA interesting.

### What to avoid

- Pure damage buttons with no windup, range limit, or counterplay
- Powers that duplicate gun DPS but strictly better
- Hidden rules that aren't reflected in HUD copy or VFX
- Frontend-only gameplay (always authoritative in Rust)
- Long stun chains with no telegraph

### Copy checklist

Lobby/HUD text should mention:

- Windup time (if any)
- Duration (if any)
- Second-press behavior (Taj post)
- What you give up (can't shoot, slow charge, must stand still)
- Approximate damage or effect in player terms

---

## 7. Balancing characters

There is no separate "character stats" table — everyone uses **100 HP** and the same weapons. Balance is **ability output**, **charge economy**, **uptime**, and **reliability**.

### Baseline references

| Reference | Value | Notes |
|-----------|-------|-------|
| Player HP | 100 | 4 glock body shots to kill |
| Glock damage | 25 | `weapons/mod.rs` |
| Glock fire rate | 0.18s | ~139 DPS theoretical |
| Full charge (default) | ~16.7s passive | 6 charge/sec |
| Kill charge bonus | +25 | ~4.2s equivalent |
| Damage charge bonus | +4 per hit event | Rewards aggression |

Use these when asking "how many seconds of shooting equals this ability?"

### Ability damage targets

Rough FFA targets for a **full-charge** ability on a skilled read:

| Tier | Damage | Example |
|------|--------|---------|
| Soft punish | 30–40 | Finn ram (single target), Taj post |
| Strong pick | 60–75 | Bailey nuke center, Isaak beam |
| Utility / control | Low direct damage | Sonny hack (0 dmg, 4s invert) |

Area abilities should use falloff (see `blast_damage_at_distance()`). Single-target skillshots can be spicier but need range, windup, or miss cost.

### Charge economy tuning

| Knob | Effect |
|------|--------|
| `CHARGE_PASSIVE_PER_SEC` (per character) | How often they get their "ult" |
| Kill/damage bonuses | Snowball vs catch-up |
| Miss refund / partial refund | Whiff tolerance |
| Passive buildup (stillness, idle) | Rewards discipline |

**Rule of thumb:** A character with high burst should charge slower or have a longer telegraph. A character with low burst should have better uptime or control.

### Cooldowns vs charge

Most characters use **one shared charge bar** instead of a separate cooldown. Duration-based modes (Jacob 30s, Finn 4s boat, Taj 5.5s shield) act as implicit cooldowns because charge starts at 0 after use.

When adding a new mode:

1. Set duration and power
2. Time-to-next-full = duration + time to recharge 100 charge at that character's passive rate
3. Playtest against a default-charge character (~17s cycle)

### Movement & combat tradeoffs

Speed multipliers stack through `process_movement()`:

- Slow debuffs use `slow_multiplier` (e.g. 0.65 = 35% slow)
- Boat: 1.8× speed, cannot shoot
- Hangover: 0.5× speed briefly after boat
- Director's Cut: 1.67× speed + special weapon

If you add a new mode, decide explicitly: can they shoot? reload? use E again?

### Defensive tools

Taj's reel shield is the reference for blockers:

- **HP pool** (`REEL_SHIELD_HP`) — how much focus fire it absorbs
- **Duration** — max uptime if untouched
- **Arc coverage** — front block only; flanks still work
- **Follow-up** — posting converts defense into damage + slow

Tune HP so a glock mag (~200 dmg if all hit) breaks it but not in one bullet.

### Playtest checklist

- [ ] Time to full charge from spawn with no combat
- [ ] Time to full charge while actively fighting (damage + kill bonuses)
- [ ] Whiff case — does it feel fair?
- [ ] Counterplay — can you dodge, flank, break shield, wait out hack?
- [ ] 1v1 vs group fight value
- [ ] With friendly fire on and off (some effects respect `world.friendly_fire`)
- [ ] Respawn / death clears all modes and passives

### Tests to add

Add small unit tests in `abilities.rs` or `game.rs` for:

- Passive tick math (stillness stacks, charge rates)
- Refund on miss
- Shield block geometry
- Blast falloff
- Mode cleanup on death/respawn

---

## 8. Verify

```powershell
bunx tsc --noEmit
bun run build
cd src-tauri; cargo fmt; cargo check; cargo test
```

Play in dev mode for fast charge iteration (`tauri dev`). Test release builds for real charge timing before calling balance done.

---

## Example: minimal new character skeleton

**Files to touch**

```
public/assets/heads/alex.png
src/content/characters.ts
src-tauri/src/commands.rs              (clean_character_id)
src-tauri/src/abilities.rs             (constants + activate_alex_*)
src-tauri/src/game.rs                  (only if movement/combat hooks needed)
src-tauri/src/protocol.rs              (only if new snapshot fields / EffectKind)
src/shared/types.ts                    (mirror protocol)
src/game/vfx/VfxManager.ts             (optional VFX)
src/game/ArenaRenderer.ts              (wire effect.kind)
src/ui/game/HudAbilityButton.tsx       (optional HUD state)
```

**Rust skeleton**

```rust
pub const ALEX_POWER_DAMAGE: u16 = 40;
pub const ALEX_POWER_RANGE: f32 = 220.0;

fn activate_alex_power(world: &mut GameWorld, player_id: u8) {
    // validate, spend charge, apply effect or set windup
    if let Some(player) = world.players.get_mut(&player_id) {
        player.ability_charge = 0.0;
    }
}
```

Then playtest, tune constants, update [CHARACTERS.md](./CHARACTERS.md).

---

## Related docs

- [CHARACTERS.md](./CHARACTERS.md) — current roster, stats, and balance notes
- [ADDING_WEAPONS.md](./ADDING_WEAPONS.md) — weapons and loadout
- [AGENTS.md](../AGENTS.md) — architecture rules for agents
