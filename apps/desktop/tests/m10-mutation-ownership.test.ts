import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAIN = join(ROOT, "src", "main");
const WORKER = join(ROOT, "..", "..", "services", "ai-worker", "src", "fastwork_ai_worker");

function listFiles(dir: string, ext = ".ts"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...listFiles(p, ext));
    else if (entry.endsWith(ext)) out.push(p);
  }
  return out;
}

test("Node writes zero knowledge: desktop M10 services never write knowledge_entries/candidates/pending", () => {
  const files = listFiles(join(MAIN, "services")).filter((f) => /(learning|review|audit|product-optimization|background-job)-service\.ts$/.test(f));
  assert.equal(files.length, 5);
  for (const f of files) {
    const c = readFileSync(f, "utf-8");
    for (const token of ["INSERT INTO knowledge_entries", "INSERT INTO knowledge_candidates", "INSERT INTO pending_knowledge", "knowledge_entries", "knowledge_candidates"]) {
      assert.ok(!c.includes(token), `${f} must not reference ${token}`);
    }
  }
});

test("Main writes zero candidates: no candidate repository import in desktop main services", () => {
  const files = listFiles(join(MAIN, "services"));
  for (const f of files) {
    const c = readFileSync(f, "utf-8");
    assert.ok(!c.includes("CandidateRepository"), f + " must not import candidate repositories");
  }
});

test("Worker writes zero products: optimization worker code contains no product write", () => {
  const optDir = join(WORKER, "optimization");
  for (const f of listFiles(optDir, ".py")) {
    const c = readFileSync(f, "utf-8");
    for (const token of ["UPDATE products", "INSERT INTO products", "product_db_lite.写入", "os.replace(主表"]) {
      assert.ok(!c.includes(token), `${f} must not contain ${token}`);
    }
  }
});

test("Worker writes zero background_jobs: Python worker has no background_jobs reference", () => {
  const files = listFiles(WORKER, ".py");
  for (const f of files) {
    const c = readFileSync(f, "utf-8");
    assert.ok(!c.includes("background_jobs"), f + " must not reference background_jobs");
  }
});

test("optimization RPC surface is propose-only (no arbitrary SQL/knowledge CRUD)", () => {
  const rpc = readFileSync(join(WORKER, "rpc", "methods", "m10_domain.py"), "utf-8");
  assert.ok(rpc.includes("optimization.propose"));
  assert.ok(!rpc.includes("optimization.apply"));
  assert.ok(!rpc.includes("arbitrary"));
});
