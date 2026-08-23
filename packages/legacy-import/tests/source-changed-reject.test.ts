import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSelection, planImport, ImportOrchestrator, type ImportSessionStorePort, LegacyImportError } from "../dist/index.js";

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

test("apply rejects a source that changed after the plan", async () => {
  const root = mkdtempSync(join(tmpdir(), "fw-chg-"));
  const p = join(root, "shops.json");
  writeFileSync(p, JSON.stringify([{ id: "s1", type: "pdd", name: "n", enabled: true }]));
  const sel = createSelection(root, [p]);
  const plan = await planImport(sel, {});
  // Mutate the source after planning.
  writeFileSync(p, JSON.stringify([{ id: "s1", type: "pdd", name: "CHANGED", enabled: true }]));
  const orchestrator = new ImportOrchestrator({
    sessionStore: makeStore(),
    mainWriter: { write: async () => ({ aggregate: "shops", inserted: 0, skipped: 0, replaced: 0 }), hasIdentity: () => false, foreignRefsValid: () => true },
    workerClient: { validateKnowledge: async () => ({ ok: true, errors: [], rows: 0 }), applyKnowledge: async () => ({ inserted: 0, skipped_duplicates: 0, candidates: 0, trust_map: {} }), verifyKnowledge: async () => ({ ok: true, counts: {} }) },
    backup: { backup: () => ({ backup_id: "b", path: "" }) },
    secretStore: { store: () => null },
    verificationDeps: { quickCheckOk: () => true, countRows: () => 0, countKnowledge: () => 0, countCandidates: () => 0, ragReady: async () => true, noPlaintextSecrets: () => true, noDanglingMounts: () => true },
    ragRebuild: async () => true,
  });
  await assert.rejects(() => orchestrator.apply(plan, sel), (e: unknown) => (e as LegacyImportError).code === "import.source_changed");
});
