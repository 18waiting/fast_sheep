// SHEEP-305 Lane B focused tests — registry: scope isolation, idempotency, snapshots, lifecycle rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canTransition,
  createShippingPolicyRegistry,
} from "../dist/main/services/shipping-policy-registry.js";

const SCOPE_A = { merchantId: "merchant-synth-a", storeId: "store-synth-a", platformAccountId: null };
const SCOPE_B = { merchantId: "merchant-synth-a", storeId: "store-synth-b", platformAccountId: null };
const SYNTHETIC = "SYNTHETIC_TEST_ASSUMPTION";

function declaration(scope = SCOPE_A, overrides = {}) {
  return { scope, platform: "pdd", ownerDeclaredIdentifier: "SYNTHETIC-SHOP-NAME", basisRef: SYNTHETIC + "://owner-message/1", declaredAt: "2026-09-23", ...overrides };
}
function policyInput(scope = SCOPE_A, overrides = {}) {
  return {
    scope, policyId: "policy-synth", policyVersion: "1",
    quotedText: "SYNTHETIC owner text (test assumption)",
    structuredItems: [{ item: "nature", value: "EXPECTED" }, { item: "time_value", value: "CONTINUOUS_HOURS_48" }],
    basisRef: SYNTHETIC + "://owner-message/2", registeredAt: "2026-09-23", ...overrides,
  };
}

test("lane B area 1: the registry starts empty and stays in-memory only", () => {
  const registry = createShippingPolicyRegistry();
  assert.deepEqual(registry.list(SCOPE_A), []);
  const diagnostics = registry.diagnostics();
  assert.equal(diagnostics.records, 0);
  assert.equal(diagnostics.declarations, 0);
  assert.equal(diagnostics.policyVersions, 0);
  assert.equal(diagnostics.registrations, 0);
});

test("lane B area 2: the Owner declaration keeps the raw identifier, its source and the evidence reference", () => {
  const registry = createShippingPolicyRegistry();
  const result = registry.registerOwnerIdentityDeclaration(declaration());
  assert.equal(result.status, "REGISTERED");
  const stored = registry.get(result.registration_id, SCOPE_A);
  assert.equal(stored.ok, true);
  assert.equal(stored.record.kind, "OWNER_IDENTITY_DECLARATION");
  assert.equal(stored.record.owner_declared_identifier, "SYNTHETIC-SHOP-NAME");
  assert.equal(stored.record.identifier_source, "OWNER_DECLARED");
  assert.equal(stored.record.platform_binding, "UNVERIFIED");
  assert.equal(stored.record.basis_ref, SYNTHETIC + "://owner-message/1");
  assert.equal(stored.record.lifecycle, "DRAFT");
});

test("lane B area 3: an identical shop name in another scope is a separate declaration (never auto-merged)", () => {
  const registry = createShippingPolicyRegistry();
  const first = registry.registerOwnerIdentityDeclaration(declaration(SCOPE_A));
  const second = registry.registerOwnerIdentityDeclaration(declaration(SCOPE_B));
  assert.notEqual(first.registration_id, second.registration_id);
  assert.equal(registry.list(SCOPE_A).length, 1);
  assert.equal(registry.list(SCOPE_B).length, 1);
  // reading across scopes is refused
  const crossRead = registry.get(first.registration_id, SCOPE_B);
  assert.equal(crossRead.ok, false);
  assert.equal(crossRead.reason, "SCOPE_MISMATCH");
});

test("lane B area 4/5: no API promotes a declaration to VERIFIED or a policy to ACTIVE", () => {
  const registry = createShippingPolicyRegistry();
  assert.deepEqual(Object.keys(registry).sort(), ["diagnostics", "get", "linkReplacement", "list", "registerOwnerIdentityDeclaration", "registerPolicyVersion", "revoke"]);
  const surface = Object.keys(registry).join(" ");
  for (const forbidden of ["verify", "promote", "activate", "force", "confirm", "approve"]) {
    assert.equal(surface.includes(forbidden), false, "no " + forbidden + " entry point may exist");
  }
  const registered = registry.registerPolicyVersion(policyInput());
  const stored = registry.get(registered.registration_id, SCOPE_A);
  assert.equal(stored.record.lifecycle, "DRAFT");
  assert.equal(registry.diagnostics().records, 1);
});

test("lane B area 6: identical resubmission is idempotent; same id/version with different content is refused", () => {
  const registry = createShippingPolicyRegistry();
  const first = registry.registerPolicyVersion(policyInput());
  const again = registry.registerPolicyVersion(policyInput());
  assert.equal(again.status, "IDEMPOTENT");
  assert.equal(again.registration_id, first.registration_id);
  assert.equal(registry.diagnostics().records, 1);
  const conflicting = registry.registerPolicyVersion(policyInput(SCOPE_A, { quotedText: "SYNTHETIC different text" }));
  assert.equal(conflicting.status, "REJECTED");
  assert.equal(conflicting.reason, "CONTENT_CONFLICT");
  assert.equal(registry.diagnostics().records, 1, "no silent overwrite happened");
  const versionBump = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "2" }));
  assert.equal(versionBump.status, "REGISTERED");
  assert.equal(registry.diagnostics().records, 2);
});

