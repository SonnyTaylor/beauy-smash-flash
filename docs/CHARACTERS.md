# Character Roster

Reference for all playable characters, their abilities, and current balance numbers. Gameplay constants live in `src-tauri/src/abilities.rs` unless noted.

For how to add or tune characters, see [ADDING_CHARACTERS.md](./ADDING_CHARACTERS.md).

---

## Shared rules

All characters share:

| Stat | Value | Source |
|------|-------|--------|
| Max HP | 100 | `game.rs` (`PLAYER_MAX_HP`) |
| Move speed | 360 px/s | `game.rs` (`PLAYER_SPEED`) |
| Default weapon | Glock (25 dmg, 0.18s fire rate) | `weapons/mod.rs` |
| Ability key | **E** (press, not hold) | Input → `try_activate()` |
| Charge max | 100 | `ABILITY_CHARGE_MAX` |

### Global charge economy

| Source | Amount | Notes |
|--------|--------|-------|
| Passive refill | +6 / sec | Default; ~16.7s to full from empty |
| Kill | +25 | All characters |
| Damage dealt | +4 | Per damage application |
| Dev mode | Instant refill (except Isaak) | Isaak uses normal rates so stillness is testable |

---

## At a glance

| Character | Power | Role | Charge style | Primary payoff |
|-----------|-------|------|--------------|----------------|
| Sonny | Reverse Shell | Disruption | Standard | 4s inverted controls on nearest enemy |
| Bailey | Truth Nuke | Burst AoE | Slow passive | 60 dmg blast, aim windup |
| Jacob | Director's Cut | Tempo / mark | Standard | 30s speed mode + 15 popcorn shots |
| Isaak | Chi Blast | Skillshot | Standard + stillness | 75 dmg beam, optional slow |
| Taj | Story Shield | Defense / poke | Faster when idle | Block front arc, post for dmg + slow |
| Finn | Cheeky Dinghy | Initiation | Standard | 4s speedboat ram, no shooting |

---

## Sonny — Reverse Shell

**Personality:** Hacker chaos — punish the closest target's inputs, not their HP.

### Ability: Reverse Shell

| Stat | Value |
|------|-------|
| Range | 280 px |
| Duration | 4.0s |
| Targeting | Nearest living enemy in range |
| Effect | Movement **and** aim inputs inverted |
| Damage | None |

### Passive / charge

| Stat | Value |
|------|-------|
| Passive charge | 6 / sec (default) |
| Miss refund | 50 charge (~50%) if no valid target |

### Balance notes

- Reliable in close fights; weak at long range or when alone.
- Refund prevents full feel-bad whiffs — still costs time versus a hit.
- Strong follow-up window while victim reads inverted aim.
- **Counterplay:** Break line of sight, stay outside 280px, bait on cooldown.

---

## Bailey — Truth Nuke

**Personality:** Confrontational AoE — telegraphed truth bomb with slow recharge.

### Ability: Truth Nuke

| Stat | Value |
|------|-------|
| Aim windup | 1.25s (reticle tracks aim during windup) |
| Projectile flight | 0.9s |
| Range | 350 px |
| Blast radius | 150 px |
| Max damage | 60 (center) |
| Min falloff | 35% at edge (`BAILEY_NUKE_MIN_FALLOFF`) |
| Arc height | 140 px (visual lob) |

Explosion damages enemies even when friendly fire is off (intentional nuke behavior). Large truth explosion VFX is visible to all players (screen flash feel is mostly visual/audio, not a gameplay stun).

### Passive / charge

| Stat | Value |
|------|-------|
| Passive charge | **3.25 / sec** (~30.8s to full) |
| Kill bonus | **+15 extra** (+40 total on kill) |

Slowest baseline recharge — pays for reliable teamfight burst.

### Balance notes

- ~0.6 kills worth of damage at center on 100 HP targets.
- Windup + flight = ~2.15s telegraph — dodgeable with movement.
- Kill bonus helps snowball but passive is deliberately slower than the roster average.
- **Counterplay:** Scatter before detonation, use walls, punish long windup.

---

## Jacob — Director's Cut

**Personality:** Movie mode — faster movement and bouncing popcorn that marks targets.

### Ability: Director's Cut

| Stat | Value |
|------|-------|
| Mode duration | 30.0s |
| Speed multiplier | 1.67× (601 px/s) |
| Popcorn shots | 15 |
| Popcorn damage | 14 per hit |
| Popcorn fire rate | 0.11s between shots |
| Popcorn speed | 684 px/s |
| Popcorn bounces | 12 |
| Popcorn spread | 20° initial, 50° on bounce |
| Mark duration | 3.0s |
| Mark damage mult | 1.4× from other sources |

During Director's Cut, normal gun fire is replaced by popcorn (`try_fire_popcorn`). Mode ends when shots reach 0 or duration expires.

### Passive / charge

| Stat | Value |
|------|-------|
| Passive charge | 6 / sec (default) |

One charge buys a long window — effective cooldown is mostly the 30s mode plus recharge time.

### Balance notes

- Total popcorn damage potential is high but spread over time and bounces — not a single burst.
- Mark multiplies team focus fire; strong in FFA clusters.
- Speed helps reposition between popcorn waves.
- **Counterplay:** Space out during mode, don't eat repeated bounces in corridors, kill before 15 shots expire.

---

## Isaak — Chi Blast

**Personality:** Stillness and precision — stand still to power up a piercing beam.

### Ability: Chi Blast

