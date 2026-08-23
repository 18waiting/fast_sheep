// M8 remaining-platforms vertical offline smoke (clean-room). For each of the five
// remaining platforms: synthetic inbound -> page runtime -> Main -> orchestrator ->
// real M2 worker -> M3 RAG -> M4 mocks -> M5 ConversationEngine -> suggestion ->
// platform adapter -> synthetic DOM send. External network = 0.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { openDatabase } from "../packages/persistence/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WORKER_SRC = join(ROOT, "services", "ai-worker", "src");
const require = createRequire(join(ROOT, "apps", "desktop", "package.json"));
const electronPath = require("electron");
const MAIN_ENTRY = join(ROOT, "apps", "desktop", "dist", "main", "index.js");

const dataRoot = mkdtempSync(join(tmpdir(), "fw-m8-vertical-"));
const resultFile = join(mkdtempSync(join(tmpdir(), "fw-m8-vertical-result-")), "vertical.json");
try {
  const { conn } = openDatabase(dataRoot); conn.close();
  const m5RagRoot = join(dataRoot, "m5-rag");
  const seed = [
    "import os, sys",
    "sys.path.insert(0, " + JSON.stringify(WORKER_SRC) + ")",
    "from fastwork_ai_worker.persistence import open_worker_db, KnowledgeRepository",
    "conn = open_worker_db(os.environ['FASTWORK_DATA_DIR'])",
    "kr = KnowledgeRepository(conn)",
    "kr.upsert({'id':'k1','question':'有货吗','answer':'亲,有的哦~','product_id':'P1','tags':[],'source':'s','trust_level':'HUMAN_CONFIRMED','created_at':'2026-08-16T00:00:00Z','updated_at':'2026-08-16T00:00:00Z'})",
    "entries = kr.list()",
    "conn.commit(); conn.close()",
    "from fastwork_ai_worker.rag.index_repository import IndexRepository",
    "from fastwork_ai_worker.rag.index_refresh import IndexRefresh",
    "from fastwork_ai_worker.rag.mock_embedding_provider import MockEmbeddingProvider",
    "from fastwork_ai_worker.rag.config import load_rag_config",
    "os.makedirs(os.environ['FASTWORK_M5_RAG_ROOT'], exist_ok=True)",
    "cfg = load_rag_config({})",
    "repo = IndexRepository(os.environ['FASTWORK_M5_RAG_ROOT'], config=cfg, dimension=1024)",
    "refresh = IndexRefresh(repo, MockEmbeddingProvider(dimension=1024), cfg)",
    "refresh.promote(refresh.full_build(entries, os.environ['FASTWORK_M5_RAG_ROOT']))",
    "print('M5RAG READY')",
  ].join("\n");
  execFileSync("py", ["-3.12", "-c", seed], { cwd: ROOT, env: { ...process.env, FASTWORK_DATA_DIR: dataRoot, FASTWORK_M5_RAG_ROOT: m5RagRoot, PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" } });

  const child = spawn(electronPath, [MAIN_ENTRY], {
    cwd: ROOT,
    env: { ...process.env, FASTWORK_DESKTOP_TEST_MODE: "1", FASTWORK_DESKTOP_M8_VERTICAL_RESULT_FILE: resultFile, FASTWORK_DATA_DIR: dataRoot, FASTWORK_M5_RAG_ROOT: m5RagRoot, PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8", ELECTRON_DISABLE_SECURITY_WARNINGS: "true" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (d) => { stderr += String(d); });
  await new Promise((resolve) => {
    const timer = setTimeout(() => { child.kill(); resolve("timeout"); }, 240000);
    child.on("exit", () => { clearTimeout(timer); resolve("exit"); });
  });
  if (!existsSync(resultFile)) { console.error("FAIL: no M8 vertical result; stderr: " + stderr.slice(-1500)); process.exit(1); }
  const r = JSON.parse(readFileSync(resultFile, "utf-8"));
  const failed = [];
  for (const platform of ["doudian", "jd", "kuaishou", "qianniu", "xianyu"]) {
    const row = r.platforms?.[platform] ?? {};
    const ok = row.suggestion_ready === true && row.exactly_once_send === true;
    console.log((ok ? "PASS " : "FAIL ") + "vertical " + platform + " (suggestion=" + row.suggestion_ready + ", exactly_once=" + row.exactly_once_send + ")");
    if (!ok) failed.push(platform);
  }
  const report = { scenarios: r.platforms ?? {}, external_network_calls: r.external_network_calls, result: failed.length === 0 && r.result === "PASS" ? "PASS" : "FAIL" };
  writeFileSync(join(ROOT, "reports", "m8-vertical-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
  if (failed.length > 0) { console.error("M8 vertical smoke FAILED: " + failed.join(", ") + " errors=" + JSON.stringify(r.errors)); process.exit(1); }
} finally {
  rmSync(dataRoot, { recursive: true, force: true });
  if (existsSync(dirname(resultFile))) rmSync(dirname(resultFile), { recursive: true, force: true });
}
console.log("M8 remaining-platforms vertical offline smoke PASS");