test("lane B area 6b: a declaration with the same identity but conflicting evidence is refused (no silent rewrite)", () => {
  const registry = createShippingPolicyRegistry();
  registry.registerOwnerIdentityDeclaration(declaration());
  const conflict = registry.registerOwnerIdentityDeclaration(declaration(SCOPE_A, { basisRef: SYNTHETIC + "://owner-message/other" }));
  assert.equal(conflict.status, "REJECTED");
  assert.equal(conflict.reason, "DECLARATION_CONFLICT");
  assert.equal(registry.diagnostics().declarations, 1);
});

test("lane B area 7: cross-scope revoke and replacement are refused", () => {
  const registry = createShippingPolicyRegistry();
  const a = registry.registerPolicyVersion(policyInput(SCOPE_A));
  const b = registry.registerPolicyVersion(policyInput(SCOPE_B));
  const crossRevoke = registry.revoke(a.registration_id, SCOPE_B, "SYNTHETIC");
  assert.equal(crossRevoke.status, "REJECTED");
  assert.equal(crossRevoke.reason, "SCOPE_MISMATCH");
  const crossLink = registry.linkReplacement({ newRegistrationId: b.registration_id, oldRegistrationId: a.registration_id, scope: SCOPE_B });
  assert.equal(crossLink.status, "REJECTED");
  assert.equal(crossLink.reason, "REPLACEMENT_SCOPE_MISMATCH");
  assert.equal(registry.get(a.registration_id, SCOPE_A).record.replaces_registration_id, null, "the cross-scope link changed nothing");
});

test("lane B area 8: replacement direction, self-reference, cycles and old-version protection", () => {
  const registry = createShippingPolicyRegistry();
  const v1 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "1" }));
  const v2 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "2" }));
  assert.equal(registry.linkReplacement({ newRegistrationId: v2.registration_id, oldRegistrationId: v2.registration_id, scope: SCOPE_A }).reason, "REPLACEMENT_SELF_REFERENCE");
  assert.equal(registry.linkReplacement({ newRegistrationId: v2.registration_id, oldRegistrationId: "reg-does-not-exist", scope: SCOPE_A }).reason, "REPLACEMENT_TARGET_NOT_FOUND");
  const linked = registry.linkReplacement({ newRegistrationId: v2.registration_id, oldRegistrationId: v1.registration_id, scope: SCOPE_A });
  assert.equal(linked.status, "REGISTERED");
  assert.equal(registry.get(v2.registration_id, SCOPE_A).record.replaces_registration_id, v1.registration_id);
  // creating the replacement draft must NOT supersede or revoke the older version
  assert.equal(registry.get(v1.registration_id, SCOPE_A).record.lifecycle, "DRAFT");
  // reverse direction creates a cycle and must be refused
  const cycle = registry.linkReplacement({ newRegistrationId: v1.registration_id, oldRegistrationId: v2.registration_id, scope: SCOPE_A });
  assert.equal(cycle.status, "REJECTED");
  assert.equal(cycle.reason, "REPLACEMENT_CYCLE");
  assert.equal(registry.get(v1.registration_id, SCOPE_A).record.replaces_registration_id, null);
});

test("lane B area 8b: lifecycle transitions are a pure rule (ACTIVE -> SUPERSEDED/REVOKED tested without any activation API)", () => {
  assert.equal(canTransition("DRAFT", "NOT_EFFECTIVE"), true);
  assert.equal(canTransition("NOT_EFFECTIVE", "ACTIVE"), true, "the rule allows it; the registry exposes no way to reach it");
  assert.equal(canTransition("ACTIVE", "SUPERSEDED"), true);
  assert.equal(canTransition("ACTIVE", "REVOKED"), true);
  assert.equal(canTransition("SUPERSEDED", "ACTIVE"), false);
  assert.equal(canTransition("REVOKED", "ACTIVE"), false);
  assert.equal(canTransition("DRAFT", "SUPERSEDED"), false);
  const registry = createShippingPolicyRegistry();
  assert.equal(typeof registry["activate"], "undefined");
});

