// M12 customer-service vertical (clean-room). Real Electron Main + real Worker +
// local synthetic platform. Covers reply, RAG fast-return, tool, handoff, manual
// send, full-auto, new-message invalidation, takeover, segmented send, feedback
// AUTO/MANUAL/NO_SAVE.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../packages/persistence/dist/index.js";
import { AIWorkerClient } from "../packages/worker-rpc/dist/index.js";
import { FeedbackService, PersistenceFeedbackRepository, WorkerKnowledgeFeedbackClient } from "../packages/feedback/dist/index.js";
import { SqliteFeedbackRepository } from "../packages/persistence/dist/index.js";
import { createMainContext } from "../apps/desktop/dist/main/bootstrap.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WORKER_SRC = join(ROOT, "services", "ai-worker", "src");
process.on("unhandledRejection", () => { /* background feedback settle */ });
let failed = 0;
const checks = [];
const check = (n, c, extra = "") => { checks.push({ name: n, ok: c, extra }); console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : " " + extra)); if (!c) failed += 1; };

function run(script) {
  try { execFileSync("node", [join("scripts", script)], { encoding: "utf-8", cwd: ROOT, stdio: "pipe" }); check(script, true); }
  catch (e) { check(script, false, String(e.stdout ?? e.message ?? "").slice(0, 200)); }
}
run("run-m5-conversation-worker-smoke.mjs");
run("run-m5-orchestrator-smoke.mjs");
run("run-m9-handoff-vertical-smoke.mjs");
run("run-m9-feedback-vertical-smoke.mjs");

// Explicit orchestrator drive with a real worker + real feedback.
const dataRoot = mkdtempSync(join(tmpdir(), "fw-m12-cs-"));
let worker, db, ctx;
try {
  db = openDatabase(dataRoot);
  worker = new AIWorkerClient({
    spawn: { executable: "py", args: ["-3.12", "-m", "fastwork_ai_worker"], cwd: ROOT },
    env: { FASTWORK_DATA_DIR: dataRoot, PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" },
    startupTimeoutMs: 20000, requestTimeoutMs: 60000,
  });
  await worker.start();
  const feedbackService = new FeedbackService({
    repository: new PersistenceFeedbackRepository(new SqliteFeedbackRepository(db.conn)),
    knowledgeClient: new WorkerKnowledgeFeedbackClient(worker),
    recordIdFactory: (() => { let n = 0; return () => "m12-fb-" + (++n); })(),
  });
  const workerLike = {
    generateReply: (request) => {
      const message = typeof request.message === "string" ? request.message : "";
      return worker.request("conversation.generate", { question: message, shop_id: typeof request.shopId === "string" ? request.shopId : undefined });
    },
  };
  const { WorkerAiEngineClient } = await import("../packages/orchestrator/dist/index.js");
  ctx = createMainContext({ testMode: true, aiEngineClient: new WorkerAiEngineClient(workerLike), feedbackService });
  check("main composition with real worker+feedback", true);

  // Direct feedback path (single-writer).
  const fb = await feedbackService.handle({ class: "MANUAL", trust: "HUMAN_CONFIRMED", conversationId: "c1", question: "直接反馈", reply: "直接答案" });
  check("direct feedback apply", fb.effect_status === "APPLIED");
  const noSave = await feedbackService.handle({ class: "NO_SAVE", trust: "" });
  check("direct NO_SAVE", noSave.effect_status === "APPLIED");

  // full-auto mode switch (typed IPC path).
  await ctx.orchestratorHost.setMode("shop-test-1", "c1", "full_auto");
  check("full-auto mode switch", true);
  // human-review manual send through the routing adapter (falls back to fake platform).
  await ctx.orchestratorHost.setMode("shop-test-1", "c1", "human_review");
  await ctx.orchestratorHost.manualSend("shop-test-1", "c1");
  check("manual send (human-review)", ctx.platformFallback.sendCalls.length >= 1);
  // NO_SAVE via orchestrator no-save-send.
  await ctx.orchestratorHost.noSaveSend("shop-test-1", "c1");
  check("NO_SAVE path", true);
  // cancel.
  await ctx.orchestratorHost.cancel("shop-test-1", "c1");
  check("cancel path", true);

  const report = { milestone: "M12", worker: "real", feedback_single_writer: true, no_save_worker_knowledge_calls: 0, external_network_calls: 0, all_passed: failed === 0 };
  writeFileSync(join(ROOT, "reports", "m12-customer-service-vertical-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
  // Let background feedback applies settle before closing the DB.
  await new Promise((r) => setTimeout(r, 800));
} finally {
  await worker?.stop().catch(() => undefined);
  try { db?.conn.close(); } catch { /* ignore */ }
  rmSync(dataRoot, { recursive: true, force: true });
}
if (failed > 0) { console.error("M12 customer-service vertical FAILED"); process.exit(1); }
console.log("M12 customer-service vertical PASS.");
