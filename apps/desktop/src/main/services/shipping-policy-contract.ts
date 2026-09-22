// SHEEP-305 Lane A — Offline Shipping Policy Contract (pure, declarative, no activation).
//
// Authority: Roadmap V1.1 SHEEP-305 (allowed scope: rule contract, fact-provider boundary, focused
// tests) + the Owner-approved policy-first V1 direction (reports/SHEEP-305-policy-first-v1-product-decision.json)
// + the candidate draft for shop "木易先生" (reports/SHEEP-305-candidate-policy-muyi-draft.json).
//
// Lane A scope (Controller-authorized): the CONTRACT and pure validation/matching only.
//   - no real shop policy is registered or activated (the default registry is empty)
//   - no order/logistics/order-time/carrier-pickup capability is read or implemented
//   - no AI, no send, no persistence write, no provider/network port, no canonical schema change
//   - no shipping-time business answer is produced: the output never contains a per-order shipping
//     date or a delivery ETA (both are pinned to null and asserted in tests)
//
// Declared-only by construction: every value comes from a declared policy field. The contract NEVER
// parses policy text, NEVER invents defaults (no default 48h, no default payment start, no
// "waybill printed means shipped"), and NEVER fills an unknown with a substitute value.

export const SHIPPING_POLICY_CONTRACT_ID = "SHIPPING_POLICY_V1" as const;

/** Policy lifecycle states. Only ACTIVE may serve a valid policy fact. */
export type PolicyLifecycle = "DRAFT" | "NOT_EFFECTIVE" | "ACTIVE" | "SUPERSEDED" | "REVOKED";
export const POLICY_LIFECYCLES: readonly PolicyLifecycle[] = Object.freeze(["DRAFT", "NOT_EFFECTIVE", "ACTIVE", "SUPERSEDED", "REVOKED"]);

/** Declared nature of the value. It must come from approved semantics, never from wording. */
export type PolicyNature = "EXPECTED" | "COMMITTED";
export const POLICY_NATURES: readonly PolicyNature[] = Object.freeze(["EXPECTED", "COMMITTED"]);

export type PolicyTimeValueType = "CONTINUOUS_HOURS" | "BUSINESS_DAYS" | "DATE" | "INTERVAL";
export const POLICY_TIME_VALUE_TYPES: readonly PolicyTimeValueType[] = Object.freeze(["CONTINUOUS_HOURS", "BUSINESS_DAYS", "DATE", "INTERVAL"]);

export type PolicyApplicability = "STORE_WIDE" | "PRODUCT_SCOPED" | "UNDETERMINED";
export type ProductApplicabilityResolution = "CONFIRMED" | "NOT_APPLICABLE" | "UNDETERMINED";

/** Three distinct absence states. They are never collapsed into a default value. */
export type PolicyAbsenceState = "NOT_APPLICABLE" | "EXPLICITLY_ABSENT" | "UNKNOWN";
export const POLICY_ABSENCE_STATES: readonly PolicyAbsenceState[] = Object.freeze(["NOT_APPLICABLE", "EXPLICITLY_ABSENT", "UNKNOWN"]);

export type ShippingPolicyRestrictionReason =
  | "POLICY_MISSING"
  | "EXPLICITLY_ABSENT"
  | "SCOPE_UNBOUND"
  | "SCOPE_MISMATCH"
  | "DRAFT_NOT_EFFECTIVE"
  | "POLICY_NOT_ACTIVE"
  | "NOT_YET_EFFECTIVE"
  | "EXPIRED"
  | "SUPERSEDED"
  | "REVOKED"
  | "CONFLICTING_POLICIES"
  | "PRODUCT_APPLICABILITY_UNDETERMINED"
  | "CALENDAR_MISSING"
  | "TIMEZONE_MISSING"
  | "CLOCK_START_UNDECLARED"
  | "TIME_VALUE_UNDECLARED"
  | "NATURE_UNDECLARED"
  | "SHIP_COMPLETE_UNDECLARED"
  | "ORDER_TIME_UNKNOWN"
  | "SHIP_COMPLETE_NOT_EVIDENCED"
  | "FULFILMENT_EXCEPTION_NOT_MODELLED"
  | "HISTORICAL_COMMITMENT_PRESERVED"
  | "SEMANTICS_UNDECIDED"
  | "NAME_NOT_IDENTITY_EVIDENCE";

