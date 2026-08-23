import { test } from "node:test";
import assert from "node:assert/strict";
import { readMessages } from "../dist/dom/message-reader.js";
import { PDD_SELECTOR_PROFILE } from "../dist/selector-profile.js";
import { loadFixture } from "./helpers.ts";

test("multiple messages are read in deterministic DOM order", () => {
  const msgs = readMessages(loadFixture("chat-multiple-messages.html"), PDD_SELECTOR_PROFILE);
  assert.deepEqual(msgs.map((m) => m.content), ["在吗", "有货吗", "多少钱"]);
  assert.deepEqual(msgs.map((m) => m.platform_message_id), ["m1", "m2", "m3"]);
});

test("no reordering by asynchronous completion (sync DOM read)", () => {
  const msgs = readMessages(loadFixture("chat-multiple-messages.html"), PDD_SELECTOR_PROFILE);
  const timestamps = msgs.map((m) => m.timestamp);
  assert.deepEqual(timestamps, [...timestamps].sort(), "timestamps must stay in DOM order");
});

test("same-timestamp messages keep stable DOM tie-breaking", () => {
  const doc = loadFixture("chat-multiple-messages.html");
  const msgs = readMessages(doc, PDD_SELECTOR_PROFILE);
  // DOM order is the stable tie-breaker; ids remain m1,m2,m3.
  assert.deepEqual(msgs.map((m) => m.platform_message_id), ["m1", "m2", "m3"]);
});
