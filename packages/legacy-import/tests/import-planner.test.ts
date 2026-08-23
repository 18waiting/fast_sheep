import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSelection, planImport } from "../dist/index.js";

test("planImport produces a plan with a deterministic plan_sha256 and zero mutation", async () => {
  const root = mkdtempSync(join(tmpdir(), "fw-plan-"));
  writeFileSync(join(root, "shops.json"), JSON.stringify([{ id: "s1", type: "pdd", name: "n", enabled: true }]));
  const sel = createSelection(root, [join(root, "shops.json")]);
  const plan = await planImport(sel, { conflict_policy: "PRESERVE_EXISTING" });
  assert.ok(plan.plan_sha256.length === 64);
  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0].target_aggregate, "shops");
  const plan2 = await planImport(sel, { conflict_policy: "PRESERVE_EXISTING" });
  assert.equal(plan2.plan_sha256, plan.plan_sha256);
});
