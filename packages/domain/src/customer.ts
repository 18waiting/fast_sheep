/**
 * Customer Domain (SHEEP-015, Phase 1 / M1.3 Product/Customer/Order Context).
 *
 * Governance basis:
 * - Master §7: Customer sits under PlatformAccount.
 * - Master §5.4: merchant_id / store_id / platform_account_id scoping (general guidance).
 * - Customer privacy/data basis: Master §15 (Data Classification), §25 (Merchant Data
 *   Governance), §26 (AI Data Handling & Untrusted Input — Minimum Necessary Context),
 *   §19 (Privacy / Telemetry / Diagnostics). NOTE: DEC-016 governs Telemetry/Logs/
 *   Diagnostics and is NOT the basis for Customer PII decisions.
 *
 * Owner SHEEP-015 tightening constraints applied:
 * 1. NO storeId is added now. Governance confirms Merchant + PlatformAccount context
 *    but does NOT decide whether Customer identity is permanently store-split.
 *    Customer<->Store identity/scope semantics is explicitly DEFERRED — "no storeId
 *    now" does NOT mean "no Store association ever".
 * 2. externalRef is OPTIONAL; its absence only means the Customer currently has no
 *    platform external identity reference. It MUST NOT trigger or imply nickname/phone/
 *    PII matching, dedup, merge, or cross-store identity resolution.
 * 3. Identity core is separated from profile/context: PII/display fields
 *    (name/nickname/phone/address) are NOT part of the identity contract, but this is
 *    NOT a permanent ban on PII in the Customer domain — a future
 *    Privacy/Data-governance-approved Customer Context/Profile may independently carry
 *    business-necessary information. This task only keeps the identity contract minimal.
 */

import type { MerchantId, PlatformAccountId } from "./merchant-domain.js";

/** Opaque, branded local customer identity id. */
export type CustomerId = string & { readonly __customer: true };

/**
 * Opaque platform-external customer reference (dedicated type; NOT AccountRef).
 * Absence of this reference is NOT evidence about customer identity beyond "no
 * platform external reference is currently recorded" (Owner tightening #2).
 */
export interface CustomerExternalRef {
  readonly value: string;
}

/**
 * Normalized customer identity core.
 * - merchantId / platformAccountId: governance-confirmed scopes (Master §7/§5.4).
 * - externalRef (OPTIONAL): platform-external customer reference, identity only.
 * - storeId: intentionally NOT present (Customer<->Store semantics DEFERRED).
 * - No PII/display fields in the identity core (separation from profile/context).
 */
export interface Customer {
  readonly id: CustomerId;
  readonly merchantId: MerchantId;
  readonly platformAccountId: PlatformAccountId;
  readonly externalRef?: CustomerExternalRef;
}