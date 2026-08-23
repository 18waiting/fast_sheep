// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1 (TASK-016): cross-process SQLite integration test against one temporary DB.
// Node writes a MAIN-owned aggregate (shops); Python writes worker-owned knowledge;
// both read permitted data. No competing write APIs for the same aggregate. No network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { openDatabase, SqliteConnection, DB_FILENAME, SqliteShopRepository } from "../packages/persistence/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REBUILD = join(HERE, "..");
const WORKER_SRC = join(REBUILD, "services", "ai-worker", "src");

function pythonCmd() {
  if (process.env.FASTWORK_PYTHON) return [process.env.FASTWORK_PYTHON, "-c"];
  return ["py", "-3.12", "-c"];
}

test("cross-process sqlite: MAIN writes shop, WORKER writes knowledge, both read", () => {
  const root = mkdtempSync(join(tmpdir(), "fw-xp2-"));
  const { conn } = openDatabase(root);
  new SqliteShopRepository(conn).add({ id: "shop-1-0001", type: "pdd", name: "拼多多-店", enabled: true, order: 0 });
  conn.close();

  const script = [
    "import os, sys, json",
    "from fastwork_ai_worker.persistence import open_worker_db, KnowledgeRepository, KnowledgeCandidateRepository",
    "conn = open_worker_db(os.environ['FASTWORK_DATA_DIR'])",
    "kr = KnowledgeRepository(conn)",
    "kr.upsert({'id':'h1','question':'这个多少钱','answer':'99元','product_id':'10001','tags':['价格'],'source':'manual','trust_level':'HUMAN_CONFIRMED','created_at':'2026-08-15T00:00:00Z','updated_at':'2026-08-15T00:00:00Z'})",
    "kc = KnowledgeCandidateRepository(conn)",
    "kc.insert({'candidate_id':'cand1','question':'有货吗','answer':'有','product_id':'10001','origin':'GENERATED','status':'PENDING_REVIEW'})",
    "conn.commit()",
    "shops = conn.execute(\"SELECT COUNT(*) AS c FROM shops\").fetchone()['c']",
    "print(json.dumps({'shops': shops, 'knowledge': kr.count(), 'candidates': kc.count()}))",
  ].join("\n");
  const out = execFileSync(pythonCmd()[0], [...pythonCmd().slice(1), script], {
    env: { ...process.env, FASTWORK_DATA_DIR: root, PYTHONPATH: WORKER_SRC },
    encoding: "utf-8",
  });
  const res = JSON.parse(out.trim().split(/\r?\n/).pop());
  assert.equal(res.shops, 1);
  assert.equal(res.knowledge, 1);
  assert.equal(res.candidates, 1);

  const c2 = new SqliteConnection(join(root, DB_FILENAME));
  assert.equal(c2.get("SELECT COUNT(*) AS c FROM knowledge_entries").c, 1);
  assert.equal(c2.get("SELECT COUNT(*) AS c FROM knowledge_candidates").c, 1);
  assert.equal(c2.get("PRAGMA quick_check").quick_check, "ok");
  c2.close();
});
