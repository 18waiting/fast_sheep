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

test("second apply yields zero duplicate logical rows (idempotent writer)", async () => {
  const root = mkdtempSync(join(tmpdir(), "fw-idem-"));
  const shopPath = join(root, "shops.json");
  writeFileSync(shopPath, JSON.stringify([{ id: "s1", type: "pdd", name: "n", enabled: true }]));
  const sel = createSelection(root, [shopPath]);
  const plan = await planImport(sel, {});

  const applied = new Set<string>();
  const store = makeStore();
  const orchestrator = new ImportOrchestrator({
    sessionStore: store,
    mainWriter: {
      write: async (_item: never, _parsed: never, manifest: { item_id: string }, _options: never) => {
        if (applied.has(manifest.item_id)) return { aggregate: "shops", inserted: 0, skipped: 1, replaced: 0 };
        applied.add(manifest.item_id);
        return { aggregate: "shops", inserted: 1, skipped: 0, replaced: 0 };
      },
      hasIdentity: () => false,
      foreignRefsValid: () => true,
    },
    workerClient: {
      validateKnowledge: async () => ({ ok: true, errors: [], rows: 0 }),
      applyKnowledge: async () => ({ inserted: 0, skipped_duplicates: 0, candidates: 0, trust_map: {} }),
      verifyKnowledge: async () => ({ ok: true, counts: { knowledge: 0, candidates: 0 } }),
    },
    backup: { backup: () => ({ backup_id: "bk-1", path: "" }) },
    secretStore: { store: () => null },
    verificationDeps: { quickCheckOk: () => true, countRows: () => 0, countKnowledge: () => 0, countCandidates: () => 0, ragReady: async () => true, noPlaintextSecrets: () => true, noDanglingMounts: () => true },
    ragRebuild: async () => true,
  });
  const a = await orchestrator.apply(plan, sel);
  const b = await orchestrator.apply(plan, sel);
  assert.equal(a.effect.main_inserted, 1);
  assert.equal(b.effect.main_inserted, 0);
  assert.equal(a.effect.main_inserted + b.effect.main_inserted, 1);
});