test("lane B area 9: mutating the input or a query result never changes internal state", () => {
  const registry = createShippingPolicyRegistry();
  const input = policyInput();
  const registered = registry.registerPolicyVersion(input);
  input.quotedText = "MUTATED AFTER REGISTRATION";
  input.structuredItems.push({ item: "nature", value: "COMMITTED" });
  const stored = registry.get(registered.registration_id, SCOPE_A);
  assert.equal(stored.record.content_approval.quoted_text, "SYNTHETIC owner text (test assumption)");
  assert.equal(stored.record.structured_items.length, 2);
  // results are copies: mutating them is refused (frozen) and cannot leak back
  assert.equal(Object.isFrozen(stored.record), true);
  const list = registry.list(SCOPE_A);
  assert.equal(Object.isFrozen(list), true);
  assert.equal(Object.isFrozen(list[0]), true);
  assert.throws(() => { stored.record.policy_version = "999"; }, TypeError);
  assert.equal(registry.get(registered.registration_id, SCOPE_A).record.policy_version, "1");
});

test("lane B area 12: a rebuilt registry instance is empty (no persistence, no cross-instance state)", () => {
  const first = createShippingPolicyRegistry();
  first.registerPolicyVersion(policyInput());
  assert.equal(first.diagnostics().records, 1);
  const second = createShippingPolicyRegistry();
  assert.equal(second.diagnostics().records, 0);
  assert.deepEqual(second.list(SCOPE_A), []);
});

test("lane B area 13: no side-effect ports, no database/network wiring, counters labelled as invariants", () => {
  const registry = createShippingPolicyRegistry();
  const diagnostics = registry.diagnostics();
  assert.equal(diagnostics.aiCalls, 0);
  assert.equal(diagnostics.sendCalls, 0);
  assert.equal(diagnostics.persistenceWrites, 0);
  assert.equal(diagnostics.providerCalls, 0);
  assert.equal(diagnostics.networkCalls, 0);
  assert.equal(diagnostics.sideEffectGuarantee, "STRUCTURAL_INVARIANT_NOT_A_RUNTIME_MEASUREMENT");
  // scope handling is explicit: an unbound scope cannot register or list anything
  const unbound = { merchantId: null, storeId: null, platformAccountId: null };
  assert.equal(registry.registerPolicyVersion(policyInput(unbound)).reason, "SCOPE_UNBOUND");
  assert.equal(registry.registerOwnerIdentityDeclaration(declaration(unbound)).reason, "SCOPE_UNBOUND");
  assert.deepEqual(registry.list(unbound), []);
});

test("lane B: revoking a not-yet-effective registration is allowed, repeating it is refused", () => {
  const registry = createShippingPolicyRegistry();
  const registered = registry.registerPolicyVersion(policyInput());
  assert.equal(registry.revoke(registered.registration_id, SCOPE_A, SYNTHETIC + ":controlled-revoke").status, "REVOKED");
  assert.equal(registry.get(registered.registration_id, SCOPE_A).record.lifecycle, "REVOKED");
  assert.equal(registry.revoke(registered.registration_id, SCOPE_A, SYNTHETIC).reason, "ALREADY_REVOKED");
  assert.equal(registry.diagnostics().revocations, 1);
});

// --- Lane B fix regressions: replacement integrity + semantic equality -----------------------

test("fix area 1/2: linking is refused when either endpoint is REVOKED", () => {
  const registry = createShippingPolicyRegistry();
  const v1 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "1" }));
  const v2 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "2" }));
  // target revoked
  assert.equal(registry.revoke(v1.registration_id, SCOPE_A, SYNTHETIC).status, "REVOKED");
  const toRevoked = registry.linkReplacement({ newRegistrationId: v2.registration_id, oldRegistrationId: v1.registration_id, scope: SCOPE_A });
  assert.equal(toRevoked.status, "REJECTED");
  assert.equal(toRevoked.reason, "REPLACEMENT_TARGET_REVOKED");
  // source revoked
  const v3 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "3" }));
  assert.equal(registry.revoke(v3.registration_id, SCOPE_A, SYNTHETIC).status, "REVOKED");
  const fromRevoked = registry.linkReplacement({ newRegistrationId: v3.registration_id, oldRegistrationId: v2.registration_id, scope: SCOPE_A });
  assert.equal(fromRevoked.status, "REJECTED");
  assert.equal(fromRevoked.reason, "REPLACEMENT_SOURCE_REVOKED");
  assert.equal(registry.get(v2.registration_id, SCOPE_A).record.replaces_registration_id, null, "no partial write happened");
});

