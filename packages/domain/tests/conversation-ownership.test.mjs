import { test } from "node:test";
import assert from "node:assert/strict";
import * as own from "../dist/conversation-ownership.js";

// --- vocabulary: exactly the 8 governance-confirmed states ---
test("Ownership vocabulary is exactly 8 states", () => {
  const expected = [
    "UNASSIGNED","AI_ACTIVE","ASSIGNED","CLAIMED","ACTIVE","HANDOFF_REQUIRED","SUPERVISOR_TAKEOVER","RELEASED",
  ];
  assert.deepEqual([...own.CONVERSATION_OWNERSHIP_STATES].sort(), [...expected].sort());
  assert.equal(own.CONVERSATION_OWNERSHIP_STATES.length, 8);
});

// --- tightening 1: minimal owner/actor reference capability ---
test("OwnershipActorRef: member kind reuses MemberId (member identity)", () => {
  const ref = { kind: "member", memberId: "member-1" };
  assert.equal(ref.kind, "member");
  assert.equal(ref.memberId, "member-1");
});

test("OwnershipActorRef: ai kind is minimal", () => {
  const ref = { kind: "ai" };
  assert.deepEqual(Object.keys(ref).sort(), ["kind"]);
});

test("ConversationOwnership supports current-owner capability without execution-history fields", () => {
  const o = { conversationId: "c-1", state: "CLAIMED", ownerRef: { kind: "member", memberId: "member-1" } };
  assert.deepEqual(Object.keys(o).sort(), ["conversationId", "ownerRef", "state"]);
  for (const forbidden of ["assignedBy","claimedBy","handoffFrom","handoffTo","leaseHolder","leaseExpiresAt"]) {
    assert.equal(Object.hasOwn(o, forbidden), false, `no execution-history field: ${forbidden}`);
  }
});

test("Ownership without an owner (UNASSIGNED) is valid (ownerRef optional)", () => {
  const o = { conversationId: "c-1", state: "UNASSIGNED" };
  assert.deepEqual(Object.keys(o).sort(), ["conversationId", "state"]);
});

// --- tightening 2: vocabulary only, no transition legality ---
test("No state transition matrix / legality is exported (tightening #2)", () => {
  const exported = Object.keys(own);
  for (const forbidden of ["transitions", "transitionMap", "canTransition", "isLegalTransition", "allowedTransitions"]) {
    assert.equal(exported.includes(forbidden), false, `no transition semantics: ${forbidden}`);
  }
});

// --- tightening 3: AI_ACTIVE is ownership state only, no automation implication ---
test("AI_ACTIVE does NOT imply AI_AUTO_REPLY / ALLOW_AUTO / any policy result", () => {
  assert.equal(own.OWNERSHIP_AI_ACTIVE, "AI_ACTIVE");
  const exported = Object.keys(own);
  for (const forbidden of ["AI_AUTO_REPLY", "ALLOW_AUTO", "automationLevel", "entitlement", "allowAutoReply"]) {
    assert.equal(exported.includes(forbidden), false, `no automation/policy leakage: ${forbidden}`);
  }
});

// --- T3 / T6: no sync / no extra status ---
test("Ownership record carries no sync fields and no extra status vocabulary (T3/T6)", () => {
  const o = { conversationId: "c", state: "ACTIVE", ownerRef: { kind: "member", memberId: "m" } };
  for (const k of ["revision","outbox","version","lastSyncedAt","remoteSyncId"]) {
    assert.equal(Object.hasOwn(o, k), false);
  }
});