// SHEEP-305 Lane A focused tests: the SHIPPING_POLICY_V1 contract, pure validation/matching and the
// 21-row acceptance matrix (12 rows from the decision report + 9 supplement rows).
//
// Every row asserts the same invariants via assertInvariants(): no reply / prompt / send /
// AI-decision / execution key, newness unchanged, automaticProcessingEligible=false, and no derived
// order shipping date or delivery ETA. All fixtures are labelled SYNTHETIC_TEST_ASSUMPTION.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createShippingPolicyEvaluator,
  evaluateShippingPolicy,
  isAbsenceState,
  isPolicyLifecycle,
  isPolicyNature,
  isPolicyTimeValueType,
  POLICY_ABSENCE_STATES,
  POLICY_LIFECYCLES,
  POLICY_NATURES,
  POLICY_TIME_VALUE_TYPES,
  SHIPPING_POLICY_CONTRACT_ID,
  UNTRUSTED_ORDER_TIME_SOURCES,
} from "../dist/main/services/shipping-policy-contract.js";

const SYNTHETIC = "SYNTHETIC_TEST_ASSUMPTION";
const NOW = "2026-09-23T00:00:00.000Z";

function policy(overrides = {}) {
  return {
    policy_id: "policy-synthetic-1",
    policy_version: "1",
    policy_text_ref: "synthetic://policy/text-1",
    owner_approval: { approved_by: "synthetic-owner", approved_at: "2026-09-01", approval_evidence_ref: "synthetic://approval/1" },
    merchant_id: "merchant-synthetic",
    store_id: "store-synthetic",
    platform_account_id: null,
    applicability: "STORE_WIDE",
    product_scope: null,
    clock_start: { event: "payment_success" },
    ship_complete_definition: "carrier_first_valid_acceptance",
    time_value: { type: "CONTINUOUS_HOURS", hours: 48 },
    nature: "EXPECTED",
    timezone: "Asia/Shanghai",
    business_calendar: null,
    cut_off: null,
    effective: { from: "2026-09-01T00:00:00.000Z", to: null },
    lifecycle: "ACTIVE",
    replaces: null,
    source_ref: SYNTHETIC,
    ...overrides,
  };
}

function request(overrides = {}) {
  return {
    merchant_id: "merchant-synthetic",
    store_id: "store-synthetic",
    platform_account_id: null,
    product_ref: null,
    order_start_evidence: { source: "canonical_order_fact", kind: "payment_success" },
    ship_complete_evidence: null,
    fulfilment_exception: null,
    historical_commitment: null,
    shop_name: null,
    now: NOW,
    ...overrides,
  };
}

/** The 木易先生 candidate draft: DRAFT, unbound identity, no approval, no effective window. */
const MUYI_DRAFT = policy({
  policy_id: "draft-muyi-candidate",
  policy_version: "0.1-draft",
  policy_text_ref: null,
  owner_approval: null,
  merchant_id: null,
  store_id: null,
  platform_account_id: null,
  applicability: "STORE_WIDE",
  nature: "EXPECTED",
  time_value: { type: "CONTINUOUS_HOURS", hours: 48 },
  clock_start: { event: "payment_success" },
  ship_complete_definition: "carrier_first_valid_acceptance",
  timezone: "Asia/Shanghai",
  effective: { from: null, to: null },
  lifecycle: "DRAFT",
  source_ref: "DRAFT_CANDIDATE_NOT_EFFECTIVE",
});

function assertInvariants(result) {
  const keys = Object.keys(result);
  for (const forbidden of ["reply", "prompt", "send", "send_action", "ai_decision", "execution", "execution_instruction", "production_mutation"]) {
    assert.equal(keys.includes(forbidden), false, "output must not contain " + forbidden);
  }
  assert.equal(result.newness, "NEWNESS_UNVERIFIED", "newness must never be upgraded");
  assert.equal(result.automaticProcessingEligible, false, "automatic processing must stay ineligible");
  assert.equal(result.order_shipping_date, null, "no order-level shipping date may be derived");
  assert.equal(result.delivery_eta, null, "no delivery ETA may be derived");
  assert.equal(result.identity_checks.name_used_as_identity, false);
  assert.equal(result.identity_checks.cross_scope_substitution, false);
  assert.equal(result.contract, SHIPPING_POLICY_CONTRACT_ID);
  return result;
}

