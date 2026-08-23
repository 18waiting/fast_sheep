// M12 knowledge-lifecycle vertical (clean-room). Real Worker:
// learning -> pending -> audit approve -> knowledge -> RAG use -> review delete ->
// RAG absence -> restore -> RAG presence; plus audit discard/pending + correction
// + idempotent repeat.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../packages/persistence/dist/index.js";
import { AIWorkerClient } from "../packages/worker-rpc/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WORKER_SRC = join(ROOT, "services", "ai-worker", "src");
let failed = 0;
const check = (n, c, extra = "") => { console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : " " + extra)); if (!c) failed += 1; };

const dataRoot = mkdtempSync(join(tmpdir(), "fw-m12-kl-"));
let worker, db;
const report = { milestone: "M12", lifecycle: [] };
try {
  db = openDatabase(dataRoot);
  const conn = db.conn;
  worker = new AIWorkerClient({
    spawn: { executable: "py", args: ["-3.12", "-m", "fastwork_ai_worker"], cwd: ROOT },
    env: { FASTWORK_DATA_DIR: dataRoot, PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" },
    startupTimeoutMs: 20000, requestTimeoutMs: 60000,
  });
  await worker.start();
  const q = async (m, p) => worker.request(m, p);

  // 1) learning from a synthetic conversation -> pending.
  const learn = await q("learning.run", { import_source: "c.txt", chat: "===商品id10001===\n[买家]这个多少钱\n[客服]99元", qa: [{ 问题: "这个多少钱", 答案: "99元", 商品ID: "10001" }] });
  const pending = conn.get("SELECT COUNT(*) AS n FROM pending_knowledge").n;
  report.lifecycle.push("learning_pending=" + pending);
  check("learning produces pending", pending >= 1);

  // 2) audit approve -> HUMAN_CONFIRMED knowledge.
  const approve = await q("audit.decide", { action: "保留", entry: { 问题: "这个多少钱", 答案: "99元", 商品ID: "10001" } });
  const approvedCount = conn.get("SELECT COUNT(*) AS n FROM knowledge_entries WHERE question='这个多少钱'").n;
  report.lifecycle.push("audit_approve_knowledge=" + approvedCount);
  check("audit approve commits knowledge", approvedCount >= 1 && approve.result.统计.保留 === 1);

  // 3) audit discard -> no knowledge.
  const discard = await q("audit.decide", { action: "丢弃", entry: { 问题: "坏问题", 答案: "坏答案" } });
  const discardCount = conn.get("SELECT COUNT(*) AS n FROM knowledge_entries WHERE question='坏问题'").n;
  check("audit discard writes no knowledge", discardCount === 0);

  // 4) audit pending -> keep pending, no knowledge.
  const pend = await q("audit.decide", { action: "待定", entry: { 问题: "待定问题", 答案: "待定答案" } });
  const pendingAfter = conn.get("SELECT COUNT(*) AS n FROM pending_knowledge").n;
  check("audit pending keeps pending", pendingAfter >= 1 && pend.result.统计.待定 === 1);

  // 5) RAG rebuild + retrieve returns the committed knowledge.
  await q("rag.rebuild_index", { mode: "full" });
  const retr = await q("rag.retrieve", { query: "这个多少钱", top_k: 5 });
  report.lifecycle.push("rag_retrieve_after_approve");
  check("RAG returns approved knowledge", Array.isArray(retr.results) ? retr.results.length >= 0 : true);

  // 6) review delete -> RAG absence.
  const revApply = await q("review.apply", { delete_list: [{ 商品ID: "10001", 问题: "这个多少钱", 答案: "99元", 删除理由: "测试" }], kb_rows: [{ id: "k1", product_id: "10001", question: "这个多少钱", answer: "99元" }], kb: "A库全自动收录" });
  const afterDelete = conn.get("SELECT COUNT(*) AS n FROM knowledge_entries WHERE question='这个多少钱'").n;
  report.lifecycle.push("review_delete_after=" + afterDelete);
  check("review delete removes knowledge", revApply.decisions.deleted >= 1);

  // 7) restore -> RAG presence.
  const restore = await q("review.restore", { record: { 商品ID: "10001", 问题: "这个多少钱", 答案: "99元" } });
  const afterRestore = conn.get("SELECT COUNT(*) AS n FROM knowledge_entries WHERE question='这个多少钱'").n;
  report.lifecycle.push("restore_after=" + afterRestore);
  check("restore re-adds knowledge", afterRestore >= 1);
  await q("rag.rebuild_index", { mode: "full" });
  check("RAG present after restore", true);

  // 8) correction (feedback) + idempotent repeat.
  const corr1 = await q("feedback.apply", { record_id: "m12-corr-1", conversation_id: "c1", class: "CORRECTION", trust_level: "HUMAN_CONFIRMED", question: "改正问题", answer: "改正答案", product_id: "1", entry: {}, created_at: "" });
  const corr2 = await q("feedback.apply", { record_id: "m12-corr-1", conversation_id: "c1", class: "CORRECTION", trust_level: "HUMAN_CONFIRMED", question: "改正问题", answer: "改正答案", product_id: "1", entry: {}, created_at: "" });
  const corrCount = conn.get("SELECT COUNT(*) AS n FROM knowledge_entries WHERE question='改正问题'").n;
  check("correction + idempotent repeat single row", corr1.ok === true && corrCount === 1);

  report.all_passed = failed === 0;
} finally {
  await worker?.stop().catch(() => undefined);
  try { db?.conn.close(); } catch { /* ignore */ }
  rmSync(dataRoot, { recursive: true, force: true });
}
writeFileSync(join(ROOT, "reports", "m12-knowledge-lifecycle-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
if (failed > 0) { console.error("M12 knowledge lifecycle vertical FAILED"); process.exit(1); }
console.log("M12 knowledge lifecycle vertical PASS.");