/** Evidence sources that can never establish the order start time. */
export const UNTRUSTED_ORDER_TIME_SOURCES: readonly string[] = Object.freeze(["buyer_text", "buyer_claim", "reply_text", "llm_output", "page_free_text"]);

export interface OwnerApproval { readonly approved_by: string; readonly approved_at: string; readonly approval_evidence_ref: string; }

export interface ProductScope {
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly resolution: ProductApplicabilityResolution;
}

export interface PolicyTimeValue {
  readonly type: PolicyTimeValueType;
  readonly hours?: number;
  readonly days?: number;
  readonly date?: string;
  readonly interval?: { readonly from: string; readonly to: string };
}

export interface ShippingPolicyRecord {
  readonly policy_id: string;
  readonly policy_version: string;
  readonly policy_text_ref: string | null;
  readonly owner_approval: OwnerApproval | null;
  readonly merchant_id: string | null;
  readonly store_id: string | null;
  readonly platform_account_id: string | null;
  readonly applicability: PolicyApplicability;
  readonly product_scope: ProductScope | null;
  readonly clock_start: { readonly event: string } | null;
  readonly ship_complete_definition: string | null;
  readonly time_value: PolicyTimeValue | null;
  readonly nature: PolicyNature | null;
  readonly timezone: string | null;
  readonly business_calendar: { readonly calendar_ref: string } | null;
  readonly cut_off: { readonly rule: string } | null;
  readonly effective: { readonly from: string | null; readonly to: string | null };
  readonly lifecycle: PolicyLifecycle;
  readonly replaces: string | null;
  readonly source_ref: string | null;
}

export interface ShippingPolicyEvaluationRequest {
  readonly merchant_id: string | null;
  readonly store_id: string | null;
  readonly platform_account_id: string | null;
  readonly product_ref: string | null;
  /** Trusted order start fact only; buyer/模型/页面文本永远不构成起算证据. */
  readonly order_start_evidence: { readonly source: string; readonly kind: string } | null;
  readonly ship_complete_evidence?: { readonly kind: string } | null;
  readonly fulfilment_exception?: { readonly kind: string } | null;
  readonly historical_commitment?: { readonly policy_id: string; readonly policy_version: string; readonly agreed_at: string } | null;
  /** Name is accepted only so the contract can prove it is NOT identity evidence. */
  readonly shop_name?: string | null;
  /** Injected evaluation time (no wall clock inside the contract). */
  readonly now: string | null;
}

export interface ShippingPolicyFact {
  readonly policy_id: string;
  readonly policy_version: string;
  readonly nature: PolicyNature;
  readonly time_value: PolicyTimeValue;
  readonly timezone: string | null;
  readonly business_calendar_ref: string | null;
  readonly cut_off_rule: string | null;
  readonly clock_start_event: string;
  readonly ship_complete_definition: string;
}

export interface ShippingPolicyEvaluation {
  readonly contract: typeof SHIPPING_POLICY_CONTRACT_ID;
  readonly policy_fact: ShippingPolicyFact | null;
  readonly applicability: "APPLICABLE" | "NOT_APPLICABLE" | "UNDETERMINED" | PolicyAbsenceState;
  readonly absence_state: PolicyAbsenceState | null;
  readonly scope: { readonly merchant_id: string | null; readonly store_id: string | null; readonly platform_account_id: string | null };
  readonly evidence: { readonly policy_id: string; readonly policy_version: string; readonly owner_approval_ref: string; readonly source_ref: string | null } | null;
  readonly validity: { readonly effective_from: string | null; readonly effective_to: string | null; readonly lifecycle: PolicyLifecycle } | null;
  readonly replaces: string | null;
  readonly ship_complete: { readonly definition: string | null; readonly evidenced: boolean | null };
  readonly order_start_time_known: boolean;
  readonly restriction_reasons: readonly ShippingPolicyRestrictionReason[];
  readonly identity_checks: { readonly name_used_as_identity: false; readonly cross_scope_substitution: false };
  /** Pinned to null: Lane A never derives an order-level shipping date or a delivery ETA. */
  readonly order_shipping_date: null;
  readonly delivery_eta: null;
  readonly newness: "NEWNESS_UNVERIFIED";
  readonly automaticProcessingEligible: false;
  readonly diagnostics: readonly string[];
}