function reasonsOf(result) { return [...result.restriction_reasons]; }

test("contract vocabulary: lifecycles, natures, time value types and the three absence states stay distinct", () => {
  assert.deepEqual([...POLICY_LIFECYCLES], ["DRAFT", "NOT_EFFECTIVE", "ACTIVE", "SUPERSEDED", "REVOKED"]);
  assert.deepEqual([...POLICY_NATURES], ["EXPECTED", "COMMITTED"]);
  assert.deepEqual([...POLICY_TIME_VALUE_TYPES], ["CONTINUOUS_HOURS", "BUSINESS_DAYS", "DATE", "INTERVAL"]);
  assert.deepEqual([...POLICY_ABSENCE_STATES], ["NOT_APPLICABLE", "EXPLICITLY_ABSENT", "UNKNOWN"]);
  assert.equal(policy({}).lifecycle && isPolicyLifecycle("ACTIVE"), true);
  assert.equal(isPolicyLifecycle("RETIRED"), false);
  assert.equal(isPolicyNature("EXPECTED"), true);
  assert.equal(isPolicyNature("ESTIMATED"), false);
  assert.equal(isPolicyTimeValueType("BUSINESS_DAYS"), true);
  assert.equal(isPolicyTimeValueType("WEEKS"), false);
  assert.equal(isAbsenceState("EXPLICITLY_ABSENT"), true);
  assert.equal(isAbsenceState("ABSENT"), false);
  assert.equal(UNTRUSTED_ORDER_TIME_SOURCES.includes("buyer_text"), true);
});

// --- 21-row acceptance matrix -------------------------------------------------

test("matrix 1: a valid, explicitly applicable policy serves a policy fact", () => {
  const result = assertInvariants(evaluateShippingPolicy(request(), [policy({})]));
  assert.ok(result.policy_fact, "an ACTIVE, approved, complete policy must serve a fact");
  assert.equal(result.applicability, "APPLICABLE");
  assert.equal(result.policy_fact.nature, "EXPECTED");
  assert.equal(result.policy_fact.time_value.hours, 48);
  assert.equal(result.policy_fact.timezone, "Asia/Shanghai");
  assert.equal(result.policy_fact.clock_start_event, "payment_success");
  assert.equal(result.evidence.policy_id, "policy-synthetic-1");
  assert.equal(result.validity.lifecycle, "ACTIVE");
  assert.equal(result.order_start_time_known, true);
});

test("matrix 2: a missing policy yields no fact and no default", () => {
  const result = assertInvariants(evaluateShippingPolicy(request(), []));
  assert.equal(result.policy_fact, null);
  assert.equal(result.applicability, "UNKNOWN");
  assert.equal(result.absence_state, "UNKNOWN");
  assert.ok(reasonsOf(result).includes("POLICY_MISSING"));
});

test("matrix 3: a scope mismatch (same merchant, other store / other account) never substitutes", () => {
  const otherStore = evaluateShippingPolicy(request(), [policy({ store_id: "store-other" })]);
  assertInvariants(otherStore);
  assert.equal(otherStore.policy_fact, null);
  assert.ok(reasonsOf(otherStore).includes("SCOPE_MISMATCH"));
  const otherAccount = evaluateShippingPolicy(request({ platform_account_id: "account-a" }), [policy({ platform_account_id: "account-b" })]);
  assertInvariants(otherAccount);
  assert.equal(otherAccount.policy_fact, null);
  assert.ok(reasonsOf(otherAccount).includes("SCOPE_UNBOUND"));
});

test("matrix 4: a product exception whose applicability is unknown produces no order conclusion", () => {
  const result = assertInvariants(evaluateShippingPolicy(
    request({ product_ref: "product-x" }),
    [policy({ applicability: "PRODUCT_SCOPED", product_scope: { include: ["product-y"], exclude: [], resolution: "UNDETERMINED" } })],
  ));
  assert.equal(result.policy_fact, null);
  assert.equal(result.applicability, "UNDETERMINED");
  assert.ok(reasonsOf(result).includes("PRODUCT_APPLICABILITY_UNDETERMINED"));
});

test("matrix 5: conflicting policies with no approved replacement resolve to UNKNOWN", () => {
  const a = policy({ policy_id: "policy-a", source_ref: SYNTHETIC });
  const b = policy({ policy_id: "policy-b", source_ref: SYNTHETIC });
  const result = assertInvariants(evaluateShippingPolicy(request(), [a, b]));
  assert.equal(result.policy_fact, null);
  assert.ok(reasonsOf(result).includes("CONFLICTING_POLICIES"));
});

