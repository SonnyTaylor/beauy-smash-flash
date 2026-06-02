# Multiplayer Join Crash — Handoff V2

Session: pi (model: MiMo-v2.5-pro, date 2026-06-02)
Repo: `C:\Users\Sonny Taylor\Code\tauri-game` (https://github.com/SonnyTaylor/beauy-smash-flash)
Branch: `master` at `e727482` (Revert "Additional networking polish"), working tree has uncommitted debug changes.

---

## TL;DR

Clicking "Join" on another player's LAN game causes the **joining client** to crash silently — the window disappears with zero output from Rust or JS. The crash is **not** a networking bug, not a flate2 compression bug, and not a type mismatch. The Tauri IPC bridge delivers the `invoke('join_game', ...)` call but the Rust function body **never executes its first line**. A test command (`join_game_test`) with the **exact same signature** works perfectly. Renaming the function to `join_game_real` is the current test in progress.

---

## What we know for certain

### The crash is inside the `join_game` Rust function — but the first line never runs

Every test confirms this pattern:

```
[ui] invoking join_game ip=10.14.182.63:5555
[debug] ping received                          ← IPC alive
[ui] ping result: pong                         ← IPC round-trip works
[ui] TauriGameClient.join called, invoking join_game...
                                                 ← invoke issued
                                                 ← NOTHING from Rust
                                                 ← NO [crash] from JS
                                                 ← NO error message
                                                 ← process dies
```

The Rust `join_game` function's **very first statement** is:
```rust
crate::game_log::info("join", &format!("starting join to {ip}"));
```

This line never appears. Per-line durable logging (open+append+close each write) means a missing line = the code genuinely never reached it.

### IPC is healthy — `ping` and `join_game_test` both work

- `ping` (sync, no state): ✅ round-trips instantly
- `join_game_test` (async, same signature as `join_game`, takes `Window` + `State<SharedState>`, just logs + returns): ✅ called and returns
- `join_game` (async, same signature, real body): ❌ never entered

### The no-op `join_game` (early return) works — client joins lobby

When `join_game` was temporarily replaced with a no-op that just logs and returns `state.session_info()`, the client **successfully entered the lobby**. This proves:
- The frontend flow (invoke → setScreen → lobby) works
- The issue is specifically in the `join_game` function body's interaction with the Tauri runtime

### Both exes run on the same machine

User runs two `beauy-smash-flash.exe` instances from Windows Explorer. Both share:
- `%LOCALAPPDATA%\beauy-smash-flash\logs\game.log` (distinguished by `pid=` prefix)
- WebView2 user data folder (`%LOCALAPPDATA%\beauy-smash-flash\webview-data`)
- Same Tauri identifier: `com.beauy.smashflash`

### Git bisect result was misleading

`git bisect` pointed to commit `593a864` ("Additional networking polish") as the first bad commit. Reverting it **did not fix the crash**. The bisect tested:
- `ff8bea6` (app icon) → good
- `4c266fe` (IP validation) → good
- `593a864` (networking polish) → bad
- `91908ca` (fix networking) → good

But reverting `593a864` on master still crashes. Possible explanations:
1. The crash is non-deterministic (race condition, timing-dependent)
2. The crash predates `593a864` and the bisect "good" results were false negatives
3. The crash was introduced by a different mechanism that coincidentally appeared at `593a864`

---

## What we tested / ruled out

| Hypothesis | Tested | Result |
|---|---|---|
| flate2 UDP compression (added in `593a864`) | Removed entirely from Cargo.toml + net.rs | ❌ Still crashes |
| Full revert of `593a864` | `git revert 593a864` | ❌ Still crashes |
| Type mismatch (TS vs Rust serde) | `bunx tsc --noEmit` clean, round-trip tests pass | ❌ Not the cause |
| JS crash (unhandled error/rejection) | Global `window.error` + `unhandledrejection` handlers | ❌ No [crash] logged |
| React render crash | `CrashBoundary` wrapping `<App />` | ❌ No [crash] logged |
| Rust panic | Panic hook installed in `game_log::init()` | ❌ No [panic] logged |
| IPC deserialization failure | `join_game_test` with identical signature works | ❌ Not the cause |
| Command name collision (`join_game_test` vs `join_game`) | Removed `join_game_test` | ❌ Still crashes |
| Function name `join_game` specifically | Renamed to `join_game_real` | **⏳ Test in progress** |
| Windows Firewall | `wait_for_assignment` has 8s timeout, returns error | ❌ Would show error, not crash |
| WebView2 data folder conflict | Same machine, same identifier | Possible but unconfirmed |
| Tokio runtime deadlock | `join_game` never enters, can't deadlock | ❌ Not the cause |

---

## Current test in progress

The function was renamed from `join_game` to `join_game_real` in:
- `src-tauri/src/commands.rs` (function name)
- `src-tauri/src/main.rs` (handler registration)
- `src/net/TauriGameClient.ts` (invoke call)

**If this fixes it**: there's something about the name `join_game` that Tauri's command router dislikes — possibly a conflict with an internal Tauri command or a WebView2 built-in.

**If this doesn't fix it**: the issue is in the function body's interaction with the Tauri async runtime when called via IPC (but not when called as a unit test or via `join_game_test`).

---

## Instrumentation added this session

1. **`src/app/crashLog.ts`** — global `window.error` + `unhandledrejection` → durable Rust log under `[crash]`
2. **`src/app/CrashBoundary.tsx`** — React error boundary around `<App />`; logs `[crash] react render: ...` with component stack
3. **`src-tauri/src/game_log.rs`** — PID prefix on every line (`pid=NNNNN`); panic hook logs `[panic]` with file:line:col
4. **`src/ui/hooks/useGameSession.ts`** — `invoking join_game ip=...` and `join_game invoke resolved` breadcrumbs
5. **`src/net/TauriGameClient.ts`** — `TauriGameClient.join called` breadcrumb inside the `join()` method
6. **`src-tauri/src/commands.rs`** — `ping` command for IPC liveness check; step-by-step logging in `join_game` (steps 1–7)
7. **`src-tauri/src/net.rs`** — 17 unit tests for encode/decode round-trips + garbage/empty error handling

---

## Key files

- `src-tauri/src/commands.rs:274` — `join_game` (now `join_game_real`)
- `src-tauri/src/commands.rs:188` — `ping` (IPC liveness check)
- `src-tauri/src/session.rs:82` — `shutdown_session`
- `src-tauri/src/session.rs:688` — `client_loop`
- `src-tauri/src/session.rs:303` — `handle_host_message` (host receives Join)
- `src-tauri/src/net.rs` — encode/decode functions + 17 tests
- `src/net/TauriGameClient.ts:55` — `join()` method
- `src/ui/hooks/useGameSession.ts:347` — `createLobbySession`
- `src-tauri/src/game_log.rs` — logging + panic hook + PID
- `src/app/crashLog.ts` — JS crash capture
- `src/app/CrashBoundary.tsx` — React error boundary

---

## Next steps (in priority order)

1. **Check the result of the `join_game_real` rename test.** If it works, investigate Tauri command naming conflicts. If it doesn't, move to step 2.

2. **Make `join_game` sync instead of async.** The test command `ping` (sync) works. `join_game_test` (async) also works. But try making the real function `fn` instead of `async fn` to rule out any async runtime issue specific to the function body.

3. **Binary-search the function body.** Comment out everything after `shutdown_session` and add it back line by line. The function is ~130 lines; a manual binary search (half the body, test, repeat) would find the offending line in ~7 steps.

4. **Check if the crash is reproducible with `tauri dev` instead of release exe.** Dev mode uses a different WebView2 backend and shows DevTools console — might reveal errors hidden in release mode.

5. **Try running only ONE instance** (just host, no join). If the host works fine, the issue is specific to the second instance's `join_game` path.

6. **Check for WebView2 user data folder conflicts.** Both instances share `%LOCALAPPDATA%\beauy-smash-flash\webview-data`. Try setting a different `WEBVIEW2_USER_DATA_FOLDER` env var for the second instance.

7. **Write a Rust integration test** that calls `join_game` directly (bypassing Tauri IPC) to see if the function body works in isolation. If it does, the issue is Tauri-specific.

---

## Build commands

```powershell
bunx tsc --noEmit          # TypeScript check
bun run build              # Frontend bundle
cd src-tauri; cargo fmt    # Format Rust
cd src-tauri; cargo test   # Run 87 tests (70 existing + 17 net)
cd src-tauri; cargo build --release  # Release exe (includes frontend)
bun run test-mp            # Build + launch 2 instances
```

---

## Build status

- `bunx tsc --noEmit`: ✅ clean
- `bun run build`: ✅ clean
- `cargo test`: ✅ 87 passed
- `cargo fmt`: ✅ applied
- `cargo build --release`: ✅ built
- Release exe: `src-tauri/target/release/beauy-smash-flash.exe`

---

*End of handoff.*