test("fix area 3: after linking, revoking an endpoint makes the relation non-effective (history kept, no revival)", () => {
  const registry = createShippingPolicyRegistry();
  const v1 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "1" }));
  const v2 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "2" }));
  assert.equal(registry.linkReplacement({ newRegistrationId: v2.registration_id, oldRegistrationId: v1.registration_id, scope: SCOPE_A }).status, "REGISTERED");
  let view = registry.get(v2.registration_id, SCOPE_A).record;
  assert.equal(view.replaces_relation.valid, true);
  assert.equal(view.replaces_relation.invalid_reason, null);
  assert.equal(view.replaces_relation.target_registration_id, v1.registration_id);
  // revoke the target: the historical pointer stays for audit, validity flips
  assert.equal(registry.revoke(v1.registration_id, SCOPE_A, SYNTHETIC).status, "REVOKED");
  view = registry.get(v2.registration_id, SCOPE_A).record;
  assert.equal(view.replaces_registration_id, v1.registration_id, "the historical relation is preserved");
  assert.equal(view.replaces_relation.valid, false);
  assert.equal(view.replaces_relation.invalid_reason, "ENDPOINT_REVOKED");
  assert.equal(view.lifecycle, "DRAFT", "no automatic supersede and no resurrection of the other version");
  // and the relation cannot be re-pointed at the revoked record
  assert.equal(registry.linkReplacement({ newRegistrationId: v2.registration_id, oldRegistrationId: v1.registration_id, scope: SCOPE_A }).reason, "REPLACEMENT_TARGET_REVOKED");
});

test("fix area 4: cross policy_id replacement is refused (same family required)", () => {
  const registry = createShippingPolicyRegistry();
  const familyA = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyId: "family-A", policyVersion: "1" }));
  const familyB = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyId: "family-B", policyVersion: "1" }));
  const cross = registry.linkReplacement({ newRegistrationId: familyB.registration_id, oldRegistrationId: familyA.registration_id, scope: SCOPE_A });
  assert.equal(cross.status, "REJECTED");
  assert.equal(cross.reason, "REPLACEMENT_POLICY_MISMATCH");
  assert.equal(registry.get(familyB.registration_id, SCOPE_A).record.replaces_registration_id, null);
});

test("fix area 5: a rejected link request changes no record and no relation", () => {
  const registry = createShippingPolicyRegistry();
  const v1 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "1" }));
  const v2 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "2" }));
  const before = JSON.stringify({ v1: registry.get(v1.registration_id, SCOPE_A), v2: registry.get(v2.registration_id, SCOPE_A) });
  assert.equal(registry.linkReplacement({ newRegistrationId: v2.registration_id, oldRegistrationId: v2.registration_id, scope: SCOPE_A }).status, "REJECTED");
  assert.equal(registry.linkReplacement({ newRegistrationId: "nope", oldRegistrationId: v1.registration_id, scope: SCOPE_A }).status, "REJECTED");
  const otherFamily = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyId: "other-family", policyVersion: "1" }));
  assert.equal(registry.linkReplacement({ newRegistrationId: otherFamily.registration_id, oldRegistrationId: v1.registration_id, scope: SCOPE_A }).status, "REJECTED");
  const after = JSON.stringify({ v1: registry.get(v1.registration_id, SCOPE_A), v2: registry.get(v2.registration_id, SCOPE_A) });
  assert.equal(after, before, "rejections must not produce partial writes");
  const diagnostics = registry.diagnostics();
  assert.equal(diagnostics.registrations, 3, "the only writes are the three registrations the test itself made");
  assert.equal(diagnostics.records, 3, "no record was created by a rejected request");
  assert.equal(diagnostics.rejections, 3, "each rejected request was recorded and nothing else was written");
  assert.equal(diagnostics.revocations, 0, "no lifecycle change happened as a side effect");
  assert.equal(registry.get(otherFamily.registration_id, SCOPE_A).record.replaces_registration_id, null, "the rejected cross-family link left no relation");
});

test("fix area 6/7: object-key order and unordered structured_items order do not affect idempotency", () => {
  const registry = createShippingPolicyRegistry();
  const first = registry.registerPolicyVersion(policyInput(SCOPE_A, { structuredItems: [{ item: "nature", value: "EXPECTED" }, { item: "time_value", value: "CONTINUOUS_HOURS_48" }] }));
  const reorderedArray = registry.registerPolicyVersion(policyInput(SCOPE_A, { structuredItems: [{ item: "time_value", value: "CONTINUOUS_HOURS_48" }, { item: "nature", value: "EXPECTED" }] }));
  assert.equal(reorderedArray.status, "IDEMPOTENT");
  assert.equal(reorderedArray.registration_id, first.registration_id);
  const reorderedKeys = registry.registerPolicyVersion(policyInput(SCOPE_A, { structuredItems: [{ value: "EXPECTED", item: "nature" }, { value: "CONTINUOUS_HOURS_48", item: "time_value" }] }));
  assert.equal(reorderedKeys.status, "IDEMPOTENT");
  assert.equal(reorderedKeys.registration_id, first.registration_id);
  assert.equal(registry.diagnostics().records, 1);
});

