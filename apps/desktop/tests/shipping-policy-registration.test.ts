// SHEEP-305 Lane B focused tests — Owner material intake and the Lane A bridge.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createOwnerPolicyRegistrationEntry,
  MUYI_CONFIRMED_QUOTED_TEXT,
  MUYI_CONFIRMED_STRUCTURED_ITEMS,
} from "../dist/main/services/shipping-policy-registration.js";
import { createShippingPolicyRegistry } from "../dist/main/services/shipping-policy-registry.js";
import { evaluateShippingPolicy } from "../dist/main/services/shipping-policy-contract.js";

const SCOPE = { merchantId: "merchant-synth-a", storeId: "store-synth-a", platformAccountId: null };
const OTHER_SCOPE = { merchantId: "merchant-synth-a", storeId: "store-synth-b", platformAccountId: null };
const SYNTHETIC = "SYNTHETIC_TEST_ASSUMPTION";

function entry() {
  return createOwnerPolicyRegistrationEntry(createShippingPolicyRegistry());
}
function registerMuyi(target = entry(), overrides = {}) {
  return target.registerMuyiConfirmedPolicyVersion({
    scope: SCOPE, policyId: "policy-muyi-synth", policyVersion: "1",
    basisRef: SYNTHETIC + "://owner-message/2026-09-23", registeredAt: "2026-09-23", ...overrides,
  });
}

test("intake: the Owner declaration is registered as OWNER_DECLARED / UNVERIFIED with its raw identifier", () => {
  const target = entry();
  const result = target.declareOwnerIdentity({ scope: SCOPE, platform: "pdd", ownerDeclaredIdentifier: "SYNTHETIC-SHOP-NAME", basisRef: SYNTHETIC + "://owner-message", declaredAt: "2026-09-23" });
  assert.equal(result.status, "REGISTERED");
  const stored = target.get(result.registration_id, SCOPE);
  assert.equal(stored.ok, true);
  assert.equal(stored.record.identifier_source, "OWNER_DECLARED");
  assert.equal(stored.record.platform_binding, "UNVERIFIED");
  assert.equal(stored.record.policy_id, undefined, "a declaration is not a policy version");
});

test("intake area 10: a registered, content-confirmed policy still yields NO valid Lane A fact", () => {
  const target = entry();
  const registered = registerMuyi(target);
  assert.equal(registered.status, "REGISTERED");
  const stored = target.get(registered.registration_id, SCOPE);
  assert.equal(stored.record.lifecycle, "DRAFT", "content confirmation does not activate the policy");
  assert.equal(stored.record.effective.from, null);
  assert.equal(stored.record.confirmation_state, "OWNER_CONFIRMED_CONTENT");
  assert.equal(stored.record.content_approval.quoted_text, MUYI_CONFIRMED_QUOTED_TEXT, "the verbatim Owner text is preserved");

  const converted = target.toLaneAPolicyRecord(registered.registration_id, SCOPE);
  assert.equal(converted.ok, true);
  assert.equal(converted.record.lifecycle, "DRAFT");
  assert.equal(converted.record.owner_approval, null, "no activation-grade approval record is invented");
  assert.equal(converted.record.merchant_id, SCOPE.merchantId);
  assert.equal(converted.record.nature, "EXPECTED");
  assert.equal(converted.record.time_value.hours, 48);
  assert.equal(converted.record.time_value.type, "CONTINUOUS_HOURS");
  assert.equal(converted.record.business_calendar, null, "continuous hours need no business calendar");
  assert.equal(converted.record.timezone, null, "the Owner text states no timezone");
  assert.equal(converted.record.cut_off, null);

  const request = {
    merchant_id: SCOPE.merchantId, store_id: SCOPE.storeId, platform_account_id: null,
    product_ref: null, order_start_evidence: { source: "canonical_order_fact", kind: "payment_success" },
    ship_complete_evidence: null, fulfilment_exception: null, historical_commitment: null, shop_name: null, now: "2026-09-23T00:00:00.000Z",
  };
  const evaluation = evaluateShippingPolicy(request, [converted.record]);
  assert.equal(evaluation.policy_fact, null, "Lane A must not serve a fact for the registered draft");
  assert.ok([...evaluation.restriction_reasons].includes("DRAFT_NOT_EFFECTIVE"));
  assert.ok([...evaluation.restriction_reasons].includes("POLICY_NOT_ACTIVE"));
  assert.equal(evaluation.newness, "NEWNESS_UNVERIFIED");
  assert.equal(evaluation.automaticProcessingEligible, false);
  assert.equal(evaluation.order_shipping_date, null);
  assert.equal(evaluation.delivery_eta, null);
});

