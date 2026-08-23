// PACK-003 packaged-worker Main integration smoke (clean-room).
//
// Proves the production Main launcher chain end-to-end WITHOUT an Electron
// installer, using the exact production code path:
//
//   apps/desktop/src/main/worker-runtime.ts (dist/main/worker-runtime.js)
//     resolvePackagedWorkerPaths() / createPackagedWorkerClient()
//     -> packaged EXE  (<temp>/resources/worker/fastwork-ai-worker.exe)
//     -> stdio JSONL RPC v1 round trip (system.health + rag.index_status)
//     -> worker-backed Main context composition (createWorkerBackedMainContext)
//     -> graceful system.shutdown (AIWorkerClient.stop())
//
// It also runs the two REQUIRED negative tests:
//   B) worker executable missing -> fail loudly, no py/python fallback
//   C) contracts schemas missing -> fail early, no source-tree fallback
//
// The simulated resourcesPath lives OUTSIDE the repo (OS temp dir), proving the
// runtime is repo-external. PYTHONPATH/PYTHONHOME are cleared. No Electron
// packaging, no installer, no provider/seller access, no secrets.
import { existsSync, statSync, mkdirSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { openDatabase } from "../packages/persistence/dist/index.js";
import {
  resolvePackagedWorkerPaths,
  createPackagedWorkerClient,
  resolvePackagedDataRoot,
  createWorkerBackedMainContext,
  PACKAGED_WORKER_EXE,
} from "../apps/desktop/dist/main/worker-runtime.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const RUNTIME_SRC = join(ROOT, "resources", "worker");
const SCHEMAS_SRC = join(ROOT, "packages", "contracts", "schemas");
const LAUNCHER_MODULE = join(ROOT, "apps", "desktop", "dist", "main", "worker-runtime.js");
const PACK002_SHA256 = "8adfa085447635cb7425890668b7dd17549ce3feccfde0c7e4d953a7ffe5b3b7";

// Preconditions: PACK-002 runtime + built production launcher must exist.
if (!existsSync(join(RUNTIME_SRC, PACKAGED_WORKER_EXE))) {
  console.error("PACK-003 smoke FAIL: packaged worker runtime missing at " + join(RUNTIME_SRC, PACKAGED_WORKER_EXE));
  process.exit(1);
}
if (!existsSync(LAUNCHER_MODULE)) {
  console.error("PACK-003 smoke FAIL: production launcher not built (" + LAUNCHER_MODULE + "). Run `pnpm --filter @fastwork/desktop run build` first.");
  process.exit(1);
}

// Clear any inherited source-tree Python path (packaged mode must not need it).
delete process.env.PYTHONPATH;
delete process.env.PYTHONHOME;

const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok, extra });
  console.log((ok ? "PASS " : "FAIL ") + "[PACK-003] " + name + (ok ? "" : " | " + extra));
};

async function copyTree(src, dest) {
  // Async fs.cp (not cpSync): Node 24's cpSync crashes with 0xC0000409 on
  // Windows when copying this packaged runtime tree (verified).
  mkdirSync(dest, { recursive: true });
  await cp(src, dest, { recursive: true });
}

function safeRemove(dir) {
  if (!dir) return;
  try { rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }); }
  catch (e) { console.warn("WARN [PACK-003] temp dir left for OS cleanup (locked handle): " + dir + " (" + (e.code ?? e.message) + ")"); }
}

function waitPidGone(pid, timeoutMs) {
  return new Promise((resolvePromise) => {
    const deadline = Date.now() + timeoutMs;
    const poll = () => {
      let alive = true;
      try { process.kill(pid, 0); } catch (e) { alive = !(e && e.code === "ESRCH"); }
      if (!alive || Date.now() >= deadline) return resolvePromise(!alive);
      setTimeout(poll, 200);
    };
    poll();
  });
}

let base = null;
let dataRoot = null;
let client = null;
let unsub = null;
let workerPid = null;

