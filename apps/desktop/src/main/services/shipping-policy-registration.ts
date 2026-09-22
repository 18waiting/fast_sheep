// SHEEP-305 Lane B — Owner material intake for offline policy registration (no activation).
//
// This module is the intake layer between an Owner-supplied confirmation and the offline registry:
//   - it validates the Owner material (raw identifier, verbatim chat text, structured items) and
//     registers it as DRAFT / NOT_EFFECTIVE;
//   - it preserves the verbatim text and the evidence reference as CONTENT approval only - no
//     approver name, no approval date and no signature record is ever invented;
//   - it converts a registration into the Lane A policy record so the two layers can be tested
//     together, always clamping the lifecycle so a registered policy can never become ACTIVE, and
//     leaving the activation-grade owner_approval EMPTY (Lane A therefore refuses to serve a fact);
//   - it never writes a real Store/PlatformAccount binding and is not wired into bootstrap.
//
// Caller premise (explicit): the caller is a trusted Main-side component. Scope equality is an
// ISOLATION check only - it is NOT ownership proof and NOT platform identity verification, and a
// registration here is in-memory (a rebuilt registry instance is empty), never a durable record.

import {
  createShippingPolicyRegistry,
  validateStructuredItems,
  type RegistrationRejectionReason,
  type RegistrationResult,
  type RegistrationScope,
  type ShippingPolicyRegistry,
} from "./shipping-policy-registry.js";
import type { ShippingPolicyRecord } from "./shipping-policy-contract.js";

/** The only content-approval evidence kind this round accepts. */
export const OWNER_CONTENT_APPROVAL_KIND = "OWNER_CHAT_TEXT" as const;

/** Owner-confirmed chat text for the controlled test shop (content confirmation only). */
export const MUYI_CONFIRMED_QUOTED_TEXT = "木易先生的常规现货，预计支付成功后 48 个连续小时内出现承运商首次有效揽收记录，周末及节假日计入。";

/** Structured mapping of the confirmed text. Nothing beyond the confirmed scope is derived. */
export const MUYI_CONFIRMED_STRUCTURED_ITEMS: readonly { readonly item: string; readonly value: string }[] = Object.freeze([
  { item: "nature", value: "EXPECTED" },
  { item: "applicability", value: "REGULAR_STOCK_ONLY (declared scope: 常规现货; not extended to all goods)" },
  { item: "clock_start", value: "PAYMENT_SUCCESS" },
  { item: "time_value", value: "CONTINUOUS_HOURS_48" },
  { item: "ship_complete_definition", value: "FIRST_VALID_CARRIER_ACCEPTANCE" },
  { item: "weekend_holiday_handling", value: "COUNTED_IN_CONTINUOUS_DURATION (no automatic extension)" },
]);

export interface OwnerPolicyRegistrationEntry {
  readonly registry: ShippingPolicyRegistry;
  declareOwnerIdentity(input: {
    readonly scope: RegistrationScope;
    readonly platform: string;
    readonly ownerDeclaredIdentifier: string;
    readonly basisRef: string;
    readonly declaredAt?: string | null;
  }): RegistrationResult;
  registerContentConfirmedPolicyVersion(input: {
    readonly scope: RegistrationScope;
    readonly policyId: string;
    readonly policyVersion: string;
    readonly quotedText: string;
    readonly structuredItems: readonly { readonly item: string; readonly value: string }[];
    readonly basisRef: string;
    readonly registeredAt?: string | null;
  }): RegistrationResult;
  /** Convenience: register the Owner-confirmed content verbatim (text and structured items). */
  registerMuyiConfirmedPolicyVersion(input: {
    readonly scope: RegistrationScope;
    readonly policyId: string;
    readonly policyVersion: string;
    readonly basisRef: string;
    readonly registeredAt?: string | null;
  }): RegistrationResult;
  get(registrationId: string, scope: RegistrationScope): ReturnType<ShippingPolicyRegistry["get"]>;
  list(scope: RegistrationScope): ReturnType<ShippingPolicyRegistry["list"]>;
  /** Lane A bridge: a registration as a policy record, always non-activatable. */
  toLaneAPolicyRecord(registrationId: string, scope: RegistrationScope):
    | { readonly ok: true; readonly record: ShippingPolicyRecord; readonly notes: readonly string[] }
    | { readonly ok: false; readonly reason: RegistrationRejectionReason };
  diagnostics(): ReturnType<ShippingPolicyRegistry["diagnostics"]> & { readonly laneARecordConversions: number };
}

function itemValue(items: readonly { readonly item: string; readonly value: string }[], item: string): string | null {
  const found = items.find((entry) => entry.item === item);
  return found && typeof found.value === "string" && found.value.trim().length > 0 ? found.value : null;
}

