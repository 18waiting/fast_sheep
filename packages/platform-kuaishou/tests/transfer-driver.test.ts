import { test } from "node:test";
import assert from "node:assert/strict";
import { kuaishouExecuteTransfer } from "../dist/index.js";
import { loadFixture } from "./helpers.ts";

test("transfer executes explicit target only (no silent retarget)", () => {
  assert.equal(kuaishouExecuteTransfer(loadFixture("transfer-ready.html"), "售后").executed, true);
  const miss = kuaishouExecuteTransfer(loadFixture("transfer-target-missing.html"), "售后");
  assert.equal(miss.executed, false);
  assert.equal(miss.error, "platform.transfer_target_unavailable");
});