test("matrix 6: an approved replacement version is used, with the replaces relation preserved", () => {
  const older = policy({ policy_id: "policy-v1", replaces: null, effective: { from: "2026-08-01T00:00:00.000Z", to: "2026-09-10T00:00:00.000Z" } });
  const newer = policy({ policy_id: "policy-v2", policy_version: "2", replaces: "policy-v1", effective: { from: "2026-09-10T00:00:00.000Z", to: null } });
  const result = assertInvariants(evaluateShippingPolicy(request(), [older, newer]));
  assert.ok(result.policy_fact, "the replacement chain must resolve to one head");
  assert.equal(result.policy_fact.policy_id, "policy-v2");
  assert.equal(result.replaces, "policy-v1");
});

test("matrix 7: expired or revoked policies are never current", () => {
  const expired = assertInvariants(evaluateShippingPolicy(request(), [policy({ effective: { from: "2026-01-01T00:00:00.000Z", to: "2026-06-01T00:00:00.000Z" } })]));
  assert.equal(expired.policy_fact, null);
  assert.ok(reasonsOf(expired).includes("EXPIRED"));
  const revoked = assertInvariants(evaluateShippingPolicy(request(), [policy({ lifecycle: "REVOKED" })]));
  assert.equal(revoked.policy_fact, null);
  assert.ok(reasonsOf(revoked).includes("REVOKED"));
  const superseded = assertInvariants(evaluateShippingPolicy(request(), [policy({ lifecycle: "SUPERSEDED" })]));
  assert.equal(superseded.policy_fact, null);
  assert.ok(reasonsOf(superseded).includes("SUPERSEDED"));
});

test("matrix 8: a business-day rule without a calendar produces no fact", () => {
  const result = assertInvariants(evaluateShippingPolicy(request(), [policy({ time_value: { type: "BUSINESS_DAYS", days: 2 }, business_calendar: null })]));
  assert.equal(result.policy_fact, null);
  assert.ok(reasonsOf(result).includes("CALENDAR_MISSING"));
});

test("matrix 9: a date rule without a timezone produces no fact", () => {
  const result = assertInvariants(evaluateShippingPolicy(request(), [policy({ time_value: { type: "DATE", date: "2026-10-01" }, timezone: null })]));
  assert.equal(result.policy_fact, null);
  assert.ok(reasonsOf(result).includes("TIMEZONE_MISSING"));
});

test("matrix 10: a usable policy and an unknown order time are expressed separately", () => {
  const result = assertInvariants(evaluateShippingPolicy(request({ order_start_evidence: null }), [policy({})]));
  assert.ok(result.policy_fact, "the policy fact stays available");
  assert.equal(result.order_start_time_known, false);
  assert.ok(reasonsOf(result).includes("ORDER_TIME_UNKNOWN"), "the order time limitation is reported on its own");
});

test("matrix 11: a new policy never overwrites a historical order commitment", () => {
  const result = assertInvariants(evaluateShippingPolicy(
    request({ historical_commitment: { policy_id: "policy-historic", policy_version: "1", agreed_at: "2026-08-01T00:00:00.000Z" } }),
    [policy({ policy_id: "policy-new", policy_version: "3" })],
  ));
  assert.equal(result.policy_fact, null);
  assert.equal(result.applicability, "NOT_APPLICABLE");
  assert.ok(reasonsOf(result).includes("HISTORICAL_COMMITMENT_PRESERVED"));
});

test("matrix 12: a buyer-claimed payment never becomes the order start evidence", () => {
  const result = assertInvariants(evaluateShippingPolicy(request({ order_start_evidence: { source: "buyer_text", kind: "claimed_paid" } }), [policy({})]));
  assert.equal(result.order_start_time_known, false);
  assert.ok(reasonsOf(result).includes("ORDER_TIME_UNKNOWN"));
});

test("matrix 13: a DRAFT-only registry serves no valid policy fact", () => {
  const result = assertInvariants(evaluateShippingPolicy(request(), [policy({ lifecycle: "DRAFT" })]));
  assert.equal(result.policy_fact, null);
  assert.ok(reasonsOf(result).includes("DRAFT_NOT_EFFECTIVE"));
  assert.ok(reasonsOf(result).includes("POLICY_NOT_ACTIVE"));
});

