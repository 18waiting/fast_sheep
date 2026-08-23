import { test } from "node:test";
import assert from "node:assert/strict";
import { readXianyuMessages } from "../dist/index.js";
import { loadFixture } from "./helpers.ts";

test("messages read in deterministic DOM order with direction", () => {
  const msgs = readXianyuMessages(loadFixture("chat-multiple-messages.html"));
  assert.deepEqual(msgs.map((m) => m.content), ["在吗", "有货吗", "多少钱"]);
  assert.equal(msgs[0].direction, "inbound");
});
