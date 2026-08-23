import { test } from "node:test";
import assert from "node:assert/strict";
import { readMessages } from "../dist/dom/message-reader.js";
import { PDD_SELECTOR_PROFILE } from "../dist/selector-profile.js";
import { loadFixture } from "./helpers.ts";

test("message-reader extracts inbound messages with content", () => {
  const msgs = readMessages(loadFixture("chat-basic.html"), PDD_SELECTOR_PROFILE);
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].content, "有货吗");
  assert.equal(msgs[0].unread, false);
});

test("message rows without content are skipped", () => {
  const msgs = readMessages(loadFixture("dom-unsupported.html"), PDD_SELECTOR_PROFILE);
  assert.deepEqual(msgs, []);
});