test("intake area 11: the candidate exceptions are NOT registered as coverage rules", () => {
  const target = entry();
  const attempt = target.registerContentConfirmedPolicyVersion({
    scope: SCOPE, policyId: "policy-muyi-synth", policyVersion: "1",
    quotedText: MUYI_CONFIRMED_QUOTED_TEXT,
    structuredItems: [...MUYI_CONFIRMED_STRUCTURED_ITEMS, { item: "exceptions", value: "pre-sale/custom" }],
    basisRef: SYNTHETIC + "://owner-message", registeredAt: "2026-09-23",
  });
  assert.equal(attempt.status, "REJECTED");
  assert.equal(attempt.reason, "EXCEPTIONS_NOT_APPROVED");
  assert.deepEqual(target.list(SCOPE), [], "nothing was registered from an unapproved exception");
});

test("intake: activation-shaped input is refused (no lifecycle/effective window at registration time)", () => {
  const target = entry();
  const attempt = target.registerContentConfirmedPolicyVersion({
    scope: SCOPE, policyId: "policy-muyi-synth", policyVersion: "1", quotedText: MUYI_CONFIRMED_QUOTED_TEXT,
    structuredItems: MUYI_CONFIRMED_STRUCTURED_ITEMS, basisRef: SYNTHETIC + "://owner-message",
    lifecycle: "ACTIVE", effective: { from: "2026-09-23", to: null },
  });
  assert.equal(attempt.status, "REJECTED");
  assert.equal(attempt.reason, "EFFECTIVE_WINDOW_NOT_ALLOWED");
  const direct = target.registry.registerPolicyVersion({
    scope: SCOPE, policyId: "policy-muyi-synth", policyVersion: "2", quotedText: MUYI_CONFIRMED_QUOTED_TEXT,
    structuredItems: MUYI_CONFIRMED_STRUCTURED_ITEMS, basisRef: SYNTHETIC + "://owner-message",
    effective: { from: "2026-09-23", to: null },
  });
  assert.equal(direct.status, "REJECTED");
  assert.equal(target.diagnostics().records, 0);
});

test("intake: the confirmed structured mapping matches the Owner text items exactly", () => {
  const items = Object.fromEntries(MUYI_CONFIRMED_STRUCTURED_ITEMS.map((entry) => [entry.item, entry.value]));
  assert.equal(items.nature, "EXPECTED");
  assert.match(items.applicability, /REGULAR_STOCK_ONLY/);
  assert.match(items.applicability, /not extended to all goods/);
  assert.equal(items.clock_start, "PAYMENT_SUCCESS");
  assert.equal(items.time_value, "CONTINUOUS_HOURS_48");
  assert.equal(items.ship_complete_definition, "FIRST_VALID_CARRIER_ACCEPTANCE");
  assert.match(items.weekend_holiday_handling, /COUNTED_IN_CONTINUOUS_DURATION/);
  assert.match(MUYI_CONFIRMED_QUOTED_TEXT, /^木易先生的常规现货，预计支付成功后 48 个连续小时内出现承运商首次有效揽收记录，周末及节假日计入。$/);
});

test("intake: a second scope cannot read or revoke the registered version", () => {
  const target = entry();
  const registered = registerMuyi(target);
  assert.equal(target.get(registered.registration_id, OTHER_SCOPE).ok, false);
  assert.deepEqual(target.list(OTHER_SCOPE), []);
  assert.equal(target.registry.revoke(registered.registration_id, OTHER_SCOPE, SYNTHETIC).reason, "SCOPE_MISMATCH");
  assert.equal(target.get(registered.registration_id, SCOPE).record.lifecycle, "DRAFT");
});

test("intake: the entry exposes no activation/verification surface and no side-effect ports", () => {
  const target = entry();
  const surface = Object.keys(target).join(" ") + " " + Object.keys(target.registry).join(" ");
  for (const forbidden of ["verify", "promote", "activate", "force"]) assert.equal(surface.includes(forbidden), false, forbidden);
  const diagnostics = target.diagnostics();
  assert.equal(diagnostics.aiCalls, 0);
  assert.equal(diagnostics.sendCalls, 0);
  assert.equal(diagnostics.persistenceWrites, 0);
  assert.equal(diagnostics.providerCalls, 0);
  assert.equal(diagnostics.networkCalls, 0);
  assert.equal(diagnostics.sideEffectGuarantee, "STRUCTURAL_INVARIANT_NOT_A_RUNTIME_MEASUREMENT");
  assert.equal(diagnostics.laneARecordConversions, 0);
});

test("intake: converting a non-policy registration or an unknown id fails closed", () => {
  const target = entry();
  const declaration = target.declareOwnerIdentity({ scope: SCOPE, platform: "pdd", ownerDeclaredIdentifier: "SYNTHETIC-SHOP-NAME", basisRef: SYNTHETIC + "://m", declaredAt: null });
  assert.equal(target.toLaneAPolicyRecord(declaration.registration_id, SCOPE).ok, false);
  assert.equal(target.toLaneAPolicyRecord("reg-unknown-0001", SCOPE).ok, false);
});

