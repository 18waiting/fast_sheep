import { test } from "node:test";
import assert from "node:assert/strict";
import { detectXianyuHumanReply } from "../dist/index.js";
import { loadFixture } from "./helpers.ts";

test("manual reply detected; automated echo excluded via ack", () => {
  const doc = loadFixture("manual-human-reply.html");
  const now = 1_000_000;
  assert.equal(detectXianyuHumanReply(doc, [], now).isHuman, true);
  assert.equal(detectXianyuHumanReply(doc, [{ message_id: "m2", at_ms: now - 1000 }], now).isHuman, false);
});
