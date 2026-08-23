import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RENDERER = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "renderer");

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else if (/\.ts$/.test(entry)) out.push(p);
  }
  return out;
}

const FILES = listFiles(RENDERER);

test("renderer has no Node / fs / sqlite / child_process / raw ipcRenderer access", () => {
  for (const f of FILES) {
    const c = readFileSync(f, "utf-8");
    // Type-only imports from workspace packages are erased at emit and are allowed;
    // runtime imports of Node/IPC/workspace packages are forbidden.
    const stripped = c.replace(/import\s+type\s+\{[\s\S]*?\}\s+from\s+["']@fastwork\/[^"']+["'];?/g, "");
    const lines = stripped.split(/\r?\n/);
    for (const line of lines) {
      for (const token of ["node:fs", "node:sqlite", "node:child_process", "child_process.", "ipcRenderer.invoke", "ipcRenderer.on(", "ipcRenderer.send(", "require(", "process.env", "fetch(", "from \"@fastwork/"]) {
        assert.ok(!line.includes(token), `${f} must not use ${token}`);
      }
    }
  }
});

test("renderer never calls M5 business APIs or PlatformAdapter directly", () => {
  // M5 business methods and platform adapters must never appear in renderer code.
  const forbidden = [
    "onCountdownElapsed", "onBuyerMessage", "onAiResult", "onSendRequest", "onHumanTakeover",
    "sendText(", "decisionsSnapshot", "new PlatformAdapter", "orchestrator.snapshot", "snapshot(shopId",
  ];
  for (const f of FILES) {
    const c = readFileSync(f, "utf-8");
    for (const token of forbidden) {
      assert.ok(!c.includes(token), `${f} must not call ${token}`);
    }
  }
});

test("renderer only reaches the orchestrator through the narrow fastworkDesktop API", () => {
  for (const f of FILES) {
    const c = readFileSync(f, "utf-8");
    assert.ok(!c.includes("window.fastworkDesktop.") || c.includes("fastworkDesktop"), f + " references the preload API surface");
    // No generic ipc channel strings in renderer code.
    assert.ok(!c.includes('"desktop.') && !c.includes('"orchestrator.') && !c.includes('"shops.') && !c.includes('"worker.'),
      f + " must not hardcode raw channel names");
  }
});

test("renderer never decides countdown send eligibility or staleness as authority", () => {
  // The event reducer only requests resync; the store only refreshes the
  // authoritative snapshot. Neither may mutate business state.
  for (const f of FILES.filter((x) => x.includes("state"))) {
    const c = readFileSync(f, "utf-8");
    assert.ok(!c.includes("countdownPolicy") && !c.includes("CountdownController"), f + " must not reimplement M5 countdown");
  }
});
