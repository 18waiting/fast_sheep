// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compileAllSchemas } from "../../packages/contracts/dist/validate.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE = join(HERE, "..", "..", "packages", "contracts");

test("registry exists and every schema file is registered", () => {
  const reg = JSON.parse(readFileSync(join(PACKAGE, "contract-registry.json"), "utf-8"));
  assert.ok(reg.contracts.length >= 40, `expected >=40 contracts, got ${reg.contracts.length}`);
  const seen = new Set();
  for (const c of reg.contracts) {
    assert.ok(!seen.has(c.id), `duplicate id ${c.id}`);
    seen.add(c.id);
    assert.ok(existsSync(join(PACKAGE, c.schema)), `missing schema file for ${c.id}`);
  }
});

test("all schemas compile with no duplicate $id and no unresolved $ref", () => {
  const { ajv, report } = compileAllSchemas();
  const bad = report.schemas.filter((s) => !s.ok);
  assert.deepEqual(bad.map((s) => s.id), [], `compile failures: ${JSON.stringify(bad)}`);
  assert.deepEqual(report.duplicateIds, [], "duplicate $id");
  assert.deepEqual(report.unresolvedRefs, [], "unresolved refs");
  assert.ok(Object.keys(ajv.schemas).length >= 40, "schemas registered");
});

// --- example tests ---
function v(id) { const { ajv } = compileAllSchemas(); return ajv.getSchema(id); }

test("RpcRequest valid example passes; missing required fails", () => {
  const val = v("fastwork:rpc:request");
  assert.ok(val({ version: 1, request_id: "r1", method: "ping", payload: {} }));
  assert.equal(val({ version: 1, method: "ping", payload: {} }), false); // missing request_id
  assert.equal(val({ version: 2, request_id: "r1", method: "ping", payload: {} }), false); // wrong version
});

test("RpcResponse success/failure examples", () => {
  const val = v("fastwork:rpc:response");
  assert.ok(val({ request_id: "r1", ok: true, result: {}, error: null, metadata: {} }));
  assert.ok(val({ request_id: "r1", ok: false, result: null, error: { code: "x", category: "internal", message: "m", retryable: false } }));
  assert.equal(val({ request_id: "r1", ok: true, result: {}, error: "oops" }), false); // error must be object-or-null
});

test("Error schema enforces category enum and forbids extra props", () => {
  const val = v("fastwork:error");
  assert.ok(val({ code: "e1", category: "provider", message: "m", retryable: true }));
  assert.equal(val({ code: "e1", category: "bogus", message: "m", retryable: true }), false);
  assert.equal(val({ code: "e1", category: "provider", message: "m", retryable: true, stack_trace: "x" }), false);
});

test("Shop schema enforces platform enum", () => {
  const val = v("fastwork:domain:shop");
  assert.ok(val({ id: "shop-1-0001", type: "pdd", name: "店", enabled: true }));
  assert.equal(val({ id: "shop-1-0001", type: "taobao", name: "店", enabled: true }), false);
});

test("Suggestion references TransferDecision; wrong mode fails", () => {
  const val = v("fastwork:domain:suggestion");
  const base = { suggestion_id: "s1", conversation_id: "c1", generation: 1, reply: "hi", mode: "human_review", created_at: "2026-08-15T00:00:00Z", decision: { requested: true, target: "售后" } };
  assert.ok(val(base));
  assert.equal(val({ ...base, mode: "bogus" }), false);
  assert.equal(val({ ...base, decision: { requested: "yes" } }), false);
});

test("SendCommand segments minItems and transfer ref", () => {
  const val = v("fastwork:domain:send-command");
  assert.ok(val({ send_id: "s1", conversation_id: "c1", shop_id: "shop-1", platform: "pdd", segments: [{ type: "text", content: "hi" }], transfer: { requested: false } }));
  assert.equal(val({ send_id: "s1", conversation_id: "c1", shop_id: "shop-1", platform: "pdd", segments: [] }), false);
});

test("KnowledgeEntry trust enum and required fields", () => {
  const val = v("fastwork:domain:knowledge-entry");
  const e = { id: "h1", question: "q", answer: "a", product_id: "", trust_level: "HUMAN_CONFIRMED", created_at: "2026-08-15T00:00:00Z", updated_at: "2026-08-15T00:00:00Z" };
  assert.ok(val(e));
  assert.equal(val({ ...e, trust_level: "WEIRD" }), false);
  assert.equal(val({ ...e, id: undefined }), false);
});

test("RAGConfig drift-corrected constants enforced", () => {
  const val = v("fastwork:config:rag-config");
  assert.ok(val({ embedding_dim: 1024, metric: "cosine" }));
  assert.equal(val({ embedding_dim: 512, metric: "cosine" }), false);
  assert.equal(val({ embedding_dim: 1024, metric: "euclidean" }), false);
});

test("TransferDecision and ToolCall/ToolResult refs resolve", () => {
  const td = v("fastwork:domain:transfer-decision");
  assert.ok(td({ requested: false }));
  const tc = v("fastwork:domain:tool-call");
  assert.ok(tc({ tool_call_id: "t1", name: "x", arguments: {} }));
  const tr = v("fastwork:domain:tool-result");
  assert.ok(tr({ tool_call_id: "t1", ok: true, result: {} }));
});

test("Event envelope + typed event const", () => {
  const env = v("fastwork:event:envelope");
  assert.ok(env({ event: "any", payload: {} }));
  const le = v("fastwork:event:learning-progress");
  assert.ok(le({ event: "learning-progress", payload: { job_id: "j1", progress: 50 } }));
  assert.equal(le({ event: "other", payload: { job_id: "j1", progress: 50 } }), false);
});

