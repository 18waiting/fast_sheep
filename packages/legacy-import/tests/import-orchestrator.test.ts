import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSelection, planImport, ImportOrchestrator, type ImportSessionStorePort } from "../dist/index.js";

function makeStore(): ImportSessionStorePort {
  const rows = new Map<string, any>();
  return {
    create: (s) => rows.set(s.session_id, { ...s, phases: [...s.phases] }),
    get: (id) => { const s = rows.get(id); return s ? { ...s, phases: [...s.phases] } : null; },
    updateState: (id, state, phase, error) => { const s = rows.get(id); if (s) { s.state = state; if (phase && !s.phases.includes(phase)) s.phases.push(phase); if (error !== undefined) s.error = error; } },
    appendPhase: (id, phase) => { const s = rows.get(id); if (s && !s.phases.includes(phase)) s.phases.push(phase); },
    listRecent: () => [...rows.values()],
  };
}

test("orchestrator runs backup -> main -> worker -> rag -> verify -> complete", async () => {
  const root = mkdtempSync(join(tmpdir(), "fw-orb-"));
  const shopPath = join(root, "shops.json");
  const kbPath = join(root, "知识库", "A库全自动收录.csv");
  writeFileSync(shopPath, JSON.stringify([{ id: "s1", type: "pdd", name: "n", enabled: true }]));
  mkdirSync(join(root, "知识库"), { recursive: true });
  writeFileSync(kbPath, "问题,答案,商品ID,标签\nq,a,10001,\n");

  const sel = createSelection(root, [shopPath, kbPath]);
  const plan = await planImport(sel, {});
  assert.equal(plan.items.length, 2);

  const phases: string[] = [];
  const orchestrator = new ImportOrchestrator({
    sessionStore: makeStore(),
    mainWriter: { write: async () => { phases.push("main"); return { aggregate: "shops", inserted: 1, skipped: 0, replaced: 0 }; }, hasIdentity: () => false, foreignRefsValid: () => true },
    workerClient: { validateKnowledge: async () => ({ ok: true, errors: [], rows: 0 }), applyKnowledge: async () => { phases.push("worker"); return { inserted: 1, skipped_duplicates: 0, candidates: 0, trust_map: {} }; }, verifyKnowledge: async () => ({ ok: true, counts: {} }) },
    backup: { backup: () => { phases.push("backup"); return { backup_id: "bk-1", path: "" }; } },
    secretStore: { store: () => null },
    verificationDeps: { quickCheckOk: () => true, countRows: () => 0, countKnowledge: () => 0, countCandidates: () => 0, ragReady: async () => { phases.push("rag"); return true; }, noPlaintextSecrets: () => true, noDanglingMounts: () => true },
    ragRebuild: async () => true,
  });
  const res = await orchestrator.apply(plan, sel);
  assert.equal(res.session.state, "COMPLETED");
  assert.ok(phases.indexOf("backup") < phases.indexOf("main"));
  assert.ok(phases.indexOf("main") < phases.indexOf("worker"));
  assert.ok(phases.indexOf("worker") < phases.indexOf("rag"));
  assert.equal(res.effect.main_inserted, 1);
  assert.equal(res.effect.worker_inserted, 1);
});