test("fix area 8: a real content change is still CONTENT_CONFLICT", () => {
  const registry = createShippingPolicyRegistry();
  registry.registerPolicyVersion(policyInput(SCOPE_A, { structuredItems: [{ item: "nature", value: "EXPECTED" }] }));
  const changedValue = registry.registerPolicyVersion(policyInput(SCOPE_A, { structuredItems: [{ item: "nature", value: "COMMITTED" }] }));
  assert.equal(changedValue.reason, "CONTENT_CONFLICT");
  const changedText = registry.registerPolicyVersion(policyInput(SCOPE_A, { quotedText: "SYNTHETIC owner text (test assumption) v2", structuredItems: [{ item: "nature", value: "EXPECTED" }] }));
  assert.equal(changedText.reason, "CONTENT_CONFLICT");
  const changedBasis = registry.registerPolicyVersion(policyInput(SCOPE_A, { basisRef: SYNTHETIC + "://other", structuredItems: [{ item: "nature", value: "EXPECTED" }] }));
  assert.equal(changedBasis.reason, "CONTENT_CONFLICT");
  assert.equal(registry.diagnostics().records, 1);
});

test("fix area 9: duplicate structured_items keys are refused with the same or a different value", () => {
  const registry = createShippingPolicyRegistry();
  const sameValue = registry.registerPolicyVersion(policyInput(SCOPE_A, { structuredItems: [{ item: "nature", value: "EXPECTED" }, { item: "nature", value: "EXPECTED" }] }));
  assert.equal(sameValue.status, "REJECTED");
  assert.equal(sameValue.reason, "STRUCTURED_ITEMS_INVALID");
  const differentValue = registry.registerPolicyVersion(policyInput(SCOPE_A, { structuredItems: [{ item: "nature", value: "EXPECTED" }, { item: "nature", value: "COMMITTED" }] }));
  assert.equal(differentValue.status, "REJECTED");
  assert.equal(differentValue.reason, "STRUCTURED_ITEMS_INVALID");
  assert.equal(registry.diagnostics().records, 0, "a rejected intake registers nothing");
});

test("fix area 10: replaying a revoked registration returns the same REVOKED record with its lifecycle reported", () => {
  const registry = createShippingPolicyRegistry();
  const registered = registry.registerPolicyVersion(policyInput());
  assert.equal(registered.lifecycle, "DRAFT");
  assert.equal(registry.revoke(registered.registration_id, SCOPE_A, SYNTHETIC).status, "REVOKED");
  const replay = registry.registerPolicyVersion(policyInput());
  assert.equal(replay.status, "IDEMPOTENT");
  assert.equal(replay.registration_id, registered.registration_id);
  assert.equal(replay.lifecycle, "REVOKED", "the result must not read as an active draft");
  assert.equal(registry.get(registered.registration_id, SCOPE_A).record.lifecycle, "REVOKED");
  assert.equal(registry.diagnostics().records, 1, "no new record and no resurrection");
});

test("fix: linking after a revocation-free link keeps the relation and never resets lifecycles on replay", () => {
  const registry = createShippingPolicyRegistry();
  const v1 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "1" }));
  const v2 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "2" }));
  registry.linkReplacement({ newRegistrationId: v2.registration_id, oldRegistrationId: v1.registration_id, scope: SCOPE_A });
  const replayV2 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "2" }));
  assert.equal(replayV2.status, "IDEMPOTENT");
  const view = registry.get(v2.registration_id, SCOPE_A).record;
  assert.equal(view.replaces_registration_id, v1.registration_id, "the replay did not overwrite the relation");
  assert.equal(view.lifecycle, "DRAFT");
  assert.equal(registry.get(v1.registration_id, SCOPE_A).record.lifecycle, "DRAFT", "the older version keeps its lifecycle");
});

// --- Scope isolation regressions: unambiguous scope identity -----------------------------------

const SENTINEL_ACCOUNT = { merchantId: "merchant-synth-a", storeId: "store-synth-a", platformAccountId: "<none>" };
const EMPTY_ACCOUNT = { merchantId: "merchant-synth-a", storeId: "store-synth-a", platformAccountId: "" };
const NUL_X = { merchantId: "merchant-synth-a", storeId: "store-synth-a", platformAccountId: "acct\u0000b" };
const NUL_Y = { merchantId: "merchant-synth-a", storeId: "store-synth-a\u0000acct", platformAccountId: "b" };
const QUOTED = { merchantId: "merchant-\"synth\"", storeId: "store-\\synth", platformAccountId: "acct/with:separators|and,commas" };
const QUOTED_NEIGHBOUR = { merchantId: "merchant-\"synth\"", storeId: "store-\\synth", platformAccountId: "acct/with:separators|and,commas\u0000" };