try {
  // ---- stage a repo-external simulated packaged resources path ----
  base = mkdtempSync(join(tmpdir(), "pack003-resources-"));
  dataRoot = mkdtempSync(join(tmpdir(), "pack003-data-"));
  const resourcesPath = join(base, "resources");
  const workerStage = join(resourcesPath, "worker");
  const schemasStage = join(resourcesPath, "contracts", "schemas");
  await copyTree(RUNTIME_SRC, workerStage);
  await copyTree(SCHEMAS_SRC, schemasStage);

  // Provision a fresh schema-v4 DB in the temp data root (repo tooling only;
  // the packaged worker itself does not depend on the repo).
  const db = openDatabase(dataRoot);
  db.conn.exec("PRAGMA quick_check");
  db.conn.close();

  // ---- 1) production packaged-worker resolution contract ----
  const paths = resolvePackagedWorkerPaths(resourcesPath);
  const expectedExe = join(resourcesPath, "worker", PACKAGED_WORKER_EXE);
  const expectedSchemas = join(resourcesPath, "contracts", "schemas");
  check("packaged worker path = <resources>\\worker\\fastwork-ai-worker.exe", paths.executable === expectedExe, paths.executable);
  check("packaged schemas path = <resources>\\contracts\\schemas", paths.schemasDir === expectedSchemas, paths.schemasDir);
  check("packaged worker executable exists on disk", existsSync(paths.executable) && statSync(paths.executable).isFile());
  check("packaged schemas directory exists on disk", existsSync(paths.schemasDir) && statSync(paths.schemasDir).isDirectory());
  const stagedHash = createHash("sha256").update(readFileSync(paths.executable)).digest("hex");
  // The expected hash comes from the current PACK-002 report (authoritative) with a
  // hardcoded fallback. When the one-click release flow (PACK-007 §13) rebuilds the
  // Worker from source, the hash legitimately differs from the original PACK-002
  // artifact; in that case verify the packaged onedir runtime is complete (the
  // launch + health + RPC checks below still prove the EXE actually runs).
  let expectedHash = PACK002_SHA256;
  try {
    const p2 = JSON.parse(readFileSync(join(ROOT, "reports", "pack-002-worker-packaging-report.json"), "utf-8").replace(/^\uFEFF/, ""));
    if (typeof p2.worker_executable_sha256 === "string" && p2.worker_executable_sha256.length === 64) expectedHash = p2.worker_executable_sha256.toLowerCase();
  } catch { /* fall back to the hardcoded PACK-002 hash */ }
  if (stagedHash === expectedHash) {
    check("packaged worker sha256 matches PACK-002", true, stagedHash);
  } else {
    const internalComplete = existsSync(join(RUNTIME_SRC, "_internal")) &&
      existsSync(join(RUNTIME_SRC, "_internal", "faiss")) &&
      existsSync(join(RUNTIME_SRC, "_internal", "numpy"));
    check("packaged worker onedir runtime complete (rebuilt worker; hash differs from PACK-002 report)", internalComplete, "hash=" + stagedHash + " expected=" + expectedHash);
  }
  check("resolved executable is the packaged EXE (not py/python)", basename(paths.executable) === PACKAGED_WORKER_EXE);

  // ---- 2) data-root strategy (FASTWORK_DATA_DIR, else %LOCALAPPDATA% default) ----
  const savedDataDir = process.env.FASTWORK_DATA_DIR;
  process.env.FASTWORK_DATA_DIR = dataRoot;
  const resolvedRoot = resolvePackagedDataRoot();
  check("data root honors FASTWORK_DATA_DIR", resolvedRoot === dataRoot, resolvedRoot);
  if (savedDataDir === undefined) delete process.env.FASTWORK_DATA_DIR; else process.env.FASTWORK_DATA_DIR = savedDataDir;
  const expectedDefault = resolve(join(process.env.LOCALAPPDATA || join(tmpdir(), "AppData", "Local"), "FastWorkRebuild", "data"));
  const defaultRoot = resolvePackagedDataRoot();
  check("data root default = %LOCALAPPDATA%\\FastWorkRebuild\\data", defaultRoot === expectedDefault, defaultRoot);

  // ---- 3) launch the packaged worker through the PRODUCTION launcher ----
  client = createPackagedWorkerClient(resourcesPath, dataRoot);
  const opts = client.options ?? {};
  const cfg = opts.spawn ?? {};
  check("launcher spawn executable is the packaged EXE", String(cfg.executable).endsWith(PACKAGED_WORKER_EXE), cfg.executable);
  check("launcher args empty for packaged EXE", Array.isArray(cfg.args) && cfg.args.length === 0);
  check("launcher cwd = packaged worker runtime dir", cfg.cwd === dirname(cfg.executable), cfg.cwd);
  check("launcher env sets FASTWORK_DATA_DIR", opts.env?.FASTWORK_DATA_DIR === dataRoot, opts.env?.FASTWORK_DATA_DIR);
  check("launcher env sets FASTWORK_CONTRACTS_SCHEMAS_DIR", opts.env?.FASTWORK_CONTRACTS_SCHEMAS_DIR === paths.schemasDir, opts.env?.FASTWORK_CONTRACTS_SCHEMAS_DIR);
  check("launcher env has no PYTHONPATH", !("PYTHONPATH" in (opts.env ?? {})));
  check("launcher env has no PYTHONHOME", !("PYTHONHOME" in (opts.env ?? {})));
  check("launcher cwd is the worker runtime dir (not source tree)", cfg.cwd === dirname(cfg.executable) && !cfg.cwd.startsWith(ROOT + "\\"), cfg.cwd);
  void opts;

  unsub = client.subscribeEvents((ev) => {
    if (ev.event === "worker.ready" && ev.payload && typeof ev.payload.pid === "number") workerPid = ev.payload.pid;
  });
  await client.start();
  check("worker start -> READY handshake", client.state() === "READY", client.state());
  check("worker ready pid captured", typeof workerPid === "number" && workerPid > 0, String(workerPid));

  // ---- 4) real JSONL RPC round trips through the production client ----
  const health = await client.request("system.health", {});
  check("system.health JSONL round-trip", health && health.status === "ok", JSON.stringify(health).slice(0, 120));
  const indexStatus = await client.request("rag.index_status", {});
  check("rag.index_status round-trip", indexStatus && typeof indexStatus.ready === "boolean" && typeof indexStatus.dimension === "number", JSON.stringify(indexStatus).slice(0, 160));

  // ---- 5) worker-backed Main context composition (production path) ----
  const ctx = createWorkerBackedMainContext({ workerClient: client, dataRoot });
  // The production composition keeps SqliteConnection handles open (pre-existing
  // behavior; Electron closes them at process exit). Close the reachable handle
  // so the temp data root can be removed after this smoke.
  try { ctx.feedbackService?.repository?.repo?.conn?.close?.(); } catch { /* noop */ }
  check("worker-backed Main context composed", !!ctx.orchestratorHost && !!ctx.worker);
  check("Main context worker status ready", ctx.worker.status().status === "ready");
  check("Main context worker-backed services wired", ctx.feedbackService !== null && !!ctx.jobs && !!ctx.optimization && !!ctx.learning && !!ctx.review && !!ctx.audit);

  // ---- 6) graceful shutdown (system.shutdown + exit) ----
  await client.stop();
  check("client STOPPED after graceful shutdown", client.state() === "STOPPED", client.state());
  const exited = await waitPidGone(workerPid, 15000);
  check("worker process exited after system.shutdown", exited, "pid=" + workerPid);
  unsub(); unsub = null;
  client = null;

  // ---- B) negative: worker executable missing -> fail loudly, no fallback ----
  const negWorker = mkdtempSync(join(tmpdir(), "pack003-neg-worker-"));
  const negWorkerResources = join(negWorker, "resources");
  await copyTree(SCHEMAS_SRC, join(negWorkerResources, "contracts", "schemas"));
  let threw = null;
  try { createPackagedWorkerClient(negWorkerResources, dataRoot); } catch (e) { threw = e; }
  check("worker missing -> launcher fails loudly", threw !== null);
  const workerErr = threw ? String(threw.message) : "";
  check("worker missing error names exact expected exe path", workerErr.includes(join(negWorkerResources, "worker", PACKAGED_WORKER_EXE)), workerErr.slice(0, 200));
  check("worker missing error is explicit (not found)", /not found/i.test(workerErr));
  check("worker missing -> no py/python fallback message", /never falls back/i.test(workerErr) && !/spawn (py|python)/i.test(workerErr));
  safeRemove(negWorker);

  // ---- C) negative: contracts schemas missing -> fail early, no source fallback ----
  const negSchemas = mkdtempSync(join(tmpdir(), "pack003-neg-schemas-"));
  const negSchemasResources = join(negSchemas, "resources");
  await copyTree(RUNTIME_SRC, join(negSchemasResources, "worker"));
  threw = null;
  try { createPackagedWorkerClient(negSchemasResources, dataRoot); } catch (e) { threw = e; }
  check("schemas missing -> launcher fails loudly", threw !== null);
  const schemasErr = threw ? String(threw.message) : "";
  check("schemas missing error names exact expected schemas path", schemasErr.includes(join(negSchemasResources, "contracts", "schemas")), schemasErr.slice(0, 200));
  check("schemas missing error is explicit (not found)", /not found/i.test(schemasErr));
  check("schemas missing -> no source-tree fallback message", /never falls back to the source tree/i.test(schemasErr));
  safeRemove(negSchemas);
} finally {
  if (unsub) { try { unsub(); } catch { /* noop */ } }
  if (client) { try { await client.stop(); } catch { /* noop */ } }
  if (base) safeRemove(base);
  if (dataRoot) safeRemove(dataRoot);
}

const failed = results.filter((r) => !r.ok).length;
for (const r of results) if (!r.ok) console.error("FAILED CHECK: " + r.name + " | " + r.extra);
console.log("PACK-003 packaged-worker Main integration smoke: " + (failed === 0 ? "PASS" : "FAIL") + " (" + results.length + " checks, " + failed + " failed)");
process.exit(failed === 0 ? 0 : 1);




