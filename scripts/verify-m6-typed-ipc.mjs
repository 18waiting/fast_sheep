// M6 typed-IPC verification (clean-room). Verifies every registered channel:
// schema exists, Main handler exists, Preload mapping exists, test coverage exists.
// Also scans for ad-hoc ipcMain.handle/on outside the central registration.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log((cond ? "PASS " : "FAIL ") + msg); };

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|js|mjs)$/.test(e)) out.push(p);
  }
  return out;
}

const channels = [
  { channel: "desktop.bootstrap", kind: "query", schema: "fastwork:desktop:bootstrap-state" },
  { channel: "shops.list", kind: "query", schema: null },
  { channel: "orchestrator.snapshot", kind: "query", schema: "fastwork:desktop:workbench-view-model" },
  { channel: "worker.status", kind: "query", schema: "fastwork:desktop:worker-status" },
  { channel: "orchestrator.set_mode", kind: "command", schema: "fastwork:desktop:set-mode-request" },
  { channel: "orchestrator.manual_send", kind: "command", schema: "fastwork:desktop:manual-send-request" },
  { channel: "orchestrator.no_save_send", kind: "command", schema: "fastwork:desktop:no-save-send-request" },
  { channel: "orchestrator.cancel", kind: "command", schema: "fastwork:desktop:cancel-request" },
  { channel: "orchestrator.focus", kind: "command", schema: "fastwork:desktop:focus-request" },
  { channel: "orchestrator.event", kind: "event", schema: "fastwork:desktop:orchestrator-event" },
  { channel: "worker.status_changed", kind: "event", schema: null },
  { channel: "shops.changed", kind: "event", schema: null },
];

// 1. Schema registry
const registry = JSON.parse(readFileSync(join(ROOT, "packages", "contracts", "schemas", "registry.json"), "utf-8"));
const schemaIds = new Set(registry.schemas.map((s) => s.id));
for (const c of channels) {
  if (c.schema) check(schemaIds.has(c.schema), `schema ${c.schema} registered (${c.channel})`);
}

// 2. Main handlers (central registration + handler modules)
const mainSrc = join(ROOT, "apps", "desktop", "src", "main");
const mainFiles = walk(mainSrc).map((p) => readFileSync(p, "utf-8")).join("\n");
check(existsSync(join(mainSrc, "ipc", "register-ipc.ts")), "register-ipc.ts exists");
const registerSrc = readFileSync(join(mainSrc, "ipc", "register-ipc.ts"), "utf-8");
const channelsSrc = readFileSync(join(ROOT, "packages", "desktop-ipc", "src", "channels.ts"), "utf-8");
const queryHandlerSrc = readFileSync(join(mainSrc, "ipc", "query-handlers.ts"), "utf-8");
const commandHandlerSrc = readFileSync(join(mainSrc, "ipc", "command-handlers.ts"), "utf-8");
check(registerSrc.includes("ipcMain.handle"), "central registration uses ipcMain.handle");
for (const ch of channels) {
  check(channelsSrc.includes(`"${ch.channel}"`), `channel ${ch.channel} in IPC constant`);
  if (ch.kind === "query") check(queryHandlerSrc.includes(ch.channel.split(".").pop()), `Main query handler for ${ch.channel}`);
  if (ch.kind === "command") check(commandHandlerSrc.includes(ch.channel.split(".").pop()), `Main command handler for ${ch.channel}`);
  if (ch.kind === "event") {
    const bridgeFile = {
      "orchestrator.event": "orchestrator-event-bridge.ts",
      "worker.status_changed": "worker-status-event-bridge.ts",
      "shops.changed": "shop-event-bridge.ts",
    }[ch.channel];
    const bridgeSrc = readFileSync(join(mainSrc, "events", bridgeFile), "utf-8");
    const ipcName = {
      "orchestrator.event": "IPC.orchestratorEvent",
      "worker.status_changed": "IPC.workerStatusChanged",
      "shops.changed": "IPC.shopsChanged",
    }[ch.channel];
    check(bridgeSrc.includes(ipcName) || bridgeSrc.includes(ch.channel), `Event bridge for ${ch.channel}`);
  }
}

// 3. Preload mapping
const preloadFiles = walk(join(ROOT, "apps", "desktop", "src", "preload")).map((p) => readFileSync(p, "utf-8")).join("\n");
for (const c of channels) {
  check(preloadFiles.includes(c.channel), `Preload mapping for ${c.channel}`);
}

// 4. Test coverage
const testFiles = [
  ...walk(join(ROOT, "apps", "desktop", "tests")),
  ...walk(join(ROOT, "packages", "desktop-ipc", "tests")),
].map((p) => readFileSync(p, "utf-8")).join("\n");
for (const c of channels) {
  const camel = { "worker.status_changed": "workerStatusChanged", "shops.changed": "shopsChanged", "orchestrator.event": "orchestratorEvent" }[c.channel] ?? c.channel;
  const last = c.channel.split(".").pop();
  check(testFiles.includes(c.channel) || testFiles.includes(camel) || testFiles.includes(last),
    `test coverage for ${c.channel}`);
}

// 5. Ad-hoc handler scan: only register-ipc.ts may call ipcMain.handle/on
const adHoc = [];
for (const f of walk(join(ROOT, "apps", "desktop", "src"))) {
  const rel = f.slice(ROOT.length + 1).replace(/\\/g, "/");
  const content = readFileSync(f, "utf-8");
  if (content.includes("ipcMain.handle") || content.includes("ipcMain.on(")) {
    if (rel !== "apps/desktop/src/main/ipc/register-ipc.ts") adHoc.push(rel);
  }
}
check(adHoc.length === 0, "no ad-hoc ipcMain.handle/on outside central registration" + (adHoc.length ? ": " + adHoc.join(", ") : ""));

if (failures.length > 0) {
  console.error("M6 typed-IPC verification FAILED: " + failures.join("; "));
  process.exit(1);
}
console.log("M6 typed-IPC verification PASS (" + channels.length + " channels).");
