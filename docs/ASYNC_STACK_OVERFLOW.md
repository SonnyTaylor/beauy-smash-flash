# Async Stack Overflow in Tauri Commands

**Date:** 2026-06-02
**Symptom:** Joining a LAN game silently killed the client process — no panic, no crash log, no JS error. The Tauri window simply vanished.
**Root cause:** The `join_game` async command's compiled state machine exceeded the IPC thread's ~1 MB stack.

---

## What happened

`join_game` is a `#[tauri::command] async fn` that:
1. Shuts down any existing session
2. Binds a UDP socket
3. Sends a Join message and waits for the host's `Assigned` response
4. Builds a `GameWorld` from the response
5. Syncs a `StateSnapshot` into the world
6. Spawns the `client_loop` task

All of these steps hold large local variables (`ServerMessage::Assigned` containing `WorldConfig` + `MapSnapshot` + `Vec<PlayerSnapshot>`, `GameWorld`, `StateSnapshot` with ~30 fields) across `.await` points.

Rust compiles async functions into state machines that live on the caller's stack. Tauri v1 dispatches IPC commands on a thread with a ~1 MB stack. The compiled state machine for `join_game` was **hundreds of KB** — far exceeding the stack.

The result: Windows hit the guard page, the process died with `STATUS_ACCESS_VIOLATION`, and no Rust panic hook or JS error handler ever fired.

## How we found it

| Experiment | Result |
|---|---|
| `join_game_test` (same signature, tiny body) | ✅ worked |
| `join_game` with early return | ✅ worked |
| `join_game` with full body | ❌ silent crash |
| Renaming to `join_game_real` | ❌ still crashed |
| `Box::pin(join_game_inner(...))` | ✅ **fixed it** |

The early-return version worked because the compiler optimized away all the later locals, making the state machine tiny. The `Box::pin` fix moves the state machine to the heap.

## The fix

```rust
// BEFORE: one big async fn — state machine lives on the IPC thread's stack
#[tauri::command]
pub async fn join_game(...) -> Result<SessionInfo, String> {
    // ~150 lines with StateSnapshot, GameWorld, ServerMessage across awaits
}

// AFTER: thin wrapper + Box::pin'd inner function
#[tauri::command]
pub async fn join_game(...) -> Result<SessionInfo, String> {
    let state_ref = state.inner().clone();
    Box::pin(join_game_inner(ip, player_name, ..., state_ref)).await
}

async fn join_game_inner(...) -> Result<SessionInfo, String> {
    // same ~150 lines, but now heap-allocated
}
```

## Rule of thumb

**If an async Tauri command holds protocol/game types across `.await` points, use `Box::pin`.**

Types to watch for:
- `StateSnapshot` (~30 fields, many `Vec`s)
- `ServerMessage` (enum with `Assigned` variant containing full world)
- `GameWorld` (players, bullets, effects, map)
- `MapSnapshot` / `Vec<RectSnapshot>`

A combined size of **> 4 KB** across awaits is a warning sign. **> 64 KB** will likely overflow.

## Prevention

A regression test in `commands.rs` measures the sizes of these types:

```rust
#[test]
fn future_locals_stay_within_budget() {
    const FUTURE_LOCALS_BUDGET: usize = 256 * 1024;
    let estimated = size_of::<StateSnapshot>()
        + size_of::<ServerMessage>()
        + size_of::<GameWorld>()
        + size_of::<UdpSocket>()
        + 4096;
    assert!(estimated <= FUTURE_LOCALS_BUDGET, "...");
}
```

If you add a new `#[tauri::command] async fn` that holds large types across `.await` points, either:
1. Use `Box::pin(inner_fn(...)).await` to move the state machine off the stack
2. Reduce local variable lifetimes (scope them before the `.await`)
3. Move large temporaries into `Box` on the heap

## Secondary bug: lobby stale timeout

After fixing the crash, we discovered that the joining client was being removed as "stale" by the host within 6 seconds of joining. The `PEER_TIMEOUT` is 6 seconds, and during the lobby the client only sends messages on explicit user actions (SetReady, character change, etc.).

**Fix:** A lobby keepalive timer in `useGameSession.ts` sends empty `Input` messages every 2 seconds. It auto-stops when `MatchStarted` fires (the 60fps input loop takes over).

---

*See also:* `src-tauri/src/commands.rs` (`join_game`, `join_game_inner`, test `future_locals_stay_within_budget`)
