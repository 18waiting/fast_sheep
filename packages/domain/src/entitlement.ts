/**
 * Minimal Entitlement Contract (M1.5-R03, Phase 1 / M1.5 Early Cross-Cutting Foundation).
 *
 * This module defines ONLY the commercial-qualification boundary. It is NOT an
 * authorization engine: Capability / Resource Scope (SHEEP-012 authorization-domain)
 * and Entitlement remain independent. No role->entitlement, capability->entitlement,
 * or tool-permission judgments are implemented here (those are Phase 8+).
 *
 * Owner tightening applied:
 * 1. Entitlement Contract = commercial qualification boundary only; no authorization engine.
 * 2. LocalEntitlementBoundary defines the evidence contract + fail-closed decision
 *    boundary; it does NOT implement full evidence verification. Signature / validity /
 *    scope / grace verification of signed offline leases belongs to Phase 11
 *    (SHEEP-203..207). Phase 1 does not build a mini authorization system.
 * 3. `cloud_authoritative` evidence means "requires authoritative verification"; the
 *    local boundary fails closed when it cannot verify, but the kind is NOT defined as
 *    permanently invalid.
 * 4. `local_permitted` represents TRUSTED authorization evidence, NOT a user-modifiable
 *    local boolean switch; without a trusted verifier it fails closed.
 * 5. reason/error output never contains secrets, lease content, signatures, or
 *    sensitive business information (reasons are static, generic strings).
 * 6. EntitlementId stays extensible; no entitlement taxonomy and no business enums
 *    (no PDD_ENABLED / AI_AUTO_REPLY_ENABLED / MAX_SEATS).
 */

/** Feature entitlement identifier (extensible; taxonomy designed later). */
export type EntitlementId = string;

/** Evidence kinds recognized by the contract. */
export type EntitlementEvidenceKind = "cloud_authoritative" | "signed_offline_lease" | "local_permitted";

/** Evidence that a feature is commercially entitled. `ref` is opaque (never echoed into reasons). */
export interface EntitlementEvidence {
  readonly kind: EntitlementEvidenceKind;
  readonly ref?: string;
}

export type EntitlementDecision =
  | { readonly allow: true }
  | { readonly allow: false; readonly reason: string };

/** Local commercial-qualification boundary contract. */
export interface LocalEntitlementBoundary {
  evaluate(required: EntitlementId, evidence: EntitlementEvidence | null): EntitlementDecision;
}

/**
 * Deny-by-default local boundary (fail closed, no fail-open).
 * - No evidence / unknown evidence / unverifiable evidence -> DENY with a static,
 *   non-sensitive reason.
 * - signed_offline_lease is ACCEPTED as an evidence kind in Phase 1 (R-03: offline
 *   lease / grace can constitute valid evidence); detailed verification (signature,
 *   validity, scope, grace) is Phase 11.
 * - cloud_authoritative -> DENY with "requires authoritative verification" (NOT a
 *   permanent invalidation).
 * - local_permitted -> DENY with "requires trusted verification" (trusted evidence,
 *   not a local boolean).
 */
export class DenyByDefaultLocalEntitlementBoundary implements LocalEntitlementBoundary {
  evaluate(_required: EntitlementId, evidence: EntitlementEvidence | null): EntitlementDecision {
    if (!evidence) {
      return { allow: false, reason: "missing_entitlement_evidence" };
    }
    switch (evidence.kind) {
      case "signed_offline_lease":
        return { allow: true };
      case "cloud_authoritative":
        return { allow: false, reason: "cloud_authoritative_requires_authoritative_verification" };
      case "local_permitted":
        return { allow: false, reason: "local_permitted_requires_trusted_verification" };
      default:
        return { allow: false, reason: "unknown_entitlement_evidence" };
    }
  }
}