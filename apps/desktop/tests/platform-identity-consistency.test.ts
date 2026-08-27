import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// SHEEP-061/DP-71: desktop-ipc QueuePlatformFilter canonical typed union must stay in
// sync with Main PLATFORM_IDS (no parallel/bare-string taxonomy; Main is the authority).
const HERE = dirname(fileURLToPath(import.meta.url));
const ipcSrc = readFileSync(join(HERE, "..", "..", "..", "packages", "desktop-ipc", "src", "types.ts"), "utf-8");
const mainSrc = readFileSync(join(HERE, "..", "src", "main", "platforms", "platform-host-registry.ts"), "utf-8");

function quotedSet(src, linePattern) {
  const line = src.split("\n").find((l) => l.includes(linePattern)) ?? "";
  return [...line.matchAll(/"([a-z]+)"/g)].map((m) => m[1]).sort();
}

test("QueuePlatformFilter union matches canonical Main PLATFORM_IDS (DP-71)", () => {
  const mainIds = quotedSet(mainSrc, "PLATFORM_IDS");
  const ipcIds = quotedSet(ipcSrc, "QueuePlatformFilter");
  assert.deepEqual(ipcIds, mainIds, "desktop-ipc platform filter union must equal Main PLATFORM_IDS");
  assert.ok(ipcIds.length > 0, "canonical platform set must be non-empty");
});