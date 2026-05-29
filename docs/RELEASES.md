# Releases

Beauy Smash Flash ships Windows installers via GitHub Releases.

## Versioning

Two numbers matter:

| Kind | Where | Purpose |
|------|-------|---------|
| **App version** | `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` | Installer label + auto-updater |
| **Protocol version** | `src-tauri/src/protocol.rs` (`PROTOCOL_VERSION`) | LAN multiplayer compatibility |

Bump **app version** for every release. Bump **protocol version** only when wire format or gameplay sync changes — everyone in a lobby must match.

## Cut a release

1. Sync versions in `package.json`, `tauri.conf.json`, and `Cargo.toml`.
2. Commit and tag:
   ```powershell
   git tag v1.0.1
   git push origin v1.0.1
   ```
3. GitHub Actions builds the NSIS installer and publishes `latest.json` for the updater.

First tag build after a dependency change is slow (~8 min); later tags reuse the Rust cache via `shared-key` and usually finish in ~3–4 min. Bumping only the app version still changes `Cargo.lock` slightly, so the shared fallback matters.

For a fast installer without waiting on CI, build locally (`bun run tauri:build`) and upload the NSIS artifact to the GitHub release manually.

## Signing key (one-time)

The updater public key is in `src-tauri/tauri.conf.json`. The private key lives outside the repo.

Set the GitHub secret once:

```powershell
gh secret set TAURI_SIGNING_PRIVATE_KEY < "$env:USERPROFILE\.tauri\beauy-smash-flash.key"
```

**CI release failed with "Resource not accessible by integration"?** The repo’s default `GITHUB_TOKEN` workflow permission must be **Read and write** (not read-only). Fix once:

```powershell
gh api repos/SonnyTaylor/beauy-smash-flash/actions/permissions/workflow -X PUT -f default_workflow_permissions=write
```

Or: repo **Settings → Actions → General → Workflow permissions → Read and write**.

If you regenerate keys, already-installed builds cannot trust updates signed with a new key.

## Local installer build

```powershell
bun install
bun run tauri:build
```

Output: `src-tauri/target/release/bundle/nsis/`

## Auto-updates

On the main menu the game checks GitHub for a newer signed build and **prompts** before downloading. LAN play still works offline; only the update check needs internet.
