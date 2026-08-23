// M7 full PDD vertical offline smoke (clean-room). Real Electron Main + real PDD
// WebContentsView + real PddPlatformAdapter + real ConversationOrchestrator + real
// M2 AI worker process + M3 RAG + M4 Prompt/Tool/Provider mocks + M5 ConversationEngine.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { openDatabase } from "../packages/persistence/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WORKER_SRC = join(ROOT, "services", "ai-worker", "src");
const require = createRequire(join(ROOT, "apps", "desktop", "package.json"));
const electronPath = require("electron");
const MAIN_ENTRY = join(ROOT, "apps", "desktop", "dist", "main", "index.js");

let failed = 0;
const check = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) failed += 1; };

const dataRoot = mkdtempSync(join(tmpdir(), "fw-m7-vertical-"));
const resultFile = join(mkdtempSync(join(tmpdir(), "fw-m7-vertical-result-")), "vertical.json");
try {
  // 1. initialize/migrate DB
  const { conn } = openDatabase(dataRoot);
  conn.close();

  // 2-4. seed synthetic knowledge + build the M5 deterministic mock RAG root so
  // the real ConversationEngine retrieves a deterministic suggestion.
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
    "print('M5RAG READY=' + str(repo.ready()))",
  ].join("\n");
  execFileSync("py", ["-3.12", "-c", seed], { encoding: "utf-8", cwd: ROOT, env: { ...process.env, FASTWORK_DATA_DIR: dataRoot, FASTWORK_M5_RAG_ROOT: m5RagRoot, PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" } });

  // 5-7. launch Electron desktop in M7 vertical test mode
  const child = spawn(electronPath, [MAIN_ENTRY], {
    cwd: ROOT,
    env: {
      ...process.env,
      FASTWORK_DESKTOP_TEST_MODE: "1",
      FASTWORK_DESKTOP_M7_VERTICAL: "1",
      FASTWORK_DESKTOP_M7_VERTICAL_RESULT_FILE: resultFile,
      FASTWORK_DATA_DIR: dataRoot,
      FASTWORK_M5_RAG_ROOT: m5RagRoot,
      PYTHONPATH: WORKER_SRC,
      PYTHONIOENCODING: "utf-8",
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (d) => { stderr += String(d); });
  await new Promise((resolve) => {
    const timer = setTimeout(() => { child.kill(); resolve("timeout"); }, 120000);
    child.on("exit", () => { clearTimeout(timer); resolve("exit"); });
    child.on("error", (e) => { clearTimeout(timer); console.error("spawn error: " + e.message); resolve("error"); });
  });

  check("vertical result file written", existsSync(resultFile));
  if (!existsSync(resultFile)) {
    console.error("stderr tail: " + stderr.slice(-1500));
    process.exit(1);
  }
  const r = JSON.parse(readFileSync(resultFile, "utf-8"));
  const fields = [
    ["inbound_to_orchestrator", r.inbound_to_orchestrator === true],
    ["orchestrator_to_worker", r.orchestrator_to_worker === true],
    ["conversation_generate", r.conversation_generate === true],
    ["suggestion_ready", r.suggestion_ready === true],
    ["outbound_to_pdd", r.outbound_to_pdd === true],
    ["exactly_once_send", r.exactly_once_send === true],
    ["final_sent_state", r.final_sent_state === true],
    ["manual_takeover_blocks_ai", r.manual_takeover_blocks_ai === true],
    ["shop_isolation", r.shop_isolation === true],
    ["external_network_calls", r.external_network_calls === 0],
  ];
  for (const [name, ok] of fields) check("vertical " + name, ok);
  const report = {
    scenarios: Object.fromEntries(fields.map(([n, ok]) => [n, ok ? "PASS" : "FAIL"])),
    components_used: r.components_used ?? [],
    external_network_calls: r.external_network_calls,
    result: r.result === "PASS" && fields.every(([, ok]) => ok) ? "PASS" : "FAIL",
  };
  writeFileSync(join(ROOT, "reports", "m7-pdd-vertical-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
  if (report.result !== "PASS") {
    console.error("M7 VERTICAL SMOKE FAILED. errors: " + JSON.stringify(r.errors ?? []));
    process.exit(1);
  }
} finally {
  rmSync(dataRoot, { recursive: true, force: true });
  if (existsSync(dirname(resultFile))) rmSync(dirname(resultFile), { recursive: true, force: true });
}
if (failed > 0) process.exit(1);
console.log("M7 PDD VERTICAL OFFLINE SMOKE PASS");
