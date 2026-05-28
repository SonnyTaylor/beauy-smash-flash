# AGENTS.md

Guidance for AI agents working on Beauy Smash Flash.

## Project Intent

Build a polished LAN-only top-down arena shooter in Tauri. Characters are the user's friends, with face sprites and personality-specific powers. The old Python project is a product/design reference, but do not copy its engine limitations blindly.

## Architecture Rules

- Keep Rust authoritative for gameplay truth: movement, collision, bullets, damage, scores, deaths, respawns, abilities, and networking.
- Keep React responsible for UI flow: main menu, server select, character select, lobby, HUD, settings, scoreboard, and game over.
- Keep PixiJS responsible for in-game rendering: arena, players, bullets, walls, particles, ability VFX, camera, and screen effects.
- Do not put gameplay simulation in React or Pixi. They render state from Rust and capture player intent.
- Prefer typed protocol changes in `src-tauri/src/protocol.rs` and mirrored TypeScript types in `src/shared/types.ts`.

## Important Files

- `src-tauri/src/game.rs`: authoritative game world, movement, maps, collision, future combat.
- `src-tauri/src/session.rs`: host/client session loops and UDP message handling.
- `src-tauri/src/commands.rs`: Tauri commands called by the frontend.
- `src/game/ArenaRenderer.ts`: Pixi arena rendering.
- `src/ui/App.tsx`: thin screen router; session logic in `hooks/useGameSession.ts`.
- `src/ui/main-menu/`, `server-select/`, `lobby/`, `game/`: one folder per screen flow.
- `src/input/InputController.ts`: keyboard/mouse input snapshots.
- `src/content/characters.ts`: character roster and ability copy.

## Commands

Run these before claiming code is healthy:

```powershell
bunx tsc --noEmit
bun run build
cd src-tauri; cargo check; cargo test
```

Use `cargo fmt` after Rust edits.

## Git

After making code changes, create a git commit unless the user asked for no commit. Use a short message focused on why.

## Coding Guidelines

- Keep modules small and purpose-driven. Avoid returning to one giant frontend or Rust file.
- Preserve LAN-first design. No accounts, cloud servers, or internet dependencies unless explicitly requested.
- Prefer simple, inspectable JSON protocol while the game is changing quickly. Optimize to binary later only when schemas stabilize.
- Do not hardcode final UI art direction yet. Basic mockups are fine, but keep the component structure easy to replace.
- Use content files for names, character data, maps, tuning, and UI copy where practical.
- Map authoring lives in `content/maps/*.map.json`. Read `maps/MAPS.md` before creating or editing maps; run `bun run maps:validate` and `bun run maps:preview`.
- When adding mechanics, add small Rust tests for deterministic rules such as movement, collision, bullet hits, reload timing, and scoring.

## Product Notes

- The game should feel fullscreen and modern, not boxed into the old Python resolution.
- Python limits like player count, fixed resolution, and single weapon are not hard requirements.
- The old guide at `C:\Users\Sonny Taylor\Code\local-game\GAME_GUIDE.md` is useful for characters, powers, maps, and vibe.

## Planned Features (not yet implemented)

- Character abilities (`E` / space wired in input but not simulated in Rust)
- More weapons, game modes (TDM/LMS stubs in UI), fog of war
- Cosmetics, bots/zombie mode, more maps and visual map polish
- Audio (volume slider exists in settings as placeholder)

## Weapons & VFX

- Glock sprite: `public/assets/weapons/glock.png`, metadata in `src/content/weapons/glock.json`
- Re-process asset: `bun run assets:glock` (runs `scripts/process-glock.py`)
- Arena VFX live in `src/game/vfx/VfxManager.ts`; gun orbit in `ArenaRenderer.ts`