test("isolation 1: the two reproduced NUL-collision scopes are separate for every operation", () => {
  const registry = createShippingPolicyRegistry();
  const x = registry.registerPolicyVersion(policyInput(NUL_X, { policyId: "policy-nul" }));
  const y = registry.registerPolicyVersion(policyInput(NUL_Y, { policyId: "policy-nul" }));
  assert.equal(x.status, "REGISTERED");
  assert.equal(y.status, "REGISTERED");
  assert.notEqual(x.registration_id, y.registration_id, "the two crafted scopes are not one scope");
  assert.equal(registry.get(x.registration_id, NUL_Y).ok, false);
  assert.equal(registry.get(x.registration_id, NUL_Y).reason, "SCOPE_MISMATCH");
  assert.equal(registry.get(y.registration_id, NUL_X).reason, "SCOPE_MISMATCH");
  assert.deepEqual(registry.list(NUL_X).map((record) => record.registration_id), [x.registration_id]);
  assert.deepEqual(registry.list(NUL_Y).map((record) => record.registration_id), [y.registration_id]);
  assert.equal(registry.revoke(x.registration_id, NUL_Y, SYNTHETIC).reason, "SCOPE_MISMATCH");
  assert.equal(registry.get(x.registration_id, NUL_X).record.lifecycle, "DRAFT");
  assert.equal(registry.diagnostics().revocations, 0);
  const crossLink = registry.linkReplacement({ newRegistrationId: y.registration_id, oldRegistrationId: x.registration_id, scope: NUL_X });
  assert.equal(crossLink.status, "REJECTED");
  assert.equal(crossLink.reason, "SCOPE_MISMATCH");
  assert.equal(registry.get(y.registration_id, NUL_Y).record.replaces_registration_id, null);
  assert.equal(registry.get(x.registration_id, NUL_X).record.replaces_registration_id, null);
});

test("isolation 2: account=null and account=empty-string are different scopes (never merged)", () => {
  const registry = createShippingPolicyRegistry();
  const unbound = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyId: "policy-acct" }));
  const empty = registry.registerPolicyVersion(policyInput(EMPTY_ACCOUNT, { policyId: "policy-acct" }));
  assert.equal(unbound.status, "REGISTERED");
  assert.equal(empty.status, "REGISTERED");
  assert.notEqual(unbound.registration_id, empty.registration_id);
  assert.equal(registry.get(unbound.registration_id, EMPTY_ACCOUNT).reason, "SCOPE_MISMATCH");
  assert.equal(registry.get(empty.registration_id, SCOPE_A).reason, "SCOPE_MISMATCH");
  assert.deepEqual(registry.list(SCOPE_A).map((record) => record.registration_id), [unbound.registration_id]);
  assert.deepEqual(registry.list(EMPTY_ACCOUNT).map((record) => record.registration_id), [empty.registration_id]);
  assert.equal(registry.revoke(empty.registration_id, SCOPE_A, SYNTHETIC).reason, "SCOPE_MISMATCH");
  assert.equal(registry.get(empty.registration_id, EMPTY_ACCOUNT).record.lifecycle, "DRAFT");
});

test("isolation 3: the old sentinel, and identifiers with quotes/backslashes/separators, are distinct scopes", () => {
  const registry = createShippingPolicyRegistry();
  const nullAccount = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyId: "policy-probe" }));
  const sentinel = registry.registerPolicyVersion(policyInput(SENTINEL_ACCOUNT, { policyId: "policy-probe" }));
  const quoted = registry.registerPolicyVersion(policyInput(QUOTED, { policyId: "policy-probe" }));
  const neighbour = registry.registerPolicyVersion(policyInput(QUOTED_NEIGHBOUR, { policyId: "policy-probe" }));
  assert.equal(registry.diagnostics().records, 4, "four distinct scopes create four records");
  assert.equal(registry.get(nullAccount.registration_id, SCOPE_A).ok, true);
  assert.equal(registry.get(sentinel.registration_id, SENTINEL_ACCOUNT).ok, true);
  assert.equal(registry.get(quoted.registration_id, QUOTED).ok, true);
  assert.equal(registry.get(neighbour.registration_id, QUOTED_NEIGHBOUR).ok, true);
  assert.equal(registry.get(nullAccount.registration_id, SENTINEL_ACCOUNT).reason, "SCOPE_MISMATCH", "\"<none>\" is an account value, not the absent-account marker");
  assert.equal(registry.get(sentinel.registration_id, SCOPE_A).reason, "SCOPE_MISMATCH");
  assert.equal(registry.get(quoted.registration_id, QUOTED_NEIGHBOUR).reason, "SCOPE_MISMATCH");
  assert.equal(registry.get(neighbour.registration_id, QUOTED).reason, "SCOPE_MISMATCH");
});

