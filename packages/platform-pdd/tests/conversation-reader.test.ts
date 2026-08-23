import { test } from "node:test";
import assert from "node:assert/strict";
import { readConversation, listConversations } from "../dist/dom/conversation-reader.js";
import { PDD_SELECTOR_PROFILE } from "../dist/selector-profile.js";
import { loadFixture } from "./helpers.ts";

test("active conversation is detected", () => {
  const c = readConversation(loadFixture("chat-basic.html"), PDD_SELECTOR_PROFILE);
  assert.equal(c.conversation_id, "c1");
  assert.equal(c.buyer_id, "buyer-1");
});

test("conversation switch fixture exposes the active conversation c2", () => {
  const c = readConversation(loadFixture("conversation-switch.html"), PDD_SELECTOR_PROFILE);
  assert.equal(c.conversation_id, "c2");
  assert.equal(c.buyer_id, "buyer-2");
});

test("listConversations returns all rows with active flag (DOM order)", () => {
  const list = listConversations(loadFixture("conversation-switch.html"), PDD_SELECTOR_PROFILE);
  assert.deepEqual(list.map((x) => x.id), ["c1", "c2"]);
  assert.equal(list[1].active, true);
});

test("no conversation selectors -> null (fails safe)", () => {
  const c = readConversation(loadFixture("dom-unsupported.html"), PDD_SELECTOR_PROFILE);
  assert.equal(c.conversation_id, null);
});
