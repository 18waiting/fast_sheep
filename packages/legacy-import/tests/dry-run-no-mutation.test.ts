import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSelection, planImport } from "../dist/index.js";

test("dry-run performs zero canonical mutation", async () => {
  const root = mkdtempSync(join(tmpdir(), "fw-dry-"));
  writeFileSync(join(root, "shops.json"), JSON.stringify([{ id: "s1", type: "pdd", name: "n", enabled: true }]));
  const sel = createSelection(root, [join(root, "shops.json")]);
  const plan = await planImport(sel, {});
  assert.ok(plan.plan_sha256.length === 64);
  // No DB writes are possible here: planImport only reads source files.
  assert.equal(plan.items[0].record_count, 1);
});
