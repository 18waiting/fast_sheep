import { test } from "node:test";
import assert from "node:assert/strict";
import { CooldownPolicy } from "../dist/index.js";

const BASE = Date.parse("2026-08-15T00:00:00Z");

test("null last_optimized_at -> no cooldown", () => {
  const p = new CooldownPolicy(3600, 86400);
  assert.deepEqual(p.isCoolingDown(null, BASE), { cooldown: false });
});

test("elapsed < 3600 -> cooling", () => {
  const p = new CooldownPolicy(3600, 86400);
  assert.equal(p.isCoolingDown(new Date(BASE).toISOString(), BASE + 3599 * 1000).cooldown, true);
});

test("elapsed exactly 3600 -> gte boundary, not cooling", () => {
  const p = new CooldownPolicy(3600, 86400);
  const r = p.isCoolingDown(new Date(BASE).toISOString(), BASE + 3600 * 1000);
  assert.equal(r.cooldown, false);
  assert.equal(r.operator, "gte");
});

test("elapsed > 86400 -> purge", () => {
  const p = new CooldownPolicy(3600, 86400);
  const r = p.isCoolingDown(new Date(BASE).toISOString(), BASE + 172800 * 1000);
  assert.equal(r.cooldown, false);
  assert.equal(r.purge, true);
});
