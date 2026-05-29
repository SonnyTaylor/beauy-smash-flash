#!/usr/bin/env bun
/**
 * Local Tauri build wrapper that skips updater signing so the build
 * completes without needing TAURI_SIGNING_PRIVATE_KEY locally.
 *
 * GitHub Actions releases still sign automatically via the
 * TAURI_SIGNING_PRIVATE_KEY secret — this is just for quick local
 * installer testing.
 */
import { spawnSync } from "node:child_process";

const result = spawnSync(
  "bunx",
  [
    "tauri",
    "build",
    "-c",
    JSON.stringify({ bundle: { createUpdaterArtifacts: false } }),
  ],
  {
    stdio: "inherit",
    shell: false,
  }
);

process.exit(result.status ?? 1);