export function createOwnerPolicyRegistrationEntry(registry: ShippingPolicyRegistry = createShippingPolicyRegistry()): OwnerPolicyRegistrationEntry {
  let laneARecordConversions = 0;

  const entry: OwnerPolicyRegistrationEntry = {
    registry,

    declareOwnerIdentity(input) {
      return registry.registerOwnerIdentityDeclaration(input);
    },

    registerContentConfirmedPolicyVersion(input) {
      const activationAttempt = input as { readonly lifecycle?: unknown; readonly effective?: unknown };
      if (activationAttempt.lifecycle !== undefined || activationAttempt.effective !== undefined) {
        return { status: "REJECTED", reason: "EFFECTIVE_WINDOW_NOT_ALLOWED", registration_id: null, lifecycle: null };
      }
      const validated = validateStructuredItems(input.structuredItems);
      if (!validated.ok) return { status: "REJECTED", reason: validated.reason, registration_id: null, lifecycle: null };
      return registry.registerPolicyVersion(input);
    },

    registerMuyiConfirmedPolicyVersion(input) {
      return registry.registerPolicyVersion({
        scope: input.scope,
        policyId: input.policyId,
        policyVersion: input.policyVersion,
        quotedText: MUYI_CONFIRMED_QUOTED_TEXT,
        structuredItems: MUYI_CONFIRMED_STRUCTURED_ITEMS,
        basisRef: input.basisRef,
        registeredAt: input.registeredAt ?? null,
      });
    },

    get(registrationId, scope) {
      return registry.get(registrationId, scope);
    },

    list(scope) {
      return registry.list(scope);
    },

    toLaneAPolicyRecord(registrationId, scope) {
      const found = registry.get(registrationId, scope);
      if (!found.ok) return { ok: false, reason: found.reason };
      const registration = found.record;
      if (registration.kind !== "POLICY_VERSION") return { ok: false, reason: "NOT_FOUND" };
      if (registration.lifecycle === "ACTIVE" || registration.lifecycle === "SUPERSEDED") {
        // Defensive: the registry exposes no activation path, so this must be unreachable.
        return { ok: false, reason: "RUNTIME_PROMOTION_NOT_AVAILABLE" };
      }
      const validated = validateStructuredItems(registration.structured_items);
      if (!validated.ok) return { ok: false, reason: validated.reason };
      const items = validated.canonical;
      const nature = itemValue(items, "nature");
      const clockStart = itemValue(items, "clock_start");
      const shipComplete = itemValue(items, "ship_complete_definition");
      const timeValue = itemValue(items, "time_value");
      const natureValue = nature === "EXPECTED" || nature === "COMMITTED" ? nature : null;
      const hours = timeValue === "CONTINUOUS_HOURS_48" ? 48 : null;
      const notes: string[] = [
        "registration scope ids are INTERNAL candidate scope values, not platform-verified external references",
        "owner_approval stays EMPTY: the Owner chat text is content evidence, not an activation-grade approval record (no approver name or date is invented)",
        "applicability stays UNDETERMINED: the confirmed scope (常规现货) is not extended to specific goods",
        "effective window is absent; timezone/cut-off were not part of the confirmed text",
        "the registry-level replacement relation is intentionally NOT exported to Lane A: Lane A does not validate the registration replacement chain",
        "this registration is in memory only; it is not a durable or cross-restart registration",
      ];
      const record: ShippingPolicyRecord = Object.freeze({
        policy_id: registration.policy_id,
        policy_version: registration.policy_version,
        policy_text_ref: "registry://" + registration.registration_id,
        owner_approval: null,
        merchant_id: registration.scope.merchantId,
        store_id: registration.scope.storeId,
        platform_account_id: registration.scope.platformAccountId,
        applicability: "UNDETERMINED",
        product_scope: null,
        clock_start: clockStart === null ? null : { event: clockStart.toLowerCase() },
        ship_complete_definition: shipComplete === null ? null : shipComplete.toLowerCase(),
        time_value: hours === null ? null : { type: "CONTINUOUS_HOURS" as const, hours },
        nature: natureValue,
        timezone: null,
        business_calendar: null,
        cut_off: null,
        effective: { from: null, to: null },
        lifecycle: registration.lifecycle === "REVOKED" ? "REVOKED" : registration.lifecycle === "NOT_EFFECTIVE" ? "NOT_EFFECTIVE" : "DRAFT",
        replaces: null,
        source_ref: "OWNER_CONFIRMED_CONTENT_REGISTRATION",
      });
      laneARecordConversions += 1;
      return { ok: true, record, notes: Object.freeze(notes) };
    },

    diagnostics() {
      return { ...registry.diagnostics(), laneARecordConversions };
    },
  };
  return entry;
}