test("matrix 14: an identical shop name with unbound scope does not match", () => {
  const result = assertInvariants(evaluateShippingPolicy(request({ shop_name: "木易先生" }), [MUYI_DRAFT]));
  assert.equal(result.policy_fact, null);
  assert.ok(reasonsOf(result).includes("SCOPE_UNBOUND"), "the draft has no merchant/store binding");
  assert.ok(reasonsOf(result).includes("NAME_NOT_IDENTITY_EVIDENCE"), "the name is recorded as non-evidence");
  assert.deepEqual([...result.diagnostics], ["SHOP_NAME_IGNORED_FOR_IDENTITY"]);
});

test("matrix 15: an ACTIVE policy with unknown product applicability yields no order-applicability conclusion", () => {
  const result = assertInvariants(evaluateShippingPolicy(request({ product_ref: null }), [policy({ applicability: "PRODUCT_SCOPED", product_scope: { include: ["product-z"], exclude: [], resolution: "UNDETERMINED" } })]));
  assert.equal(result.policy_fact, null);
  assert.equal(result.applicability, "UNDETERMINED");
  assert.ok(reasonsOf(result).includes("PRODUCT_APPLICABILITY_UNDETERMINED"));
});

test("matrix 16: a waybill upload without a carrier acceptance never claims shipment completion", () => {
  const result = assertInvariants(evaluateShippingPolicy(request({ ship_complete_evidence: { kind: "waybill_uploaded" } }), [policy({})]));
  assert.equal(result.ship_complete.evidenced, false);
  assert.ok(reasonsOf(result).includes("SHIP_COMPLETE_NOT_EVIDENCED"));
  const accepted = assertInvariants(evaluateShippingPolicy(request({ ship_complete_evidence: { kind: "carrier_first_acceptance" } }), [policy({})]));
  assert.equal(accepted.ship_complete.evidenced, true, "only a first valid carrier acceptance evidences completion");
});

test("matrix 17: a buyer claiming payment is not a trusted clock start", () => {
  const result = assertInvariants(evaluateShippingPolicy(request({ order_start_evidence: { source: "buyer_claim", kind: "paid_claim" } }), [policy({})]));
  assert.equal(result.order_start_time_known, false);
  assert.ok(reasonsOf(result).includes("ORDER_TIME_UNKNOWN"));
});

test("matrix 18: 48 continuous hours across a weekend are not extended", () => {
  const result = assertInvariants(evaluateShippingPolicy(request(), [policy({ time_value: { type: "CONTINUOUS_HOURS", hours: 48 } })]));
  assert.ok(result.policy_fact);
  assert.equal(result.policy_fact.time_value.type, "CONTINUOUS_HOURS");
  assert.equal(result.policy_fact.time_value.hours, 48, "continuous hours stay continuous");
  assert.equal(result.policy_fact.business_calendar_ref, null, "no calendar is attached to a continuous duration");
  assert.equal(result.policy_fact.timezone, "Asia/Shanghai");
});

test("matrix 19: stockout / fulfilment exception never auto-extends a deadline", () => {
  const result = assertInvariants(evaluateShippingPolicy(request({ fulfilment_exception: { kind: "stockout" } }), [policy({})]));
  assert.ok(reasonsOf(result).includes("FULFILMENT_EXCEPTION_NOT_MODELLED"));
  assert.equal(result.order_shipping_date, null);
  assert.equal(result.delivery_eta, null);
  if (result.policy_fact) assert.equal(result.policy_fact.time_value.hours, 48, "no substitution or extension is produced");
});

test("matrix 20: general policy available while the order time is unknown - both are expressed apart", () => {
  const result = assertInvariants(evaluateShippingPolicy(request({ order_start_evidence: null }), [policy({})]));
  assert.ok(result.policy_fact, "policy side: available");
  assert.equal(result.order_start_time_known, false, "order side: unknown");
  assert.ok(reasonsOf(result).includes("ORDER_TIME_UNKNOWN"));
});

