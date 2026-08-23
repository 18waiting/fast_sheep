// M11 import ownership check (clean-room). Main writes only Main-owned aggregates;
// the Worker writes only knowledge/candidates. Node knowledge writes = 0.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log((c ? "PASS " : "FAIL ") + m); };
function walk(dir, ext, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (e.endsWith(ext)) out.push(p);
  }
  return out;
}

// Main writes knowledge? scan the legacy-import Main writer + desktop services.
let mainWritesKnowledge = false;
const mainWriter = readFileSync(join(ROOT, "packages", "legacy-import", "src", "adapters", "persistence-main-import-writer.ts"), "utf-8");
if (/INSERT\s+INTO\s+knowledge_(entries|candidates)/i.test(mainWriter)) mainWritesKnowledge = true;
if (/knowledge_entries|knowledge_candidates/.test(mainWriter)) mainWritesKnowledge = true;
const desktopServices = walk(join(ROOT, "apps", "desktop", "src", "main", "services"), ".ts");
for (const f of desktopServices) {
  if (/INSERT\s+INTO\s+knowledge_(entries|candidates)/i.test(readFileSync(f, "utf-8"))) mainWritesKnowledge = true;
}

// Worker writes Main-owned aggregates? scan the worker legacy_import package + RPC.
let workerWritesMain = false;
for (const f of walk(join(ROOT, "services", "ai-worker", "src", "fastwork_ai_worker", "legacy_import"), ".py")) {
  const c = readFileSync(f, "utf-8");
  if (/INSERT\s+INTO\s+(shops|products|config_groups|prompt_profiles|transfer_rules|forbidden_words|background_jobs|conversations)/i.test(c)) workerWritesMain = true;
}

check(mainWritesKnowledge === false, "main_writes_knowledge = false");
check(workerWritesMain === false, "worker_writes_main_aggregates = false");

const report = { milestone: "M11", main_writes_knowledge: mainWritesKnowledge, worker_writes_main_aggregates: workerWritesMain, all_passed: failures.length === 0 };
writeFileSync(join(ROOT, "reports", "m11-import-ownership-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failures.length > 0) process.exit(1);
console.log("M11 import ownership check PASS.");