| Stat | Value |
|------|-------|
| Channel windup | 1.4s (cannot move during channel — movement blocked while `ability_windup > 0`) |
| Beam damage | 75 |
| Beam range | 900 px |
| Beam half-width | 14 px |
| Wall pierce | 1 wall, then stops |

### Passive: Stillness

| Stat | Value |
|------|-------|
| Stack interval | 1.5s standing still |
| Max stacks | 3 |
| Reset | Moving, channeling, or boat mode clears timer |
| 3-stack bonus | 1.0s slow at 0.65× speed on beam hit |

Stillness stacks reset after firing the beam.

### Passive / charge

| Stat | Value |
|------|-------|
| Passive charge | 6 / sec (default) |

### Balance notes

- 75 dmg ≈ three glock shots — fair for a channel + positioning requirement.
- Stillness rewards map control and patience; stacks telegraph power to enemies.
- One wall pierce enables clever angles without full map beam.
- **Counterplay:** Peek during 1.4s channel, flank, force movement to drop stacks.

---

## Taj — Story Shield

**Personality:** Phone/reel energy — deploy a blocking video shield, then post it forward.

*(Internal `abilityId` is still `doomscroll`; gameplay is Story Shield.)*

### Ability: Story Shield

**First E (full charge):** Deploy reel shield in front of aim direction.

| Stat | Value |
|------|-------|
| Duration | 5.5s |
| Shield HP | 110 |
| Block arc | Front-facing (~116 px wide, shallow depth) |
| Rotates | Yes — follows aim while active |
| Reel assets | 5 MP4s cycle (`public/assets/reels/reel-0.mp4` … `reel-4.mp4`) |

**Second E (while shield up):** Post shield forward (no extra charge).

| Stat | Value |
|------|-------|
| Travel range | 240 px |
| Impact damage | 32 |
| Knockback | 280 px impulse |
| Slow | 1.25s at 0.72× speed |

Shield absorbs bullet damage from HP until broken or expired.

### Passive / charge

| Stat | Value |
|------|-------|
| Passive charge (default) | 6 / sec |
| Passive charge (idle) | **9 / sec** if no shot for **0.5s** |

Rewards disengaging from gunfights to prep another shield.

### Balance notes

- Buffed from early 3s / 80 HP — current 5.5s / 110 HP makes the shield a real defensive tool.
- Post is optional skill expression: keep blocking vs convert to poke.
- ~1 glock mag of focused fire to break shield HP.
- **Counterplay:** Flank, wait out duration, break HP before post, bait post then dodge travel line.

---

## Finn — Cheeky Dinghy

**Personality:** Speedboat ram — commit to movement, skip shooting.

### Ability: Cheeky Dinghy

| Stat | Value |
|------|-------|
| Boat duration | 4.0s |
| Speed multiplier | 1.8× (648 px/s) |
| Ram damage | 35 per enemy |
| Ram knockback | 320 px impulse |
| Hits per enemy | Once per boat activation |
| Shooting | **Disabled** during boat |
| Hangover after | 0.8s at 0.5× speed (180 px/s) |

Friendly fire must be on for ram damage to apply (same as other direct ability hits).

### Passive / charge

| Stat | Value |
|------|-------|
| Passive charge | 6 / sec (default) |

### Balance notes

- Trade gun DPS for gap-close and single-target burst.
- Hangover is punishable if you miss the ram or overshoot.
- Strong in open maps; weaker in tight spaces with walls.
- **Counterplay:** Sidestep ram vector, focus during hangover, use walls to block approach.

---

## Power comparison (damage)

Approximate direct damage from a full charge at ideal execution:

| Character | Typical damage | Notes |
|-----------|----------------|-------|
| Sonny | 0 | Control only |
| Bailey | 21–60 | Radius + falloff |
| Jacob | Up to ~210 | 15 × 14 if all popcorn hit (rare) |
| Isaak | 75 | Single target beam |
| Taj (post) | 32 | Optional follow-up after block |
| Finn (ram) | 35 | Single enemy per boat |

Gun damage still matters — abilities are fight swingers, not guaranteed kills.

---

## Charge time comparison

Time to full charge from **empty**, passive only (no combat):

| Character | Rate (/ sec) | Time to 100 |
|-----------|--------------|-------------|
| Most | 6.0 | ~16.7s |
| Bailey | 3.25 | ~30.8s |
| Taj (idle, no shots 0.5s+) | 9.0 | ~11.1s |

Combat adds +4 per damage event and +25 (+40 Bailey) per kill, so real times vary.

---

## Status effect reference

| Effect | Used by | Field / mechanism |
|--------|---------|-------------------|
| Controls inverted | Sonny | `controls_inverted_until` |
| Slow | Isaak (3 stacks), Taj post | `slowed_until`, `slow_multiplier` |
| Mark (+40% damage taken) | Jacob popcorn | `marked_until`, `mark_damage_multiplier` |
| Director's Cut mode | Jacob | `directors_cut_until`, `directors_cut_shots` |
| Reel shield | Taj | `reel_shield_remaining`, `reel_shield_hp` |
| Boat / hangover | Finn | `boat_mode_until`, `hangover_until` |
| Stillness stacks | Isaak | `stillness_stacks` |

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
| Finn | `heads/finn.png` | Boat splash VFX |

---

## Planned / stubbed

Other friends from the original Python game may return with new kits. When adding them, update this file and `src/content/characters.ts` together.

See [AGENTS.md](../AGENTS.md) for the full planned feature list.
