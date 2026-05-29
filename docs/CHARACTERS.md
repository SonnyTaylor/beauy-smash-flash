# Character Roster

**Balance pass 2026-05-29:** Jacob (Director's Cut nerf + 120 HP / slower base), Sonny (hack 3s), Finn (55 ram, 5s boat, per-enemy re-hit cooldown), friendly-fire-off unified for abilities (Bailey nuke + Taj post no longer damage other humans).

**Roster expansion 2026-05-29:** Mango, Andrew, Lee Moore, Martin, Tristan, Andy, Xander. Protocol bumped to **v14** (`PROTOCOL_VERSION`).

**Roster expansion 2026-05-29 (Sifan batch):** Added Sifan, Connor, Archie, Arthur, Oscar, Vlad. Protocol bumped to **v11** (`PROTOCOL_VERSION`). Connor LoS blocking is **client-rendered** (`src/game/fog/maliceFog.ts`, `ArenaRenderer`) — applies even when lobby fog-of-war is off.

Authoritative reference for every playable character, their powers, and current balance numbers. Constants live in `src-tauri/src/abilities.rs` unless noted; movement, HP, and combat hooks live in `src-tauri/src/game.rs`.

For how to add or tune characters, see [ADDING_CHARACTERS.md](./ADDING_CHARACTERS.md).

**Last synced with code:** playable roster in `src/content/characters.ts` + `abilities.rs` / `game.rs`.

---

## Game primer (read this first)

**Beauy Smash Flash** is a LAN-only top-down arena shooter: friends pick a character, join a host on the same network, and fight in small maps with walls and line-of-sight. There are no accounts or cloud servers — one player hosts, everyone else connects over UDP. The Rust host simulates movement, hits, and scores; clients render that state and send input.

### Core loop

| Layer | What the player does |
|-------|----------------------|
| **Movement** | WASD, 360° aim with mouse |
| **Gun** | Primary + secondary loadout (default Glock), reload, swap, drop/pickup on the ground |
| **Ability** | Press **E** when the charge ring is full (100%) — one press, not hold |

A typical fight is mostly **gunplay** (positioning, aim, reload timing). Abilities are **fight swingers**: burst damage, debuffs, shields, or mobility windows — not a second health bar or guaranteed kill button. TTK at 100 HP with the default Glock is roughly four clean shots (25 dmg each) before amps, armor, or healing.

### Modes that affect balance

| Mode | Notes for tuning |
|------|------------------|
| **Deathmatch** | Respawns; score = kills. Abilities recharge over time and from combat. |
| **Last Mate Standing** | No respawns; one life per round. Charge pacing and burst reliability matter more. |
| **Zombie Horde** | Co-op vs AI zombies; friendly fire rules differ (humans can always damage zombies). |
| **Friendly fire off** | Often used for practice. Abilities follow the same human-vs-human rule as bullets (see FF table). Bailey can still **self-nuke**; zombies remain valid targets. |

### Ability system (how to think about balance)

1. **Charge bar (0–100)** — Fills passively, faster when fighting (damage dealt, kills). Each character can tune passive rate and kill bonuses.
2. **Full charge → press E** — Spends charge (sometimes partially refunded on hit/miss). Some kits are two-step (e.g. Taj: deploy shield, then E again to post without a second full charge).
3. **Windups and channels** — Several powers have 1–2s telegraphs; balance is tradeoff between power and dodge window.
4. **Debuffs stack with guns** — Sonny hack and Jacob mark multiply **all** incoming damage, so team comp and focus fire matter.
5. **Luca** — Joke pick (1 HP, no gun); exclude from serious FFA balance.

When comparing characters, weigh **time to full charge**, **reliability** (skillshot vs auto-target), **counterplay**, and **friendly-fire behavior** — not only peak damage on paper.

### How to use this document

- **Shared rules** — Baseline stats and global charge/FF rules every character inherits unless overridden.
- **At a glance** — Quick roster comparison before diving into kits.
- **Per-character sections** — Exact numbers, charge refunds, and counterplay from the current build.
- **Balance rework cheat sheet** (end) — Levers in code and known asymmetries to fix or keep intentionally.

Numbers here match the **authoritative Rust sim**, not lobby UI copy. After changing balance, edit constants in `abilities.rs` / `game.rs` and update this file so design notes stay aligned.

---

## Shared rules

Most fighters share the default row below. **Jacob**, **Arthur**, **Martin**, and **Tristan** override HP; **Jacob** also overrides base speed.

| Stat | Default | Overrides | Source |
|------|---------|-----------|--------|
| Max HP | 100 | Jacob **120**, Arthur **110**, Tristan **110**, Martin **90** | `PLAYER_MAX_HP`, per-char constants |
| Move speed | 360 px/s | Jacob **331 px/s** (×0.92) | `PLAYER_SPEED`, `JACOB_BASE_SPEED` |
| Default weapon | Glock (25 dmg, 0.18s fire rate, 17 mag, 1.2s reload) | `weapons/mod.rs` |
| Ability key | **E** (press on rising edge, not hold) | `process_ability_input()` |
| Charge max | 100 | `ABILITY_CHARGE_MAX` |

### Global charge economy

| Source | Amount | Notes |
|--------|--------|-------|
| Passive refill | +6 / sec | Default for most characters |
| Kill | +25 | All characters (stacks with character bonuses below) |
| Damage dealt | +4 | Per `apply_damage` event (non-lethal hits) |
| Dev mode | Instant refill | **Except Isaak** — stillness timing stays testable |

**Jacob exception:** While Director's Cut is active, `add_charge` is a no-op — no passive refill, no kill bonus, no damage bonus until the mode ends.

### Friendly fire vs abilities

When **friendly fire is off**, human-vs-human damage is blocked for guns and abilities alike. **Self-damage is not friendly fire** — Bailey can still hit herself in her own blast.

| Ability / effect | Damages other humans when FF off? | Notes |
|------------------|-----------------------------------|-------|
| Gun / melee bullets | No | `damage_allowed()` |
| Bailey Truth Nuke | No | Yes to **self** + **zombies** (`truth_nuke_hit_allowed`) |
| Taj Story Shield post | No | `damage_allowed()` before damage |
| Isaak Chi Blast | No | Beam raycast skips humans |
| Finn boat ram | No | `process_boat_rams` returns early |
| Sonny Reverse Shell | N/A | Debuff only |
| Mango Overthink | N/A | Root debuff only |
| Andrew Blur | N/A | Debuff only |
| Lee Feast | N/A | Self-heal / lifesteal only |
| Martin Off the Meds | N/A | Self-buff / self-lifesteal only |
| Tristan Ragebait | N/A | Reflect respects FF (no ally reflect) |
| Andy Liquid Courage | N/A | Self-buff; Lachy bites respect FF |
| Xander Hyperfixation | N/A | Defensive only |
| Jacob popcorn | No | Same as bullets |

### Damage multipliers (stack multiplicatively)

On every hit through `apply_damage()`:

1. **Jacob mark:** ×1.4 if `marked_until > 0`
2. **Sonny hack:** ×1.3 if `controls_inverted_until > 0`
3. **Andrew blur:** ×0.6 on **attacker** outgoing damage if `blur_until > 0` (`damage_output_multiplier`)
4. **Tristan ragebait:** ×0.6 incoming on victim if `ragebait_until > 0`
5. **Andy liquid courage:** ×0.65 incoming if `liquid_courage_until > 0`
6. **Martin off the meds:** ×1.25 incoming if `off_the_meds_until > 0`

Example: 25 dmg Glock on hacked + marked target → `round(25 × 1.4 × 1.3) = 46`.
Example: Blurred attacker with Glock → `round(25 × 0.6) = 15`.
Example: Ragebait Tristan hit for 100 raw → takes 60, attacker reflects 24.

---

## At a glance

| Character | `abilityId` | Power | Role | Charge style | Primary payoff |
|-----------|-------------|-------|------|--------------|----------------|
| Sonny | `reverse_shell` | Reverse Shell | Disruption | Standard | 3s invert + 30% damage amp on nearest enemy |
| Bailey | `truth_nuke` | Truth Nuke | Burst AoE | Slow passive | 21–60 AoE + slow; self/zombies only when FF off |
| Jacob | `directors_cut` | Director's Cut | Tempo / mark / tank | No recharge in mode | 120 HP, 18s mode, 18 popcorn; kills refund 2 shots |
| Isaak | `chi_blast` | Chi Blast | Skillshot | Standard + stillness | 55–85 beam; slow scales with stacks |
| Taj | `doomscroll` | Story Shield | Defense / poke | Faster when idle | Block arc, post for 32 dmg + charge refund |
| Finn | `cheeky_dinghy` | Cheeky Dinghy | Initiation | Standard | 55 ram, 5s boat, 1.2s re-hit per enemy |
| Sifan | `juice_heist` | Juice Heist | Anti-caster | Standard | Steal 40 charge + steroid buff / crash |
| Connor | `malice_drop` | MALICE Drop | Zone control | Standard | 6s fog zone, 10 dmg/s + slow + client LoS block |
| Archie | `jump_cut` | Dexie Rush | Mobility | Restless (+3/s moving) | 280px blink + brief speed burst |
| Arthur | `hot_lap` | Hot Lap | Mobile skirmisher | Standard | 5s kart + go-kart sprite, gun enabled, oil trail (no self-harm); 110 HP, big hitbox |
| Oscar | `chippys_special` | Chippy's Special | Support / heal | Slow passive (4.5/s) | Heal station 8 HP/s, tray 60 HP |
| Vlad | `going_viral` | Going Viral | Summoner | Standard | 3 drones, 6 dmg / 0.8s each |
| Mango | `overthink` | Overthink | CC / utility | Standard | Skillshot root 1.2s; ~50% refund on miss |
| Andrew | `blur` | Blur | Debuff | Standard | Nearest enemy −40% outgoing dmg 3.5s |
| Lee Moore | `feast` | Feast | Sustain | Standard | +20 HP + 40% lifesteal 6s |
| Martin | `off_the_meds` | Off the Meds | Berserk | Standard | 5s +30% fire rate, +20% speed, 15% LS; +25% taken; 90 HP |
| Tristan | `ragebait` | Ragebait | Tank / punish | Standard | 2.5s −40% taken + 40% reflect; 110 HP |
| Andy | `liquid_courage` | Liquid Courage | Sustain / pet | Standard | 5s −35% taken, 4 HP/s, aim sway, Lachy bites |
| Xander | `hyperfixation` | Hyperfixation | Defensive | Standard | 0.3s windup → 1.5s invuln + cleanse |
| Luca | `none` | *(none)* | Meme / handicap | Very slow passive | 1 HP, no gun, E does nothing |

**Horde NPC (not in loadout):** Zombie — slow, melee claws, selectable only as spawned horde enemy.

### Roster balance goals (design intent)

No character should be "press E for flat damage." Each power has a **tradeoff**, **setup**, or **follow-up** loop:

| Character | What makes it interesting |
|-----------|---------------------------|
| Sonny | Zero direct damage; hacked targets die faster to all sources |
| Bailey | Slowest charge, fight-swinging AoE; self-nuke risk at close range |
| Jacob | Long mode, popcorn marks team focus; no charge gain during mode |
| Isaak | Stillness mini-game; beam blocked by FF-off in practice mode |
| Taj | Two-step shield → post; idle charge rewards pacing |
| Finn | All-in commit; ram needs FF on; gun disabled in boat |
| Mango | Zero direct damage; roots but leaves gun online — punish with aim |
| Andrew | Zero direct damage; blurs nearest — anti-carry debuff |
| Lee | Self-buff sustain; lifesteal rewards aggression, FF-off is self-only |
| Martin | High tempo with glass tradeoff — faster but takes more damage |
| Tristan | Bait damage into reflect windows; 110 HP anchor |
| Andy | Drunk tank with pet pressure; aim sway is the cost |
| Xander | Cleanse + invuln dodge window; cannot shoot during bubble |
| Luca | Exists as a joke handicap — charge still fills |

---

## Sonny — Reverse Shell

| Field | Value |
|-------|-------|
| Color | Cyan `(0, 255, 255)` |
| Sprite | `heads/sonny.png` |
| UI copy | Hack nearest enemy 3s — inverted controls + 30% extra damage taken |

### Ability: Reverse Shell

| Stat | Value |
|------|-------|
| Range | 280 px |
| Duration | 3.0s |
| Targeting | Nearest living enemy in range (not spawn-protected) |
| Effect | Movement **and** aim inputs inverted (`apply_hack_inversion`) |
| Vulnerability | **×1.3 damage taken** while hacked |
| Landing bonus | +18 charge back on successful hack |
| Direct damage | None |

**Charge on use:**

| Outcome | Charge after activation |
|---------|-------------------------|
| Hit | 18 (spent 100, refunded 18 → **net 82** to next full E) |
| Miss (no target in range) | 50 (`SONNY_MISS_REFUND`, ~50% refund) |

### Passive / charge

| Stat | Value |
|------|-------|
| Passive charge | 6 / sec |
| Kill / damage bonuses | Standard (+25 / +4) |

### Balance notes

- Reliable in close fights; weak at long range or when alone.
- Hack is setup for gunplay and teammates — amp applies to **all** damage sources.
- Works when friendly fire is off (debuff only).
- **Counterplay:** Break line of sight, stay outside 280px, bait on cooldown.

---

## Bailey — Truth Nuke

| Field | Value |
|-------|-------|
| Color | Magenta `(255, 0, 128)` |
| Sprite | `heads/bailey.png` |

### Ability: Truth Nuke

| Stat | Value |
|------|-------|
| Aim windup | 1.25s (reticle tracks aim during windup) |
| Projectile flight | 0.9s |
| Total telegraph | ~2.15s (windup + flight) |
| Range | 350 px (aim clamped to map bounds) |
| Blast radius | 150 px |
| Max damage | 60 (center) |
| Min falloff | 35% at edge (`BAILEY_NUKE_MIN_FALLOFF`) |
| Falloff formula | `damage = max_dmg × (1 - t × (1 - min_falloff))` where `t = distance / radius` |
| Slow on hit | 0.45s at ×0.78 speed |
| Arc height | 140 px (visual lob) |
| Self-damage | **Yes** — Bailey can hit herself in the blast |

When friendly fire is off, the explosion does **not** damage other humans — only Bailey (if in radius) and zombies. Large truth explosion VFX is visible to all players (mostly visual/audio, not a gameplay stun).

### Passive / charge

| Stat | Value |
|------|-------|
| Passive charge | **3.25 / sec** (~30.8s empty → full) |
| Kill bonus | **+15 extra** (+40 total on kill: 25 + 15) |
| Damage bonus | +4 (standard) |

Slowest baseline recharge — pays for reliable teamfight burst.

### Balance notes

- ~0.6 kills worth of damage at center on 100 HP targets; edge still ≥21 dmg at typical radii.
- Close-range self-blast is a real risk.
- **Counterplay:** Scatter before detonation, use walls, punish long windup.

---

## Jacob — Director's Cut

| Field | Value |
|-------|-------|
| Color | Green `(50, 255, 50)` |
| Sprite | `heads/jacob.png` |
| Base HP | **120** (`JACOB_MAX_HP`) |
| Base speed | **331 px/s** (`JACOB_BASE_SPEED`, ×0.92 vs roster default) |

### Ability: Director's Cut

| Stat | Value |
|------|-------|
| Mode duration | 18.0s |
| Speed multiplier | ×1.5 (**~497 px/s** in mode: 331 × 1.5) |
| Popcorn shots | 18 (starts at 18; cannot re-cast while active) |
| Popcorn damage | 14 per hit |
| Popcorn fire rate | 0.11s between shots (~9 shots/sec max) |
| Popcorn speed | 920 px/s |
| Popcorn hit radius | 8 px |
| Popcorn lifetime | 4.5s |
| Popcorn bounces | Up to 12 wall bounces |
| Popcorn spread | ±6° initial; ±40° on bounce |
| Mark duration | 3.0s |
| Mark damage mult | ×1.4 from **all** sources while marked |
| Kill during mode | **+2 popcorn shots** (capped at 18) |

During Director's Cut, normal gun fire is replaced by popcorn (`try_fire_popcorn`). Mode ends when `directors_cut_shots == 0` **or** `directors_cut_until` expires. Cannot activate again until mode ends.

### Passive / charge

| Stat | Value |
|------|-------|
| Passive charge | 6 / sec **only outside mode** |
| Charge during mode | **Frozen at 0** — no passive, kill, or damage charge |

One full charge buys an 18s window; effective cooldown is ~18s mode plus ~16.7s recharge after.

### Theoretical damage ceiling

| Metric | Value |
|--------|-------|
| If all 18 popcorn hit once | 252 raw (before mark/hack amps) |
| Realistic | Spread, bounces, and misses lower this heavily |

### Balance notes

- Mark multiplies **team** focus fire, not just popcorn.
- Kills during mode extend the scene (+2 shots).
- Tankier and slightly slower outside mode; mode speed is lower than before (~497 vs old 601 px/s).
- **Counterplay:** Space out, avoid corridor bounce chains, end fight before shot budget runs out.

---

## Isaak — Chi Blast

| Field | Value |
|-------|-------|
| Color | Gold `(255, 200, 0)` |
| Sprite | `heads/isaak.png` |

### Ability: Chi Blast

| Stat | Value |
|------|-------|
| Channel windup | 1.4s (`ISAAC_CHI_WINDUP`) |
| Movement during channel | **Blocked** (`is_casting` skips movement) |
| Aim during channel | Updates toward input each tick |
| Beam damage | **55 + 10 × stacks** (max **85** at 3 stacks) |
| Beam range | 900 px |
| Beam half-width | 14 px |
| Targets | First enemy along ray (FF must be on for human hits) |
| Wall pierce | **1 wall**, then stops |
| Slow on hit | Only if `stacks > 0`; scales with stacks (see below) |

**Slow scaling** (`stack_ratio = stacks / 3`):

| Stacks | Duration | Speed mult |
|--------|----------|------------|
| 1 | 0.33s | ×0.883 |
| 2 | 0.67s | ×0.767 |
| 3 | 1.0s | ×0.65 |

After firing: `stillness_stacks` and `stillness_timer` reset to 0.

### Passive: Stillness

| Stat | Value |
|------|-------|
| Stack interval | 1.5s standing still |
| Max stacks | 3 |
| Timer reset | Moving, **channeling** (`is_casting`), or boat mode |
| Stacks during channel | Existing stacks kept until blast fires; cannot gain stacks while channeling |

### Passive / charge

| Stat | Value |
|------|-------|
| Passive charge | 6 / sec |
| Dev mode | Normal passive rate (not instant refill) |

### Balance notes

- 1–2 stacks already change TTK and slow — full meditate not required.
- Beam useless for human damage when FF off (practice mode).
- One wall pierce enables angle plays without map-wide beam.
- **Counterplay:** Peek during 1.4s channel, flank, force movement to drop stacks before E.

---

## Taj — Story Shield

| Field | Value |
|-------|-------|
| Color | Red `(255, 80, 80)` |
| Sprite | `heads/taj.png` |
| Internal `abilityId` | `doomscroll` (UI name: Story Shield) |

### Ability: Story Shield

**First E (full charge):** Deploy reel shield in front of aim direction.

| Stat | Value |
|------|-------|
| Duration | 5.5s |
| Shield HP | 110 |
| Block geometry | Half-width 58 px (~116 px wide), depth 16 px, offset 44 px in front |
| Rotates | Yes — follows aim while active |
| Reel assets | 5 MP4s cycle (`public/assets/reels/reel-0.mp4` … `reel-4.mp4`) |

**Second E (while shield up, no charge cost):** Post shield forward.

| Stat | Value |
|------|-------|
| Travel time | 0.55s |
| Travel range | 240 px |
| Impact damage | 32 |
| Knockback | 280 px impulse |
| Slow | 1.25s at ×0.72 speed |
| Post charge refund | +22 toward next shield |
| FF off | **Does not damage other humans** (`damage_allowed`) |

Shield absorbs bullet damage from `reel_shield_hp` until broken or expired. Bullets blocked via `check_shield_block` (segment vs shield plane).

### Passive / charge

| Stat | Value |
|------|-------|
| Passive charge (default) | 6 / sec |
| Passive charge (idle) | **9 / sec** if no shot for **≥ 0.5s** (`last_shot_timer`) |

**Net charge after post:** 22 refund → **78** toward next full shield if you only post once.

### Balance notes

- ~4–5 glock shots to break 110 shield HP (25 dmg each, no amp).
- Post rewards aggression; idle bonus rewards disengaging to prep another shield.
- **Counterplay:** Flank, wait out 5.5s, break HP before post, dodge post travel line.

---

## Finn — Cheeky Dinghy

| Field | Value |
|-------|-------|
| Color | Purple `(180, 100, 255)` |
| Sprite | `heads/finn.png` |

### Ability: Cheeky Dinghy

| Stat | Value |
|------|-------|
| Boat duration | 5.0s |
| Speed multiplier | ×1.8 (**596 px/s** at default base; uses character base speed) |
| Ram damage | 55 per hit |
| Ram knockback | 320 px impulse |
| Re-hit cooldown | **1.2s per enemy** (same target can be rammed again after cooldown) |
| Charge refund | **+22** first ram on an enemy this activation; **+8** on subsequent re-hits of that enemy |
| Shooting | **Disabled** during boat |
| Hangover after boat | 0.55s at ×0.62 speed (~223 px/s) |
| Ram when FF off | **No damage** (entire ram pass skipped) |
| Re-activate during boat | Blocked (`try_activate` returns if `in_boat_mode`) |

### Passive / charge

| Stat | Value |
|------|-------|
| Passive charge | 6 / sec |

**Net charge:** First ram on a target → 22 refund (**78** toward next boat). Re-hits on the same enemy grant +8.

### Balance notes

- Trade gun DPS for gap-close burst; longer boat (5s) with re-hit potential.
- Knockback + 1.2s per-target cooldown limits face-camping one player.
- Useless ram in FF-off practice unless testing other systems.
- **Counterplay:** Sidestep ram vector, punish hangover, walls block approach.

---

## Sifan — Juice Heist

| Field | Value |
|-------|-------|
| Color | Orange `(255, 160, 60)` |
| Sprite | `heads/sifan.png` |

### Ability: Juice Heist

| Stat | Value |
|------|-------|
| Range | 260 px (nearest enemy, auto) |
| Target drain | **40 charge** |
| Self gain | **+25 charge** |
| Steroid buff | 5.0s — ×1.15 move speed, ×1.15 damage dealt |
| Comedown | 2.0s — ×0.85 move speed |
| Direct damage | None |
| FF off | Full effect (no damage) |

---

## Connor — MALICE Drop

| Field | Value |
|-------|-------|
| Color | Ice blue `(140, 180, 255)` |
| Sprite | `heads/connor.png` |

### Ability: MALICE Drop

| Stat | Value |
|------|-------|
| Placement range | 300 px toward aim |
| Zone radius | 170 px |
| Duration | 6.0s |
| DoT | ~10 HP/s (1 dmg per accum tick) |
| Slow inside | ×0.85 |
| LoS block | **Client render** — can't see into hostile fog or through it from outside; safe inside own zones (`maliceFog.ts`) |
| FF off | DoT respects FF (no human allies damaged) |

---

## Archie — Dexie Rush

| Field | Value |
|-------|-------|
| Color | Pink `(255, 120, 200)` |
| Sprite | `heads/archie.png` |

### Ability: Dexie Rush

| Stat | Value |
|------|-------|
| Blink range | 280 px toward aim (wall-clamped) |
| Post-blink burst | 0.4s at ×1.2 speed |

### Passive: Restless

| Stat | Value |
|------|-------|
| Moving | **+3 / sec** bonus passive charge |
| Standing | Standard 6 / sec only |

Mirror of Isaak's stillness — rewards movement, not meditation.

---

## Arthur — Hot Lap

| Field | Value |
|-------|-------|
| Color | Rust `(200, 80, 40)` |
| Sprite | `heads/arthur.png` |
| Base HP | **110** |
| Hit radius | ×1.18 (`ARTHUR_HIT_RADIUS_MULT`) — easier to hit |

### Ability: Hot Lap

| Stat | Value |
|------|-------|
| Kart duration | 5.0s |
| Speed | ×1.35 (can still shoot) |
| Ram damage | **None** (unlike Finn) |
| Oil trail | Every 0.2s, slick lasts 3s: ×0.7 slow + 6 dmg/s |
| FF off | Trail DoT respects FF |

---

## Oscar — Chippy's Special

| Field | Value |
|-------|-------|
| Color | Chip gold `(255, 220, 100)` |
| Sprite | `heads/oscar.png` |

### Ability: Chippy's Special

| Stat | Value |
|------|-------|
| Placement range | 280 px toward aim |
| Heal radius | 140 px |
| Duration | 6.0s |
| Heal rate | 8 HP/s (self + allies in zone) |
| Tray HP | 60 (shootable, radius ~42 px) |
| Passive charge | **4.5 / sec** (~22.2s to full) |
| FF off | Heal only — always safe |

---

## Vlad — Going Viral

| Field | Value |
|-------|-------|
| Color | Purple `(160, 60, 220)` |
| Sprite | `heads/vlad.png` |

### Ability: Going Viral

| Stat | Value |
|------|-------|
| Drones | 3 |
| Duration | 7.0s per drone |
| Drone HP | 15 each (shootable) |
| Fire rate | 0.8s |
| Damage | 6 per shot |
| Range | 520 px auto-target |
| FF off | Drone shots respect FF |

---

## Mango — Overthink

| Field | Value |
|-------|-------|
| Color | Orange `(255, 140, 80)` |
| Sprite | `heads/mango.png` |
| `abilityId` | `overthink` |

### Ability: Overthink

| Stat | Value | Source |
|------|-------|--------|
| Type | Skillshot projectile | `roster_expansion.rs` |
| Range | 400 px | `MANGO_OVERTHINK_RANGE` |
| Travel speed | 700 px/s | `MANGO_OVERTHINK_SPEED` |
| Root duration | 1.2s | `MANGO_OVERTHINK_ROOT_DURATION` |
| Direct damage | **0** | — |
| Miss refund | ~50 charge | `MANGO_OVERTHINK_MISS_REFUND` |
| Passive charge | 6 / sec | standard |
| FF off | Root debuff applies normally | no damage |

**Root:** target cannot move (`rooted_until`) but **can aim and shoot**.

**Counterplay:** dodge the bolt; rooted target is still dangerous at range.

---

## Andrew — Blur

| Field | Value |
|-------|-------|
| Color | Sky blue `(120, 200, 255)` |
| Sprite | `heads/andrew.png` |
| `abilityId` | `blur` |

### Ability: Blur

| Stat | Value | Source |
|------|-------|--------|
| Targeting | Nearest enemy, 300 px | `ANDREW_BLUR_RANGE` |
| Debuff duration | 3.5s | `ANDREW_BLUR_DURATION` |
| Outgoing damage mult | ×0.6 (−40%) | `ANDREW_BLUR_DAMAGE_OUTPUT_MULT` |
| Direct damage | **0** | — |
| Miss refund | ~50 charge (no target) | `ABILITY_MISS_REFUND` |
| Passive charge | 6 / sec | standard |
| FF off | Debuff applies normally | no damage |

Applied on the **attacker** side of `apply_damage()` via `damage_output_multiplier`.

---

## Lee Moore — Feast

| Field | Value |
|-------|-------|
| Color | Lime `(180, 255, 120)` |
| Sprite | `heads/lee.png` |
| `abilityId` | `feast` |

### Ability: Feast

| Stat | Value | Source |
|------|-------|--------|
| Instant heal | +20 HP (clamped to max) | `LEE_FEAST_HEAL_INSTANT` |
| Lifesteal duration | 6.0s | `LEE_FEAST_DURATION` |
| Lifesteal rate | 40% of damage **dealt** | `LEE_FEAST_LIFESTEAL` |
| Passive charge | 6 / sec | standard |
| FF off | Self-heal / lifesteal only | no ally interaction |

Lifesteal hooks on the dealer side in `apply_damage()` while `feast_until > 0`.

---

## Martin — Off the Meds

| Field | Value |
|-------|-------|
| Color | Pink `(255, 90, 180)` |
| Sprite | `heads/martin.png` |
| `abilityId` | `off_the_meds` |

### Base stats

| Stat | Value | Source |
|------|-------|--------|
| Max HP | **90** | `MARTIN_MAX_HP` |
| Move speed | 360 px/s base | default |

### Ability: Off the Meds

| Stat | Value | Source |
|------|-------|--------|
| Duration | 5.0s | `MARTIN_MEDS_DURATION` |
| Fire rate | +30% (`÷1.3` cooldown) | `MARTIN_MEDS_FIRE_RATE_MULT` |
| Move speed | +20% | `MARTIN_MEDS_SPEED_MULT` |
| Lifesteal | 15% of damage dealt | `MARTIN_MEDS_LIFESTEAL` |
| Damage taken | ×1.25 | `MARTIN_MEDS_DAMAGE_TAKEN_MULT` |
| Gun | Normal loadout (not popcorn) | — |
| Passive charge | 6 / sec | standard; **does not** freeze like Jacob |
| FF off | Lifesteal self-only | — |
| VFX | Rainbow trail while active | `off_the_meds_remaining` on snapshot |

---

## Tristan — Ragebait

| Field | Value |
|-------|-------|
| Color | Red `(255, 60, 60)` |
| Sprite | `heads/tristan.png` |
| `abilityId` | `ragebait` |

### Base stats

| Stat | Value | Source |
|------|-------|--------|
| Max HP | **110** | `TRISTAN_MAX_HP` |

### Ability: Ragebait

| Stat | Value | Source |
|------|-------|--------|
| Stance duration | 2.5s | `TRISTAN_RAGEBAIT_DURATION` |
| Incoming damage | ×0.6 | `TRISTAN_RAGEBAIT_DAMAGE_MULT` |
| Reflect | 40% of damage **taken** back to attacker | `TRISTAN_RAGEBAIT_REFLECT` |
| Reflect chains | **No** — reflected hits skip re-reflect | `from_reflect` flag |
| Passive charge | 6 / sec | standard |
| FF off | Reflect does **not** hit allied attackers | `damage_allowed()` |

---

## Andy — Liquid Courage

| Field | Value |
|-------|-------|
| Color | Lavender `(200, 160, 255)` |
| Sprite | `heads/andy.png` |
| `abilityId` | `liquid_courage` |

### Ability: Liquid Courage

| Stat | Value | Source |
|------|-------|--------|
| Duration | 5.0s | `ANDY_LIQUID_COURAGE_DURATION` |
| Incoming damage | ×0.65 | `ANDY_LIQUID_COURAGE_DAMAGE_MULT` |
| Regen | 4 HP/s | `ANDY_LIQUID_COURAGE_HEAL_PER_SEC` |
| Aim sway | Subtle random offset each tick | `aim_sway_x/y`, `ANDY_AIM_SWAY` |
| Pet | **Lachy** — 1 melee follower | `FollowerDroneKind::MeleePet` |
| Lachy HP | 20 (shootable) | `LACHY_HP` |
| Lachy bite | 12 dmg / ~1.0s | `LACHY_DAMAGE`, `LACHY_BITE_INTERVAL` |
| Lachy range | 72 px melee | `LACHY_MELEE_RANGE` |
| Lachy follow offset | 72 px ring behind/side | `LACHY_FOLLOW_RADIUS` |
| FF off | Lachy bites respect FF; self-buff unaffected | — |

---

## Xander — Hyperfixation

| Field | Value |
|-------|-------|
| Color | Teal `(140, 255, 220)` |
| Sprite | `heads/xander.png` |
| `abilityId` | `hyperfixation` |

### Ability: Hyperfixation

| Stat | Value | Source |
|------|-------|--------|
| Windup | 0.3s tell | `XANDER_HYPERFIXATION_WINDUP` |
| Invulnerability | 1.5s (blocks **all** damage) | `XANDER_HYPERFIXATION_DURATION` |
| Cleanse on start | hack, root, mark, blur, slow | `cleanse_debuffs()` |
| Movement | ×0.8 speed during invuln | `XANDER_HYPERFIXATION_MOVE_MULT` |
| Shoot / reload | **Disabled** during invuln | `process_combat` |
| Passive charge | 6 / sec | standard |
| FF | N/A (defensive only) | — |

Invuln is an early return in `apply_damage()` — blocks DoT, reflect, and direct hits.

---

## Luca — Existing

| Field | Value |
|-------|-------|
| Color | Olive `(100, 140, 70)` |
| Sprite | `heads/luca.png` |
| `abilityId` | `none` |

**Not a real power user** — selectable joke / handicap pick.

| Stat | Value | Source |
|------|-------|--------|
| Max HP | **1** | `LUCA_MAX_HP` |
| Move speed | ×0.42 (151 px/s) | `LUCA_SPEED_MULT` |
| Weapons | **None** — cannot shoot, reload, pick up, or drop loot | `is_luca_character()` hooks |
| Ability (E) | No-op at full charge | `try_activate` → `_ => {}` |
| Passive charge | **1.5 / sec** (~66.7s to full) | `LUCA_CHARGE_PASSIVE_PER_SEC` |
| Death loot | Does not drop weapons | `drop_player_weapons_on_death` early return |

Charge bar still fills — E at 100% does nothing. Intended as an "I was already here" meme pick, not for fair FFA.

---

## Horde NPC — Zombie

Defined in `ZOMBIE_CHARACTER` in `characters.ts`. **Not** in loadout / lobby character select.

| Stat | Value |
|------|-------|
| Speed | ×0.48 (173 px/s) |
| Weapon | `zombie_claws` melee — 16 dmg, 1.15s rate, 72 px range, 95° arc |
| Ability | None |
| FF off | Can still damage humans (human↔zombie allowed in `damage_allowed`) |

---

## Power comparison (direct damage)

Approximate direct damage from a full charge at ideal execution:

| Character | Typical damage | Notes |
|-----------|----------------|-------|
| Sonny | 0 direct | +30% damage taken on hacked target |
| Bailey | 21–60 + slow | Radius falloff; can self-hit |
| Jacob | Up to ~252 theoretical | 18 × 14 if all popcorn connect; mode ≈18s |
| Isaak | 55–85 | Single-target beam; FF required vs humans |
| Taj (post) | 32 + slow | Optional after 5.5s block; +22 charge refund |
| Finn (ram) | 55 per hit | +22 first / +8 re-hit per enemy; FF required |
| Mango | 0 direct | Root only |
| Andrew | 0 direct | −40% outgoing on debuffed target |
| Lee | 0 direct | +20 burst heal + 40% lifesteal |
| Martin | 0 direct | Tempo buff; +25% damage taken |
| Tristan | 0 direct | −40% taken + 40% reflect |
| Andy | 0 direct + pet bites | 12 dmg/bite from Lachy |
| Xander | 0 direct | Invuln + cleanse |
| Luca | 0 | — |

Gun damage still matters — abilities are fight swingers, not guaranteed kills.

---

## Charge time comparison

Time to full charge from **empty**, passive only (no combat):

| Character | Rate (/ sec) | Time to 100 |
|-----------|--------------|-------------|
| Most | 6.0 | ~16.7s |
| Bailey | 3.25 | ~30.8s |
| Taj (idle, no shot ≥0.5s) | 9.0 | ~11.1s |
| Luca | 1.5 | ~66.7s |

Combat adds +4 per damage event and kill bonuses (+25 base, +40 total for Bailey). Jacob gains **nothing** during Director's Cut.

---

## Status effect reference

| Effect | Used by | Synced field / mechanism |
|--------|---------|--------------------------|
| Controls inverted | Sonny | `controls_inverted_until` |
| +30% damage taken | Sonny | `SONNY_HACK_DAMAGE_MULT` in `apply_damage` |
| Slow | Isaak beam, Bailey nuke, Taj post | `slowed_until`, `slow_multiplier` |
| Mark (+40% damage taken) | Jacob popcorn | `marked_until`, `mark_damage_multiplier` |
| Director's Cut mode | Jacob | `directors_cut_until`, `directors_cut_shots` |
| Reel shield | Taj | `reel_shield_remaining`, `reel_shield_hp`, `reel_shield_angle` |
| Boat / hangover | Finn | `boat_mode_until`, `hangover_until`, `boat_ram_cooldowns`, `boat_ram_first_refund_done` |
| Stillness stacks | Isaak | `stillness_stacks` |
| Root (no move, can shoot) | Mango | `rooted_until` |
| Blur (−40% outgoing) | Andrew | `blur_until`, `damage_output_multiplier` |
| Feast lifesteal | Lee | `feast_until` + dealer hook in `apply_damage` |
| Off the Meds mode | Martin | `off_the_meds_until` |
| Ragebait (−40% taken + reflect) | Tristan | `ragebait_until` + reflect in `apply_damage` |
| Liquid courage (−35% taken + regen) | Andy | `liquid_courage_until` |
| Invulnerability | Xander | `invulnerable_until` |
| Melee pet (Lachy) | Andy | `FollowerDroneKind::MeleePet`, `drones[].kind` |

All major modes clear on death/respawn.

---

## Frontend assets per character

| Character | Head sprite | Extra assets |
|-----------|-------------|--------------|
| Sonny | `heads/sonny.png` | Hack VFX |
| Bailey | `heads/bailey.png` | Truth nuke trail + explosion GIF |
| Jacob | `heads/jacob.png` | Director's Cut burst, popcorn bullets |
| Isaak | `heads/isaak.png` | Chi channel + beam VFX, stillness pips on arena |
| Taj | `heads/taj.png` | Reel MP4s + phone frame (`TajReelVisuals.ts`) |
| Finn | `heads/finn.png` | Dinghy sprite (`boat.png`), boat splash VFX |
| Mango | `heads/mango.png` | Overthink projectile VFX (`EffectKind::Overthink`) |
| Andrew | `heads/andrew.png` | Hack-style debuff burst |
| Lee | `heads/lee.png` | Mark-style feast burst |
| Martin | `heads/martin.png` | Rainbow trail (`off_the_meds_remaining`) |
| Tristan | `heads/tristan.png` | Shield-style stance burst |
| Andy | `heads/andy.png` | Lachy pet sprite (`lachy.png`, `DroneSnapshot.kind = 1`) |
| Xander | `heads/xander.png` | Chi channel invuln burst |
| Luca | `heads/luca.png` | (none) |

---

## Balance rework cheat sheet

Quick levers when reworking powers (all in `abilities.rs` unless noted):

| Lever | Characters affected |
|-------|---------------------|
| `CHARGE_PASSIVE_PER_SEC` / per-character passive | Everyone except Luca uses 6; Bailey 3.25; Taj idle 9; Luca 1.5 |
| `CHARGE_ON_KILL` / `CHARGE_ON_DAMAGE` | Global; Bailey +`BAILEY_CHARGE_ON_KILL` |
| `add_charge` block during mode | Jacob only |
| Direct damage constants | Bailey nuke, Isaak chi, Taj post, Finn ram, Jacob popcorn |
| Debuff duration/mult | Sonny hack, slows, Jacob mark |
| Range / windup / duration | All abilities |
| FF interaction | Per-ability code paths in `abilities.rs` + `game.rs` |

**Post-playtest levers (marked `// BALANCE TODO:` in `abilities.rs`, not yet changed):**

- Taj: shield HP 110→90, post refund 22→15
- Isaak: base beam 55→50, per-stack 10→12
- Finn: speed bump / hangover shave

**Design notes:**

1. FF-off is unified for ability damage to other humans (2026-05-29 pass).
2. Sonny + Jacob debuffs amplify **all** damage — strong team synergy.
3. Jacob cannot recharge during an 18s mode — still a commitment, but shorter than before.
4. Bailey self-nuke and slow passive create high skill / high risk profile.
5. Taj two-step kit with cheap post (no second charge) + idle charge spike.
6. Luca is intentionally unviable — exclude from FFA balance discussions.

---

## Planned / stubbed

Other friends from the original Python game may return with new kits. When adding them, update this file and `src/content/characters.ts` together.

See [AGENTS.md](../AGENTS.md) for the full planned feature list.