test("isolation 4: the same scope still resolves idempotently, and an omitted account equals the absent account", () => {
  const registry = createShippingPolicyRegistry();
  const first = registry.registerPolicyVersion(policyInput(SCOPE_A));
  assert.equal(registry.registerPolicyVersion(policyInput(SCOPE_A)).status, "IDEMPOTENT");
  assert.equal(registry.get(first.registration_id, SCOPE_A).ok, true);
  assert.equal(registry.list(SCOPE_A).length, 1);
  const rebuiltWithoutAccount = { merchantId: SCOPE_A.merchantId, storeId: SCOPE_A.storeId };
  assert.equal(registry.get(first.registration_id, rebuiltWithoutAccount).ok, true, "an omitted account is the absent account");
  assert.equal(registry.registerPolicyVersion(policyInput(rebuiltWithoutAccount)).status, "IDEMPOTENT");
  assert.equal(registry.diagnostics().records, 1);
  // unbound scopes are still refused, never silently encoded into a key
  assert.equal(registry.registerPolicyVersion(policyInput({ merchantId: "", storeId: SCOPE_A.storeId, platformAccountId: null })).reason, "SCOPE_UNBOUND");
  assert.equal(registry.get(first.registration_id, { merchantId: SCOPE_A.merchantId, storeId: "", platformAccountId: null }).reason, "SCOPE_UNBOUND");
});

test("isolation 5: get/list never return another scope's record", () => {
  const registry = createShippingPolicyRegistry();
  const scopes = [SCOPE_A, SCOPE_B, EMPTY_ACCOUNT, SENTINEL_ACCOUNT, NUL_X, NUL_Y, QUOTED, QUOTED_NEIGHBOUR];
  const created = scopes.map((scope, index) => registry.registerPolicyVersion(policyInput(scope, { policyId: "policy-matrix", policyVersion: String(index + 1) })));
  assert.equal(registry.diagnostics().records, scopes.length);
  scopes.forEach((scope, index) => {
    assert.deepEqual(registry.list(scope).map((record) => record.registration_id), [created[index].registration_id], "each scope lists exactly its own record");
    assert.equal(registry.list(scope)[0].scope.platformAccountId ?? null, scope.platformAccountId ?? null);
    scopes.forEach((other, otherIndex) => {
      if (otherIndex === index) return;
      const crossRead = registry.get(created[otherIndex].registration_id, scope);
      assert.equal(crossRead.ok, false);
      assert.equal(crossRead.reason, "SCOPE_MISMATCH");
    });
  });
});

test("isolation 6: revoke and linkReplacement from another scope change nothing", () => {
  const registry = createShippingPolicyRegistry();
  const a = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "1" }));
  const b = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "2" }));
  const foreign = registry.registerPolicyVersion(policyInput(SCOPE_B, { policyVersion: "1" }));
  const snapshot = () => JSON.stringify([registry.get(a.registration_id, SCOPE_A), registry.get(b.registration_id, SCOPE_A), registry.get(foreign.registration_id, SCOPE_B)]);
  const before = snapshot();
  assert.equal(registry.revoke(a.registration_id, SCOPE_B, SYNTHETIC).reason, "SCOPE_MISMATCH");
  assert.equal(registry.linkReplacement({ newRegistrationId: foreign.registration_id, oldRegistrationId: a.registration_id, scope: SCOPE_B }).reason, "REPLACEMENT_SCOPE_MISMATCH");
  assert.equal(registry.linkReplacement({ newRegistrationId: b.registration_id, oldRegistrationId: foreign.registration_id, scope: SCOPE_A }).reason, "REPLACEMENT_SCOPE_MISMATCH");
  assert.equal(snapshot(), before, "cross-scope requests changed no record");
  assert.equal(registry.diagnostics().revocations, 0);
  assert.equal(registry.get(a.registration_id, SCOPE_A).record.lifecycle, "DRAFT");
});

test("isolation 7: the same policy_id/version in two scopes stays two independent records", () => {
  const registry = createShippingPolicyRegistry();
  const scopedA = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyId: "policy-shared", policyVersion: "1" }));
  const scopedB = registry.registerPolicyVersion(policyInput(SCOPE_B, { policyId: "policy-shared", policyVersion: "1" }));
  assert.equal(scopedA.status, "REGISTERED");
  assert.equal(scopedB.status, "REGISTERED", "the other scope's identical id/version is a new record, not a conflict");
  assert.notEqual(scopedA.registration_id, scopedB.registration_id);
  assert.equal(registry.revoke(scopedA.registration_id, SCOPE_A, SYNTHETIC).status, "REVOKED");
  assert.equal(registry.get(scopedB.registration_id, SCOPE_B).record.lifecycle, "DRAFT", "the other scope was not touched");
  assert.equal(registry.registerPolicyVersion(policyInput(SCOPE_A, { policyId: "policy-shared", policyVersion: "1", quotedText: "different content" })).reason, "CONTENT_CONFLICT");
});

// --- Replacement history regressions: append-once links ----------------------------------------

