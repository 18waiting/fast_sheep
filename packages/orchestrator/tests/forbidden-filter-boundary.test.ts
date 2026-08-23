import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHarness, decisions, lastDecision } from "./helpers.ts";

test("forbidden filter replaces words at Main pre-send (GF-STORE-FORBID-001)", async () => {
  const { ForbiddenFilter } = await import("../dist/index.js");
  const f = new ForbiddenFilter();
  const words = [{ 违禁词: "微信", 替换为: "" }].map((w) => w.违禁词);
  const out = f.filter("加我微信吧", words);
  assert.equal(out, "加我吧");
});
