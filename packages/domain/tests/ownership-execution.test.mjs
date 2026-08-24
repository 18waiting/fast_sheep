import { test } from "node:test";
import assert from "node:assert/strict";
import * as oe from "../dist/ownership-execution.js";

// --- action -> target-state semantics (no authority) ---
test("claim by member -> CLAIMED (owner=actor)", () => {
  const t = oe.targetOwnershipFor({ action: "claim", actor: { kind: "member", memberId: "m1" } });
  assert.deepEqual(t, { state: "CLAIMED", ownerRef: { kind: "member", memberId: "m1" } });
});

test("claim by ai -> AI_ACTIVE (owner=actor)", () => {
  const t = oe.targetOwnershipFor({ action: "claim", actor: { kind: "ai" } });
  assert.deepEqual(t, { state: "AI_ACTIVE", ownerRef: { kind: "ai" } });
});

test("release -> RELEASED (no owner)", () => {
  const t = oe.targetOwnershipFor({ action: "release", actor: { kind: "member", memberId: "m1" } });
  assert.deepEqual(t, { state: "RELEASED" });
});

test("handoff -> ASSIGNED to target member", () => {
  const t = oe.targetOwnershipFor({ action: "handoff", actor: { kind: "member", memberId: "m1" }, targetMemberId: "m2" });
  assert.deepEqual(t, { state: "ASSIGNED", ownerRef: { kind: "member", memberId: "m2" } });
});

test("supervisor_takeover -> SUPERVISOR_TAKEOVER (action semantics only)", () => {
  const t = oe.targetOwnershipFor({ action: "supervisor_takeover", actor: { kind: "member", memberId: "sup1" } });
  assert.deepEqual(t, { state: "SUPERVISOR_TAKEOVER", ownerRef: { kind: "member", memberId: "sup1" } });
});

test("handoff without target -> generic error (malformed request, not authority)", () => {
  assert.throws(() => oe.targetOwnershipFor({ action: "handoff", actor: { kind: "member", memberId: "m1" } }),
    (e) => e instanceof oe.OwnershipExecutionError && e.message.includes("handoff requires a target member"));
});

// --- Actor != Authority: no permission/authority engine ---
test("module exports NO authority validation / permission engine", () => {
  const exports = Object.keys(oe);
  for (const name of ["canClaim","canRelease","canHandoff","canTakeover","authorize","hasPermission","validateAuthority","requireCapability","isAuthorized"]) {
    assert.equal(exports.includes(name), false, `no authority/permission fn: ${name}`);
  }
});

// --- Actor identity isolated from authority capability (SHEEP-012) ---
test("actor identity and authority capability stay isolated (no Capability/ResourceScope reference)", () => {
  const exports = Object.keys(oe);
  for (const name of ["CapabilityId","ResourceScope","RoleCapabilitySet","capabilities","requireCapability"]) {
    assert.equal(exports.includes(name), false, `no SHEEP-012 coupling: ${name}`);
  }
});

// --- no role=supervisor auto-authority logic ---
test("no role=supervisor automatic takeover logic (supervisor_takeover is an action, not a role grant)", () => {
  const exports = Object.keys(oe);
  for (const name of ["ROLE_SUPERVISOR","SUPERVISOR_ROLE","roleSupervisor","isSupervisor","role"]) {
    assert.equal(exports.includes(name), false, `no role hardcode: ${name}`);
  }
  // action works for ANY member actor without any role check
  const t = oe.targetOwnershipFor({ action: "supervisor_takeover", actor: { kind: "member", memberId: "anyone" } });
  assert.equal(t.state, "SUPERVISOR_TAKEOVER");
});

// --- AI_ACTIVE is state only, no automation ---
test("no automation/entitlement leakage from AI_ACTIVE", () => {
  const exports = Object.keys(oe);
  for (const name of ["AI_AUTO_REPLY","ALLOW_AUTO","automationLevel","entitlement","allowAutoReply"]) {
    assert.equal(exports.includes(name), false, `no automation leakage: ${name}`);
  }
});

// --- no transition matrix / canTransition / all-state combos ---
test("no full transition engine (only 4 action->target mappings)", () => {
  const exports = Object.keys(oe);
  for (const name of ["canTransition","transitionMap","transitions","allowedTransitions","nextStates"]) {
    assert.equal(exports.includes(name), false, `no transition engine: ${name}`);
  }
  // exactly the 4 confirmed actions exist as a union; module exports no state-combination rules
  for (const a of ["claim","release","handoff","supervisor_takeover"]) {
    const t = oe.targetOwnershipFor({ action: a, actor: { kind: "member", memberId: "x" }, ...(a === "handoff" ? { targetMemberId: "y" } : {}) });
    assert.ok(["CLAIMED","RELEASED","ASSIGNED","SUPERVISOR_TAKEOVER"].includes(t.state));
  }
});

// --- lease / cloud / reconciliation / presence DEFERRED (not present) ---
test("no lease/expiry/cloud/reconciliation/presence fields or functions", () => {
  const exports = Object.keys(oe);
  for (const name of ["lease","leaseDuration","leaseRefresh","expiry","cloudAuthority","reconcile","reconciliation","presence"]) {
    assert.equal(exports.includes(name), false, `no deferred concern: ${name}`);
  }
});