test("replacement history 1: re-linking the same target is idempotent and never rewrites the record", () => {
  const registry = createShippingPolicyRegistry();
  const v1 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "1" }));
  const v2 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "2" }));
  assert.equal(registry.linkReplacement({ newRegistrationId: v2.registration_id, oldRegistrationId: v1.registration_id, scope: SCOPE_A }).status, "REGISTERED");
  const before = JSON.stringify(registry.get(v2.registration_id, SCOPE_A));
  const repeat = registry.linkReplacement({ newRegistrationId: v2.registration_id, oldRegistrationId: v1.registration_id, scope: SCOPE_A });
  assert.equal(repeat.status, "IDEMPOTENT");
  assert.equal(repeat.lifecycle, "DRAFT");
  assert.equal(JSON.stringify(registry.get(v2.registration_id, SCOPE_A)), before, "the replayed link changed nothing");
  assert.equal(registry.diagnostics().idempotent, 1);
  assert.equal(registry.diagnostics().records, 2);
});

test("replacement history 2: re-pointing to a different target is refused and keeps the original relation", () => {
  const registry = createShippingPolicyRegistry();
  const v1 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "1" }));
  const v2 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "2" }));
  const v3 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "3" }));
  assert.equal(registry.linkReplacement({ newRegistrationId: v3.registration_id, oldRegistrationId: v1.registration_id, scope: SCOPE_A }).status, "REGISTERED");
  const retarget = registry.linkReplacement({ newRegistrationId: v3.registration_id, oldRegistrationId: v2.registration_id, scope: SCOPE_A });
  assert.equal(retarget.status, "REJECTED");
  assert.equal(retarget.reason, "REPLACEMENT_TARGET_ALREADY_SET");
  const view = registry.get(v3.registration_id, SCOPE_A).record;
  assert.equal(view.replaces_registration_id, v1.registration_id, "the original relation is preserved");
  assert.equal(view.replaces_relation.target_registration_id, v1.registration_id);
  assert.equal(view.replaces_relation.valid, true);
  assert.equal(registry.diagnostics().records, 3);
});

test("replacement history 3: refused re-link requests change no record, relation or lifecycle", () => {
  const registry = createShippingPolicyRegistry();
  const v1 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "1" }));
  const v2 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "2" }));
  const v3 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "3" }));
  const otherFamily = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyId: "other-family", policyVersion: "1" }));
  registry.linkReplacement({ newRegistrationId: v3.registration_id, oldRegistrationId: v1.registration_id, scope: SCOPE_A });
  const snapshot = () => JSON.stringify([v1, v2, v3, otherFamily].map((record) => registry.get(record.registration_id, SCOPE_A)));
  const before = snapshot();
  assert.equal(registry.linkReplacement({ newRegistrationId: v3.registration_id, oldRegistrationId: v2.registration_id, scope: SCOPE_A }).reason, "REPLACEMENT_TARGET_ALREADY_SET");
  assert.equal(registry.linkReplacement({ newRegistrationId: v3.registration_id, oldRegistrationId: v3.registration_id, scope: SCOPE_A }).reason, "REPLACEMENT_SELF_REFERENCE");
  assert.equal(registry.linkReplacement({ newRegistrationId: v3.registration_id, oldRegistrationId: otherFamily.registration_id, scope: SCOPE_A }).reason, "REPLACEMENT_POLICY_MISMATCH");
  assert.equal(snapshot(), before, "refused requests changed no record or relation");
  assert.equal(registry.diagnostics().rejections, 3);
  assert.equal(registry.diagnostics().idempotent, 0);
  assert.equal(registry.diagnostics().records, 4);
});

test("replacement history 4: revoked-endpoint checks run before the idempotent replay path", () => {
  const registry = createShippingPolicyRegistry();
  const v1 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "1" }));
  const v2 = registry.registerPolicyVersion(policyInput(SCOPE_A, { policyVersion: "2" }));
  registry.linkReplacement({ newRegistrationId: v2.registration_id, oldRegistrationId: v1.registration_id, scope: SCOPE_A });
  registry.revoke(v1.registration_id, SCOPE_A, SYNTHETIC);
  const repeated = registry.linkReplacement({ newRegistrationId: v2.registration_id, oldRegistrationId: v1.registration_id, scope: SCOPE_A });
  assert.equal(repeated.status, "REJECTED");
  assert.equal(repeated.reason, "REPLACEMENT_TARGET_REVOKED", "a repeated request cannot bypass the revoked-target rule");
  registry.revoke(v2.registration_id, SCOPE_A, SYNTHETIC);
  assert.equal(registry.linkReplacement({ newRegistrationId: v2.registration_id, oldRegistrationId: v1.registration_id, scope: SCOPE_A }).reason, "REPLACEMENT_SOURCE_REVOKED");
  const view = registry.get(v2.registration_id, SCOPE_A).record;
  assert.equal(view.replaces_registration_id, v1.registration_id, "the historical relation is kept");
  assert.equal(view.replaces_relation.valid, false);
  assert.equal(view.replaces_relation.invalid_reason, "ENDPOINT_REVOKED");
});