export interface ShippingPolicyEvaluator {
  evaluate(request: ShippingPolicyEvaluationRequest): ShippingPolicyEvaluation;
  diagnostics(): {
    readonly contract: typeof SHIPPING_POLICY_CONTRACT_ID;
    readonly registeredPolicies: number;
    readonly activePolicies: number;
    readonly evaluations: number;
    readonly aiCalls: 0;
    readonly sendCalls: 0;
    readonly persistenceWrites: 0;
    readonly providerCalls: 0;
    readonly networkCalls: 0;
    readonly sideEffectGuarantee: "STRUCTURAL_INVARIANT_NOT_A_RUNTIME_MEASUREMENT";
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isPolicyLifecycle(value: unknown): value is PolicyLifecycle {
  return typeof value === "string" && (POLICY_LIFECYCLES as readonly string[]).includes(value);
}
export function isPolicyNature(value: unknown): value is PolicyNature {
  return typeof value === "string" && (POLICY_NATURES as readonly string[]).includes(value);
}
export function isPolicyTimeValueType(value: unknown): value is PolicyTimeValueType {
  return typeof value === "string" && (POLICY_TIME_VALUE_TYPES as readonly string[]).includes(value);
}
export function isAbsenceState(value: unknown): value is PolicyAbsenceState {
  return typeof value === "string" && (POLICY_ABSENCE_STATES as readonly string[]).includes(value);
}

interface ScopeSelection { readonly candidates: readonly ShippingPolicyRecord[]; readonly reasons: readonly ShippingPolicyRestrictionReason[]; readonly scopeBound: boolean; }

function selectByScope(request: ShippingPolicyEvaluationRequest, policies: readonly ShippingPolicyRecord[]): ScopeSelection {
  const reasons: ShippingPolicyRestrictionReason[] = [];
  if (!isNonEmptyString(request.merchant_id) || !isNonEmptyString(request.store_id)) {
    return { candidates: [], reasons: ["SCOPE_UNBOUND"], scopeBound: false };
  }
  const sameScope: ShippingPolicyRecord[] = [];
  let otherScopeSeen = false;
  let unboundSeen = false;
  for (const policy of policies) {
    if (!isNonEmptyString(policy.merchant_id) || !isNonEmptyString(policy.store_id)) { unboundSeen = true; continue; }
    const merchantMatches = policy.merchant_id === request.merchant_id;
    const storeMatches = policy.store_id === request.store_id;
    if (!merchantMatches || !storeMatches) { otherScopeSeen = true; continue; }
    if (isNonEmptyString(policy.platform_account_id)) {
      if (!isNonEmptyString(request.platform_account_id) || policy.platform_account_id !== request.platform_account_id) {
        // An account-specific policy cannot bind to an unbound/other account.
        return { candidates: [], reasons: ["SCOPE_UNBOUND"], scopeBound: false };
      }
    }
    sameScope.push(policy);
  }
  if (sameScope.length === 0) {
    if (unboundSeen) reasons.push("SCOPE_UNBOUND");
    else if (otherScopeSeen) reasons.push("SCOPE_MISMATCH");
    return { candidates: [], reasons, scopeBound: true };
  }
  return { candidates: sameScope, reasons, scopeBound: true };
}

function isWithinEffectiveWindow(policy: ShippingPolicyRecord, now: string | null): "IN_WINDOW" | "NOT_YET_EFFECTIVE" | "EXPIRED" | "UNKNOWN" {
  const from = policy.effective?.from ?? null;
  const to = policy.effective?.to ?? null;
  if (!isNonEmptyString(now)) return "UNKNOWN";
  if (isNonEmptyString(from) && now < from) return "NOT_YET_EFFECTIVE";
  if (isNonEmptyString(to) && now > to) return "EXPIRED";
  return "IN_WINDOW";
}

/** Replacement chain: a policy that explicitly replaces another one is allowed to win. */
function resolveReplacementChain(candidates: readonly ShippingPolicyRecord[]): { readonly winner: ShippingPolicyRecord | null; readonly conflict: boolean } {
  if (candidates.length === 1) return { winner: candidates[0], conflict: false };
  const ids = new Set(candidates.map((policy) => policy.policy_id));
  const replacedIds = new Set(candidates.map((policy) => policy.replaces).filter((value): value is string => isNonEmptyString(value)));
  const roots = candidates.filter((policy) => !replacedIds.has(policy.policy_id));
  // A single unreplaced head means the chain is explicitly linked.
  if (roots.length === 1 && candidates.every((policy) => policy.policy_id === roots[0].policy_id || replacedIds.has(policy.policy_id) || ids.has(roots[0].policy_id))) {
    const head = roots[0];
    const linked = candidates.every((policy) => policy.policy_id === head.policy_id || head.replaces === policy.policy_id || replacedIds.has(policy.policy_id));
    if (linked) return { winner: head, conflict: false };
  }
  return { winner: null, conflict: true };
}

export function evaluateShippingPolicy(
  request: ShippingPolicyEvaluationRequest,
  policies: readonly ShippingPolicyRecord[],
): ShippingPolicyEvaluation {
  const reasons: ShippingPolicyRestrictionReason[] = [];
  const diagnostics: string[] = [];
  if (isNonEmptyString(request.shop_name)) {
    // A shop name is never identity evidence; it is recorded as a diagnostic only.
    reasons.push("NAME_NOT_IDENTITY_EVIDENCE");
    diagnostics.push("SHOP_NAME_IGNORED_FOR_IDENTITY");
  }

  const selection = selectByScope(request, policies);
  for (const reason of selection.reasons) if (!reasons.includes(reason)) reasons.push(reason);

  const base = {
    contract: SHIPPING_POLICY_CONTRACT_ID,
    policy_fact: null,
    absence_state: "UNKNOWN" as PolicyAbsenceState | null,
    scope: { merchant_id: request.merchant_id, store_id: request.store_id, platform_account_id: request.platform_account_id },
    evidence: null,
    validity: null,
    replaces: null,
    ship_complete: { definition: null, evidenced: null },
    order_start_time_known: false,
    identity_checks: { name_used_as_identity: false as const, cross_scope_substitution: false as const },
    order_shipping_date: null,
    delivery_eta: null,
    newness: "NEWNESS_UNVERIFIED" as const,
    automaticProcessingEligible: false as const,
  };

  const restricted = (applicability: ShippingPolicyEvaluation["applicability"], absence: PolicyAbsenceState): ShippingPolicyEvaluation => Object.freeze({
    ...base,
    applicability,
    absence_state: absence,
    restriction_reasons: Object.freeze([...reasons]),
    diagnostics: Object.freeze([...diagnostics]),
  });

  if (!selection.scopeBound) return restricted("UNKNOWN", "UNKNOWN");
  if (selection.candidates.length === 0) {
    const explicitlyAbsent = policies.some((policy) => policy.lifecycle === "REVOKED" && policy.source_ref === "EXPLICITLY_ABSENT");
    if (explicitlyAbsent) {
      if (!reasons.includes("EXPLICITLY_ABSENT")) reasons.push("EXPLICITLY_ABSENT");
      return restricted("EXPLICITLY_ABSENT", "EXPLICITLY_ABSENT");
    }
    if (!reasons.includes("POLICY_MISSING")) reasons.push("POLICY_MISSING");
    return restricted("UNKNOWN", "UNKNOWN");
  }

  const active: ShippingPolicyRecord[] = [];
  const exclusionByPolicy = new Map<string, ShippingPolicyRestrictionReason[]>();
  const noteExclusion = (policy: ShippingPolicyRecord, reason: ShippingPolicyRestrictionReason): void => {
    const list = exclusionByPolicy.get(policy.policy_id) ?? [];
    if (!list.includes(reason)) list.push(reason);
    exclusionByPolicy.set(policy.policy_id, list);
  };
  for (const policy of selection.candidates) {
    switch (policy.lifecycle) {
      case "ACTIVE":
        active.push(policy);
        break;
      case "DRAFT":
        noteExclusion(policy, "DRAFT_NOT_EFFECTIVE");
        noteExclusion(policy, "POLICY_NOT_ACTIVE");
        break;
      case "NOT_EFFECTIVE":
        noteExclusion(policy, "POLICY_NOT_ACTIVE");
        break;
      case "SUPERSEDED":
        noteExclusion(policy, "SUPERSEDED");
        break;
      case "REVOKED":
        noteExclusion(policy, "REVOKED");
        break;
      default:
        noteExclusion(policy, "SEMANTICS_UNDECIDED");
        break;
    }
  }
  if (active.length === 0) {
    for (const list of exclusionByPolicy.values()) for (const reason of list) if (!reasons.includes(reason)) reasons.push(reason);
    return restricted("UNKNOWN", "UNKNOWN");
  }

  const inWindow: ShippingPolicyRecord[] = [];
  for (const policy of active) {
    const windowResult = isWithinEffectiveWindow(policy, request.now);
    if (windowResult === "IN_WINDOW") inWindow.push(policy);
    else if (windowResult === "NOT_YET_EFFECTIVE") noteExclusion(policy, "NOT_YET_EFFECTIVE");
    else if (windowResult === "EXPIRED") noteExclusion(policy, "EXPIRED");
    else noteExclusion(policy, "SEMANTICS_UNDECIDED");
  }
  if (inWindow.length === 0) {
    for (const list of exclusionByPolicy.values()) for (const reason of list) if (!reasons.includes(reason)) reasons.push(reason);
    return restricted("UNKNOWN", "UNKNOWN");
  }

  const chain = resolveReplacementChain(inWindow);
  if (chain.conflict || chain.winner === null) {
    if (!reasons.includes("CONFLICTING_POLICIES")) reasons.push("CONFLICTING_POLICIES");
    return restricted("UNKNOWN", "UNKNOWN");
  }
  const policy = chain.winner;
  for (const [excludedId, list] of exclusionByPolicy.entries()) {
    if (excludedId === policy.policy_id) continue;
    diagnostics.push("EXCLUDED_SIBLING_POLICY:" + excludedId + ":" + list.join("+"));
  }

  // Historical commitments keep their original policy version.
  const historical = request.historical_commitment ?? null;
  if (historical !== null && (historical.policy_id !== policy.policy_id || historical.policy_version !== policy.policy_version)) {
    if (!reasons.includes("HISTORICAL_COMMITMENT_PRESERVED")) reasons.push("HISTORICAL_COMMITMENT_PRESERVED");
    return restricted("NOT_APPLICABLE", "NOT_APPLICABLE");
  }

  // Product applicability: a store-wide policy never proves product-level applicability by itself.
  let applicability: ShippingPolicyEvaluation["applicability"] = "APPLICABLE";
  if (policy.applicability === "UNDETERMINED") {
    if (!reasons.includes("PRODUCT_APPLICABILITY_UNDETERMINED")) reasons.push("PRODUCT_APPLICABILITY_UNDETERMINED");
    applicability = "UNDETERMINED";
  } else if (policy.product_scope !== null) {
    const scope = policy.product_scope;
    const productRef = request.product_ref;
    if (scope.resolution === "UNDETERMINED" || !isNonEmptyString(productRef)) {
      if (!reasons.includes("PRODUCT_APPLICABILITY_UNDETERMINED")) reasons.push("PRODUCT_APPLICABILITY_UNDETERMINED");
      applicability = "UNDETERMINED";
    } else if (scope.exclude.includes(productRef) || scope.resolution === "NOT_APPLICABLE") {
      applicability = "NOT_APPLICABLE";
    } else if (scope.include.length > 0 && !scope.include.includes(productRef)) {
      if (!reasons.includes("PRODUCT_APPLICABILITY_UNDETERMINED")) reasons.push("PRODUCT_APPLICABILITY_UNDETERMINED");
      applicability = "UNDETERMINED";
    }
  }

  // Declared-field completeness gates. Nothing is defaulted.
  const nature = isPolicyNature(policy.nature) ? policy.nature : null;
  if (nature === null) reasons.push("NATURE_UNDECLARED");
  const timeValue = policy.time_value !== null && isPolicyTimeValueType(policy.time_value.type) ? policy.time_value : null;
  if (timeValue === null) reasons.push("TIME_VALUE_UNDECLARED");
  if (timeValue !== null && timeValue.type === "BUSINESS_DAYS" && policy.business_calendar === null) reasons.push("CALENDAR_MISSING");
  if (timeValue !== null && (timeValue.type === "DATE" || timeValue.type === "INTERVAL") && !isNonEmptyString(policy.timezone)) reasons.push("TIMEZONE_MISSING");
  if (!isNonEmptyString(policy.clock_start?.event)) reasons.push("CLOCK_START_UNDECLARED");
  if (!isNonEmptyString(policy.ship_complete_definition)) reasons.push("SHIP_COMPLETE_UNDECLARED");

  // Ship-complete evidence: a waybill upload is not a first valid carrier acceptance.
  const shipEvidence = request.ship_complete_evidence ?? null;
  let shipEvidenced: boolean | null = null;
  if (shipEvidence !== null) {
    const kind = isNonEmptyString(shipEvidence.kind) ? shipEvidence.kind : "";
    shipEvidenced = kind === "carrier_first_acceptance";
    if (!shipEvidenced) reasons.push("SHIP_COMPLETE_NOT_EVIDENCED");
  }

  // Order start time: buyer/模型/页面文本永远是 UNTRUSTED。
  const startEvidence = request.order_start_evidence ?? null;
  const trustStart = startEvidence !== null
    && isNonEmptyString(startEvidence.source)
    && !UNTRUSTED_ORDER_TIME_SOURCES.includes(startEvidence.source);
  if (!trustStart) reasons.push("ORDER_TIME_UNKNOWN");

  if (request.fulfilment_exception !== null && request.fulfilment_exception !== undefined) {
    if (!reasons.includes("FULFILMENT_EXCEPTION_NOT_MODELLED")) reasons.push("FULFILMENT_EXCEPTION_NOT_MODELLED");
  }

  const blockingReasons = reasons.filter((reason) => reason !== "ORDER_TIME_UNKNOWN" && reason !== "SHIP_COMPLETE_NOT_EVIDENCED"
    && reason !== "FULFILMENT_EXCEPTION_NOT_MODELLED" && reason !== "NAME_NOT_IDENTITY_EVIDENCE");
  const canServeFact = applicability === "APPLICABLE" && blockingReasons.length === 0 && policy.owner_approval !== null;

  const restrictionReasons = [...reasons];
  if (policy.owner_approval === null && !restrictionReasons.includes("SEMANTICS_UNDECIDED")) restrictionReasons.push("SEMANTICS_UNDECIDED");
  if (policy.cut_off === null) diagnostics.push("CUT_OFF_NOT_DECLARED");

  const fact: ShippingPolicyFact | null = canServeFact && nature !== null && timeValue !== null && isNonEmptyString(policy.clock_start?.event) && isNonEmptyString(policy.ship_complete_definition)
    ? Object.freeze({
      policy_id: policy.policy_id,
      policy_version: policy.policy_version,
      nature,
      time_value: Object.freeze({ ...timeValue }),
      timezone: policy.timezone,
      business_calendar_ref: policy.business_calendar?.calendar_ref ?? null,
      cut_off_rule: policy.cut_off?.rule ?? null,
      clock_start_event: policy.clock_start.event,
      ship_complete_definition: policy.ship_complete_definition,
    })
    : null;

  return Object.freeze({
    ...base,
    policy_fact: fact,
    applicability: fact === null && applicability === "APPLICABLE" ? "UNDETERMINED" : applicability,
    absence_state: fact === null ? "UNKNOWN" : null,
    evidence: policy.owner_approval === null ? null : Object.freeze({
      policy_id: policy.policy_id,
      policy_version: policy.policy_version,
      owner_approval_ref: policy.owner_approval.approval_evidence_ref,
      source_ref: policy.source_ref,
    }),
    validity: Object.freeze({ effective_from: policy.effective?.from ?? null, effective_to: policy.effective?.to ?? null, lifecycle: policy.lifecycle }),
    replaces: policy.replaces,
    ship_complete: Object.freeze({ definition: policy.ship_complete_definition, evidenced: shipEvidenced }),
    order_start_time_known: trustStart,
    restriction_reasons: Object.freeze(restrictionReasons),
    diagnostics: Object.freeze([...diagnostics]),
  });
}

/** Main-side evaluator with a DEFAULT-EMPTY registry: no policy is active unless explicitly supplied. */
export function createShippingPolicyEvaluator(policies: readonly ShippingPolicyRecord[] = []): ShippingPolicyEvaluator {
  const registry = [...policies];
  let evaluations = 0;
  return {
    evaluate(request: ShippingPolicyEvaluationRequest): ShippingPolicyEvaluation {
      evaluations += 1;
      return evaluateShippingPolicy(request, registry);
    },
    diagnostics() {
      return {
        contract: SHIPPING_POLICY_CONTRACT_ID,
        registeredPolicies: registry.length,
        activePolicies: registry.filter((policy) => policy.lifecycle === "ACTIVE").length,
        evaluations,
        aiCalls: 0,
        sendCalls: 0,
        persistenceWrites: 0,
        providerCalls: 0,
        networkCalls: 0,
        sideEffectGuarantee: "STRUCTURAL_INVARIANT_NOT_A_RUNTIME_MEASUREMENT" as const,
      };
    },
  };
}
