# Map Authoring Guide

Maps live in `content/maps/*.map.json`. Rust and the frontend both load the same files.

## Quick workflow for agents

1. Edit layout code in `scripts/generate-maps.ts` **or** hand-edit a `.map.json` grid.
2. Run `bun run maps:generate` when using the generator (validates while writing).
3. Run `bun run maps:validate` — fix all errors before committing.
4. Run `bun run maps:preview split` — open `content/maps/previews/split.svg` to eyeball layout.
5. Wire is automatic: lobby `map_id` loads the file at match start.

## Coordinate space

| Constant | Value |
|----------|-------|
| Logical world | 1280 × 720 |
| Grid | 32 cols × 18 rows |
| Cell size | 40 px |
| Runtime scale | 1.5× → 1920 × 1080 |
| Player radius | 24 px (scaled at runtime) |

Author in **1280×720 grid cells**. Do not hand-scale to 1920.

## Grid format (preferred)

```json
{
  "id": "my-map",
  "name": "My Map",
  "tags": ["symmetric", "medium"],
  "theme": {
    "floor": "#0a0c16",
    "grid": "#1a2038",
    "walls": "#1c1f32",
    "wallStroke": "#4a5278",
    "accent": "#46e9ff"
  },
  "grid": {
    "cols": 32,
    "rows": 18,
    "cell": 40,
    "solid": [
      "################################",
      "#1........####....####........2#",
      "################################"
    ],
    "spawn": [
      "................................",
      ".1..............................2.",
      "................................"
    ]
  }
}
```

### Layer characters

| Layer | Chars | Meaning |
|-------|-------|---------|
| `solid` | `#` or `█` | Wall |
| `solid` | `.` or anything else | Floor |
| `spawn` | `1`–`9` | Spawn point (cell center) |

Keep spawn digits in the **spawn layer only**. The solid layer should use `#` and `.` only.

## Raw rects (advanced)

Skip `grid` and provide `walls` + `spawns` directly in logical 1280×720 coordinates:

```json
{
  "id": "custom",
  "name": "Custom",
  "walls": [{ "id": "border-top", "x": 0, "y": 0, "w": 1280, "h": 40 }],
  "spawns": [[120, 120], [1160, 120]]
}
```

## Validation rules

`bun run maps:validate` checks:

- Grid dimensions (32×18, cell 40)
- At least 2 spawns
- No spawn inside walls or too close to world edge
- Flood-fill reachability between spawns
- Warns if spawns are closer than 160 px

## Design checklist (what makes a map feel good)

- **Border ring**: full `#` perimeter so players cannot leave the arena.
- **Symmetry**: horizontal mirror for deathmatch fairness.
- **6 spawns**: spread across quadrants; avoid point-blank LOS at round start.
- **Lane count**: 2–3 real routes, not one choke funnel.
- **Cover rhythm**: pocket → lane → pocket every ~3–4 seconds of movement at 360 px/s.
- **Center payoff**: something worth fighting over (open sightline, power position, or cut-through).
- **Corridor width**: at least 3 floor cells (120 px) for comfortable fights.

## Recipes

| Pattern | How |
|---------|-----|
| Corner anchors | 160×120 `#` blocks in each quadrant |
| Center pillar | 4×4 cell `#` block at (14,7)–(17,10) |
| Side lanes | Leave columns 0–4 and 27–31 open vertically |
| Split map | `#` divider cols 14–17 with 2–3 door gaps |
| Ring run | `#` hollow rectangle inset 2 cells from border |

## Commands

```powershell
bun run maps:generate         # rebuild JSON from scripts/generate-maps.ts
bun run maps:validate          # CI-friendly, exits 1 on errors
bun run maps:preview           # all maps → content/maps/previews/*.svg
bun run maps:preview split     # one map
bun run maps:list              # summary table
```

## Current roster

| id | name | vibe |
|----|------|------|
| `split` | Split | Two halves, dual mid bridges — default |
| `midline` | Midline | Center pillar control, side flanks |
| `rings` | Rings | Perimeter rotation, inner cross |
| `fork` | Fork | Three-way mid hub, ambush angles |

Default lobby map: **`split`**.
