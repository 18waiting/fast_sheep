import { test } from "node:test";
import assert from "node:assert/strict";
import { detectHumanReply } from "../dist/dom/takeover-detector.js";
import { PDD_SELECTOR_PROFILE } from "../dist/selector-profile.js";
import { readMessages } from "../dist/dom/message-reader.js";
import { loadFixture } from "./helpers.ts";
import type { AutomatedSendAck } from "../dist/types.js";

const NOW = 1_000_000;

test("manual seller reply is detected as human takeover", () => {
  const doc = loadFixture("manual-human-reply.html");
  const msgs = readMessages(doc, PDD_SELECTOR_PROFILE);
  const signal = detectHumanReply(doc, PDD_SELECTOR_PROFILE, msgs, [], NOW);
  assert.equal(signal.isHuman, true);
  assert.equal(signal.message_id, "m2");
});

test("automated send echo is NOT misclassified as takeover", () => {
  const doc = loadFixture("manual-human-reply.html");
  const msgs = readMessages(doc, PDD_SELECTOR_PROFILE);
  const acks: AutomatedSendAck[] = [{ message_id: "m2", at_ms: NOW - 1000 }];
  const signal = detectHumanReply(doc, PDD_SELECTOR_PROFILE, msgs, acks, NOW);
  assert.equal(signal.isHuman, false);
});

test("old automated ack expiry -> deterministic human detection", () => {
  const doc = loadFixture("manual-human-reply.html");
  const msgs = readMessages(doc, PDD_SELECTOR_PROFILE);
  const acks: AutomatedSendAck[] = [{ message_id: "m2", at_ms: NOW - 120_000 }];
  const signal = detectHumanReply(doc, PDD_SELECTOR_PROFILE, msgs, acks, NOW, 60_000);
  assert.equal(signal.isHuman, true, "expired ack must not suppress takeover");
});

test("no outbound rows -> no takeover", () => {
  const doc = loadFixture("chat-basic.html");
  const msgs = readMessages(doc, PDD_SELECTOR_PROFILE);
  const signal = detectHumanReply(doc, PDD_SELECTOR_PROFILE, msgs, [], NOW);
  assert.equal(signal.isHuman, false);
});
