import { test } from "node:test";
import assert from "node:assert/strict";
import { xianyuExecuteTransfer } from "../dist/index.js";
import { loadFixture } from "./helpers.ts";

test("xianyu transfer is reference-unsupported -> capability.unsupported (no fake support)", () => {
  const r = xianyuExecuteTransfer(loadFixture("transfer-unsupported.html"), "售后");
  assert.equal(r.ok, false);
  assert.equal(r.executed, false);
  assert.equal(r.error, "capability.unsupported");
});