test("intake area 11b: a REVOKED content-confirmed version still yields NO valid Lane A fact", () => {
  const target = entry();
  const registered = registerMuyi(target);
  assert.equal(target.registry.revoke(registered.registration_id, SCOPE, SYNTHETIC).status, "REVOKED");

  const stored = target.get(registered.registration_id, SCOPE);
  assert.equal(stored.record.lifecycle, "REVOKED");
  assert.equal(stored.record.revoked_reason, SYNTHETIC);

  const converted = target.toLaneAPolicyRecord(registered.registration_id, SCOPE);
  assert.equal(converted.ok, true, "the bridge still yields a record; a record is not a fact");
  assert.equal(converted.record.lifecycle, "REVOKED");
  assert.equal(converted.record.owner_approval, null, "revocation never fabricates an approval");

  const evaluation = evaluateShippingPolicy({
    merchant_id: SCOPE.merchantId, store_id: SCOPE.storeId, platform_account_id: null,
    product_ref: null, order_start_evidence: null, ship_complete_evidence: null,
    fulfilment_exception: null, historical_commitment: null, shop_name: null, now: "2026-09-23T00:00:00.000Z",
  }, [converted.record]);
  assert.equal(evaluation.policy_fact, null, "a revoked registration can never produce a fact");
  assert.ok([...evaluation.restriction_reasons].includes("REVOKED"));
  assert.equal(evaluation.newness, "NEWNESS_UNVERIFIED");
  assert.equal(evaluation.automaticProcessingEligible, false);
  assert.equal(evaluation.order_shipping_date, null);
  assert.equal(evaluation.delivery_eta, null);
});

test("intake area 12: constructing the entry registers nothing (no policy is auto-loaded)", () => {
  const target = entry();
  assert.deepEqual(target.list(SCOPE), []);
  assert.deepEqual(target.list(OTHER_SCOPE), []);
  const diagnostics = target.diagnostics();
  assert.equal(diagnostics.records, 0);
  assert.equal(diagnostics.policyVersions, 0);
  assert.equal(diagnostics.declarations, 0);
  assert.equal(diagnostics.registrations, 0);
  // the Owner-confirmed content exists only as exported constants; no record exists to convert
  assert.equal(target.toLaneAPolicyRecord("reg-policy-0001", SCOPE).ok, false);
  assert.equal(target.toLaneAPolicyRecord("reg-ident-0001", SCOPE).ok, false);
});

test("intake: the bridge refuses malformed/duplicate structured items instead of silently taking the first value", () => {
  function stubbedRegistry(items) {
    return {
      get: () => ({
        ok: true,
        record: {
          registration_id: "reg-policy-0001", kind: "POLICY_VERSION", scope: SCOPE,
          policy_id: "policy-stub", policy_version: "1", lifecycle: "DRAFT",
          confirmation_state: "OWNER_CONFIRMED_CONTENT",
          content_approval: { kind: "OWNER_CHAT_TEXT", basis_ref: SYNTHETIC, quoted_text: "SYNTHETIC" },
          structured_items: items, replaces_registration_id: null,
          effective: { from: null, to: null }, registered_at: null, revoked_reason: null,
        },
      }),
    };
  }
  const duplicateKeys = createOwnerPolicyRegistrationEntry(stubbedRegistry([{ item: "nature", value: "EXPECTED" }, { item: "nature", value: "COMMITTED" }]));
  const duplicate = duplicateKeys.toLaneAPolicyRecord("reg-policy-0001", SCOPE);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "STRUCTURED_ITEMS_INVALID");

  const emptyItems = createOwnerPolicyRegistrationEntry(stubbedRegistry([]));
  assert.equal(emptyItems.toLaneAPolicyRecord("reg-policy-0001", SCOPE).ok, false);

  const unapprovedException = createOwnerPolicyRegistrationEntry(stubbedRegistry([{ item: "nature", value: "EXPECTED" }, { item: "exceptions", value: "pre-sale" }]));
  const exception = unapprovedException.toLaneAPolicyRecord("reg-policy-0001", SCOPE);
  assert.equal(exception.ok, false);
  assert.equal(exception.reason, "EXCEPTIONS_NOT_APPROVED");

  // the entry-level intake never silently keeps a duplicated item set either
  const target = entry();
  const attempt = target.registerContentConfirmedPolicyVersion({
    scope: SCOPE, policyId: "policy-stub", policyVersion: "1", quotedText: MUYI_CONFIRMED_QUOTED_TEXT,
    structuredItems: [...MUYI_CONFIRMED_STRUCTURED_ITEMS, ...MUYI_CONFIRMED_STRUCTURED_ITEMS],
    basisRef: SYNTHETIC, registeredAt: "2026-09-23",
  });
  assert.equal(attempt.status, "REJECTED");
  assert.equal(attempt.reason, "STRUCTURED_ITEMS_INVALID");
  assert.deepEqual(target.list(SCOPE), []);
});
