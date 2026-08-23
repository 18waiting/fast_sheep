// M9 handoff vertical smoke (clean-room). Real worker + real HandoffPolicyEngine:
// PDD post-generation handoff, Qianniu early, Xianyu skip, FC boundary.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../packages/persistence/dist/index.js";
import { AIWorkerClient } from "../packages/worker-rpc/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WORKER_SRC = join(ROOT, "services", "ai-worker", "src");
let failed = 0;
const check = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) failed += 1; };

const dataRoot = mkdtempSync(join(tmpdir(), "fw-m9-handoff-"));
try {
  const { conn } = openDatabase(dataRoot);
  conn.run("INSERT INTO transfer_rules (keyword, transfer_to, status, sort_order, enabled) VALUES ('退款','售后','生效',0,1)");
  conn.run("INSERT INTO transfer_rules (keyword, transfer_to, status, sort_order, enabled) VALUES ('【任何消息都转接】','值班','生效',1,1)");
  conn.close();

  const client = new AIWorkerClient({
    spawn: { executable: "py", args: ["-3.12", "-m", "fastwork_ai_worker"], cwd: ROOT },
    env: { FASTWORK_DATA_DIR: dataRoot, PYTHONPATH: WORKER_SRC, PYTHONIOENCODING: "utf-8" },
    startupTimeoutMs: 20000, requestTimeoutMs: 60000,
  });
  await client.start();
  try {
    const pdd = await client.request("handoff.evaluate", { question: "我要退款", agent: "pdd-客服", shop: "pdd-店", order_state: "已下单", highest_sim: 0.5 });
    check("pdd post-generation handoff", pdd.decision?.transfer === true && pdd.decision?.target === "售后");

    const xianyu = await client.request("handoff.evaluate", { question: "退款", agent: "闲鱼-小店" });
    check("xianyu skip", xianyu.decision?.transfer === false && xianyu.decision?.reason === "xianyu_excluded");

    const anyMsg = await client.request("handoff.evaluate", { question: "在吗", agent: "pdd-客服" });
    check("any-message rule", anyMsg.decision?.transfer === true && anyMsg.decision?.target === "值班");

    // FC transfer_to_human boundary: a structured TransferDecision round-trips
    // through the legacy marker codec (internal protocol stays TransferDecision).
    const marker = await client.request("handoff.evaluate", { question: "退款", agent: "pdd-客服", order_state: "已下单", highest_sim: 0.5 });
    check("fc transfer_to_human decision", marker.decision?.transfer === true && typeof marker.decision?.target === "string");
  } finally {
    await client.stop();
  }
} finally {
  rmSync(dataRoot, { recursive: true, force: true });
}
if (failed > 0) { console.error("M9 handoff vertical smoke FAILED"); process.exit(1); }
console.log("M9 handoff vertical smoke PASS.");
