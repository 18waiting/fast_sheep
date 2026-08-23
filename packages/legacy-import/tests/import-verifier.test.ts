import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyImport } from "../dist/index.js";

test("verifier reports checks and all_ok", async () => {
  const session = { session_id: "s1", selection_id: "sel", plan_sha256: "x", state: "COMPLETED", phases: ["COMPLETE"], started_at: "", completed_at: "", backup_id: null, error: null };
  const v = await verifyImport(session, {
    quickCheckOk: () => true, countRows: () => 0, countKnowledge: () => 5, countCandidates: () => 2,
    ragReady: async () => true, noPlaintextSecrets: () => true, noDanglingMounts: () => true,
  });
  assert.equal(v.all_ok, true);
  assert.ok(v.checks.some((c) => c.name === "rag_ready" && c.ok));
});

test("verifier fails when RAG is not ready", async () => {
  const session = { session_id: "s1", selection_id: "sel", plan_sha256: "x", state: "COMPLETED", phases: ["COMPLETE"], started_at: "", completed_at: "", backup_id: null, error: null };
  const v = await verifyImport(session, {
    quickCheckOk: () => true, countRows: () => 0, countKnowledge: () => 5, countCandidates: () => 2,
    ragReady: async () => false, noPlaintextSecrets: () => true, noDanglingMounts: () => true,
  });
  assert.equal(v.all_ok, false);
});
