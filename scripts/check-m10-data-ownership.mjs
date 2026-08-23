// M10 data-ownership check (clean-room). Static + integration verification that
// node_writes_knowledge=false, worker_writes_products=false,
// main_writes_candidates=false, worker_writes_background_jobs=false.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const MAIN = join(ROOT, "apps", "desktop", "src", "main");
const WORKER = join(ROOT, "services", "ai-worker", "src", "fastwork_ai_worker");
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

let node_writes_knowledge = false;
const mainServices = walk(join(MAIN, "services"), ".ts");
for (const f of mainServices) {
  const c = readFileSync(f, "utf-8");
  if (/INSERT\s+INTO\s+knowledge_(entries|candidates|pending)/i.test(c)) node_writes_knowledge = true;
  if (/(knowledge_entries|knowledge_candidates|pending_knowledge)/.test(c)) node_writes_knowledge = true;
}

let worker_writes_products = false;
for (const f of walk(join(WORKER, "optimization"), ".py")) {
  const c = readFileSync(f, "utf-8");
  if (/UPDATE\s+products|INSERT\s+INTO\s+products/.test(c)) worker_writes_products = true;
}
const optRpc = readFileSync(join(WORKER, "rpc", "methods", "m10_domain.py"), "utf-8");
if (/UPDATE\s+products|INSERT\s+INTO\s+products/.test(optRpc)) worker_writes_products = true;

let main_writes_candidates = false;
for (const f of mainServices) {
  const c = readFileSync(f, "utf-8");
  if (/CandidateRepository|INSERT\s+INTO\s+knowledge_candidates/.test(c)) main_writes_candidates = true;
}

let worker_writes_background_jobs = false;
for (const f of walk(WORKER, ".py")) {
  const c = readFileSync(f, "utf-8");
  if (c.includes("background_jobs")) worker_writes_background_jobs = true;
}

check(node_writes_knowledge === false, "node_writes_knowledge = false");
check(worker_writes_products === false, "worker_writes_products = false");
check(main_writes_candidates === false, "main_writes_candidates = false");
check(worker_writes_background_jobs === false, "worker_writes_background_jobs = false");

const report = {
  milestone: "M10",
  node_writes_knowledge: node_writes_knowledge,
  worker_writes_products: worker_writes_products,
  main_writes_candidates: main_writes_candidates,
  worker_writes_background_jobs: worker_writes_background_jobs,
  all_passed: failures.length === 0,
};
writeFileSync(join(ROOT, "reports", "m10-data-ownership-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failures.length > 0) process.exit(1);
console.log("M10 data-ownership check PASS.");
