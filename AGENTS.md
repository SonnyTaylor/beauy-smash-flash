# AGENTS.md

Guidance for AI agents working on Beauy Smash Flash.

## Project Intent

Build a polished LAN-only top-down arena shooter in Tauri. Characters are the user's friends, with face sprites and personality-specific powers. The old Python project is a product/design reference, but do not copy its engine limitations blindly.

**Repository:** https://github.com/SonnyTaylor/beauy-smash-flash

## Architecture Rules

- Keep Rust authoritative for gameplay truth: movement, collision, bullets, damage, scores, deaths, respawns, abilities, and networking.
- Keep React responsible for UI flow: main menu, server select, loadout, lobby, HUD, settings, scoreboard, and game over.
- Keep PixiJS responsible for in-game rendering: arena, players, bullets, walls, particles, ability VFX, camera, fog of war, and screen effects.
- Do not put gameplay simulation in React or Pixi. They render state from Rust and capture player intent.
- Prefer typed protocol changes in `src-tauri/src/protocol.rs` and mirrored TypeScript types in `src/shared/types.ts`.

## Versioning (app vs protocol)

Two version numbers — do not conflate them.

| Kind | Where | Purpose |
|------|-------|---------|
| **App version** | `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` | Installer label, GitHub releases, auto-updater |
| **Protocol version** | `src-tauri/src/protocol.rs` (`PROTOCOL_VERSION`) | LAN multiplayer compatibility |

- Bump **app version** on every release tag (`v1.0.1`, etc.).
- Bump **protocol version** only when wire format or authoritative sim changes. Host and every client **must** match protocol to play.
- Discovery advertises both; join rejects protocol mismatch. Frontend helpers live in `src/shared/compatibility.ts`.
- Rust exposes `get_app_info` via `src-tauri/src/version.rs`.

Full release workflow: `docs/RELEASES.md`.

## Important Files

- `src-tauri/src/game.rs`: authoritative game world, movement, maps, collision, combat, gamemodes.
- `src-tauri/src/abilities.rs`: all six character abilities (charge, windup, world `effects`).
- `src-tauri/src/session.rs`: host/client session loops and UDP message handling.
- `src-tauri/src/commands.rs`: Tauri commands called by the frontend.
- `src-tauri/src/discovery.rs`: LAN broadcast scan; includes app + protocol version in `ServerInfo`.
- `src-tauri/tauri.conf.json`: bundling, NSIS target, updater pubkey/endpoints.
- `src/game/ArenaRenderer.ts`: Pixi arena rendering.
- `src/ui/App.tsx`: thin screen router; session logic in `hooks/useGameSession.ts`.
- `src/ui/main-menu/`, `server-select/`, `loadout/`, `lobby/`, `game/`: one folder per screen flow.
- `src/ui/hooks/useUpdatePrompt.ts`: prompted auto-update on main menu (not silent).
- `src/input/InputController.ts`: keyboard/mouse input snapshots.
- `src/content/characters.ts`: character roster and ability copy.
- `.github/workflows/release.yml`: Windows NSIS build on `v*` tags.

## Commands

Run these before claiming code is healthy:

```powershell
bunx tsc --noEmit
bun run build
cd src-tauri; cargo check; cargo test
```

Development and packaging:

```powershell
bun run tauri dev          # dev shell + Vite
bun run tauri:build        # release .exe + NSIS installer
bun run maps:validate
bun run maps:preview
```

Use `cargo fmt` after Rust edits.

## Git

Only create a commit when the user asks. Use a short message focused on why.

Releases: sync app version in the three files above, tag `vX.Y.Z`, push tag — GitHub Actions publishes the installer and `latest.json` for the updater.

## Coding Guidelines

- Keep modules small and purpose-driven. Avoid returning to one giant frontend or Rust file.
- Preserve LAN-first design. No accounts or cloud gameplay servers. Internet is only used for optional update checks and GitHub releases.
- Prefer simple, inspectable JSON protocol while the game is changing quickly. Optimize to binary later only when schemas stabilize.
- Do not hardcode final UI art direction yet. Basic mockups are fine, but keep the component structure easy to replace.
- Use content files for names, character data, maps, tuning, and UI copy where practical.
- Map authoring lives in `content/maps/*.map.json`. Read `maps/MAPS.md` before creating or editing maps.
- When adding mechanics, add small Rust tests for deterministic rules such as movement, collision, bullet hits, reload timing, and scoring.
- When changing `PROTOCOL_VERSION`, update join/discovery handling and expect all LAN peers to update before playing together.

## Product Notes

- The game should feel fullscreen and modern, not boxed into the old Python resolution.
- Python limits like player count, fixed resolution, and single weapon are not hard requirements.
- The old guide at `C:\Users\Sonny Taylor\Code\local-game\GAME_GUIDE.md` is useful for characters, powers, maps, and vibe.
- **Deathmatch**, **Team Deathmatch**, and **Last Mate Standing** (no respawns) are playable.
- **Fog of war** is client-rendered (`src/game/fog/visibility.ts`, toggled in lobby).
- **Friendly fire off** means no player damage (practice mode), not team FF.

## Planned Features (not yet implemented)

- Cosmetics, bots/zombie mode, more maps and visual map polish
- Dash input (in protocol, not wired to sim)
- Per-weapon SFX variety beyond the shared gunshot sample

## Weapons & VFX

- **Gameplay stats (authoritative):** add entries in `src-tauri/src/weapons/mod.rs` (`REGISTRY`).
- **Visuals (frontend):** PNG in `public/assets/weapons/`, JSON metadata in `src/content/weapons/*.json`, register in `src/content/weapons/index.ts`.
- **Full guide:** `docs/ADDING_WEAPONS.md`
- Glock example: `public/assets/weapons/glock.png`, `src/content/weapons/glock.json`
- Re-process glock asset: `bun run assets:glock` (runs `scripts/process-glock.py`)
- Loadout: primary + secondary slots; **Q** swap, **G** drop active weapon, **F** pick up nearby ground weapon.
- Arena rendering: per-player weapon sprite from registry; ground pickups in `ArenaRenderer.ts`.
- Arena VFX live in `src/game/vfx/VfxManager.ts`

## Distribution & Updates

- Windows ships as an **NSIS installer** (`bun run tauri:build` → `src-tauri/target/release/bundle/nsis/`).
- Updater plugin checks GitHub Releases; user gets **Install update / Not now** on the main menu.
- Updater signing: public key in `tauri.conf.json`; private key in GitHub secret `TAURI_SIGNING_PRIVATE_KEY` (local copy under `%USERPROFILE%\.tauri\` — never commit).
- App icons: `branding/app-icon.png` → `bun run assets:icon`.
