import { test } from "node:test";
import assert from "node:assert/strict";
import { CooldownPolicy, guardDetail } from "../dist/index.js";

test("guards + cooldown compose into an atomic decision (no partial apply)", () => {
  const detail = "<优化后详情>";
  const guard = guardDetail(detail, 20000);
  const cd = new CooldownPolicy(3600, 86400).isCoolingDown("2026-08-15T00:00:00Z", Date.parse("2026-08-15T00:30:00Z"));
  // Within cooldown -> the apply decision is rejected atomically.
  assert.equal(guard.dirty, false);
  assert.equal(cd.cooldown, true);
  const applied = !guard.dirty && !cd.cooldown;
  assert.equal(applied, false);
});

test("clean guard + no cooldown -> apply proceeds", () => {
  const guard = guardDetail("<优化后详情>", 20000);
  const cd = new CooldownPolicy(3600, 86400).isCoolingDown(null, Date.now());
  const applied = !guard.dirty && !cd.cooldown;
  assert.equal(applied, true);
});