test("matrix 21: unapproved candidate exceptions are never registered as product coverage rules", () => {
  const result = assertInvariants(evaluateShippingPolicy(request({ product_ref: "pre-sale-item" }), [policy({})]));
  assert.ok(result.policy_fact, "the declared store-wide policy is still what it is");
  assert.equal(result.applicability, "APPLICABLE");
  assert.equal(reasonsOf(result).includes("PRODUCT_APPLICABILITY_UNDETERMINED"), false, "no exception rule was invented from free text");
  assert.deepEqual(result.policy_fact.time_value, { type: "CONTINUOUS_HOURS", hours: 48 }, "exactly the declared value, unchanged");
});

// --- boundary, determinism and the 木易先生 draft ---------------------------------

test("draft handling: the 木易先生 candidate is a negative fixture that can never serve a fact", () => {
  const evaluator = createShippingPolicyEvaluator([MUYI_DRAFT]);
  assert.equal(evaluator.diagnostics().registeredPolicies, 1);
  assert.equal(evaluator.diagnostics().activePolicies, 0, "a DRAFT is never an active policy");
  for (const req of [request(), request({ shop_name: "木易先生" }), request({ merchant_id: null, store_id: null }), request({ now: null })]) {
    const result = assertInvariants(evaluator.evaluate(req));
    assert.equal(result.policy_fact, null, "the candidate draft never produces a policy fact");
    assert.ok(result.restriction_reasons.length > 0);
  }
  const withName = evaluator.evaluate(request({ shop_name: "木易先生" }));
  assert.ok(reasonsOf(withName).includes("SCOPE_UNBOUND") || reasonsOf(withName).includes("NAME_NOT_IDENTITY_EVIDENCE"));
});

test("the default evaluator registry is empty: no policy is active unless explicitly supplied", () => {
  const evaluator = createShippingPolicyEvaluator();
  const diagnostics = evaluator.diagnostics();
  assert.equal(diagnostics.registeredPolicies, 0);
  assert.equal(diagnostics.activePolicies, 0);
  const result = assertInvariants(evaluator.evaluate(request()));
  assert.equal(result.policy_fact, null);
  assert.ok(reasonsOf(result).includes("POLICY_MISSING"));
  assert.equal(diagnostics.aiCalls, 0);
  assert.equal(diagnostics.sendCalls, 0);
  assert.equal(diagnostics.persistenceWrites, 0);
  assert.equal(diagnostics.providerCalls, 0);
  assert.equal(diagnostics.networkCalls, 0);
  assert.equal(diagnostics.sideEffectGuarantee, "STRUCTURAL_INVARIANT_NOT_A_RUNTIME_MEASUREMENT");
});

test("structural boundary: the contract exposes no AI / send / persistence / provider / network port", async () => {
  const module = await import("../dist/main/services/shipping-policy-contract.js");
  assert.deepEqual(Object.keys(module).filter((key) => /ai|send|persist|provider|network|fetch|http|electron|sqlite/i.test(key)), []);
  const evaluator = createShippingPolicyEvaluator();
  assert.deepEqual(Object.keys(evaluator).sort(), ["diagnostics", "evaluate"]);
  // no text parsing / rule extraction escape hatch exists
  assert.deepEqual(Object.keys(module).filter((key) => /parse|extract|infer|guess/i.test(key)), []);
});

test("determinism: identical requests and fixtures yield identical results, and inputs are not mutated", () => {
  const fixtures = [policy({})];
  const req = request();
  const before = JSON.stringify({ fixtures, req });
  const first = evaluateShippingPolicy(req, fixtures);
  const second = evaluateShippingPolicy(req, fixtures);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify({ fixtures, req }), before, "the contract never mutates its inputs");
  assert.equal(Object.isFrozen(first), true);
});

test("no derivation: a served fact carries no absolute timestamp and no ETA field", () => {
  const result = assertInvariants(evaluateShippingPolicy(request(), [policy({})]));
  assert.ok(result.policy_fact);
  assert.deepEqual(Object.keys(result.policy_fact).sort(), [
    "business_calendar_ref", "clock_start_event", "cut_off_rule", "nature", "policy_id", "policy_version",
    "ship_complete_definition", "time_value", "timezone",
  ], "the fact carries declared policy fields only - no computed date");
  const etaLikeKeys = Object.keys(result).filter((key) => /estimated_arrival|eta|promise_date|shipping_date/i.test(key)).sort();
  assert.deepEqual(etaLikeKeys, ["delivery_eta", "order_shipping_date"], "the only ETA/date-shaped keys are the two pinned null fields");
  assert.equal(result.delivery_eta, null);
  assert.equal(result.order_shipping_date, null);
});
