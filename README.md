# Beauy Smash Flash

Beauy Smash Flash is a Tauri rewrite of a LAN-only top-down arena shooter about friends from Beaumaris Secondary College. The current build is an early foundation: LAN host/join, authoritative Rust movement simulation, PixiJS arena rendering, React mock UI screens, character metadata, and basic map wall collision.

## Stack

- Tauri 2 + Rust/Tokio for desktop shell, LAN UDP networking, and host-authoritative simulation.
- React + TypeScript for menus, lobby mockups, HUD, and future UI.
- PixiJS 8 for the in-game arena, entities, maps, and effects.
- Bun + Vite for frontend development.

## Development

```powershell
bun install
bun run tauri dev
```

Useful checks:

```powershell
bunx tsc --noEmit
bun run build
cd src-tauri; cargo check; cargo test
```

## Current Roadmap

1. Real LAN discovery and lobby state.
2. Map selection and more arenas.
3. Glock combat: aim, bullets, reloads, damage, knockback, deaths.
4. Character heads, abilities, audio, and polished UI.

The original Python version and game guide live in `C:\Users\Sonny Taylor\Code\local-game` and should be treated as reference material, not a strict technical limit.

## Releases & updates

Windows installers are built with `bun run tauri:build`. Tagged pushes to GitHub publish signed releases and feed the in-app update prompt. See [docs/RELEASES.md](docs/RELEASES.md).

Repository: https://github.com/SonnyTaylor/beauy-smash-flash
