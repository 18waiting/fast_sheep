/**
 * Authorization Domain Model (SHEEP-012, Phase 1 / M1.1 Core Identity Domain).
 *
 * Governance basis:
 * - DEC-011: underlying authorization is Capability + Resource Scope;
 *   do not make long-term authorization depend on `if role == ...` logic.
 * - Master §5.4: merchant_id / store_id / platform_account_id scopes.
 * - Master §7 (team): Member -> Role -> Capabilities -> Resource Scope.
 * - Master §8: platform adapter capabilities (platform layer, NOT auth layer).
 *
 * Owner SHEEP-012 tightening constraints applied:
 * 1. Platform Capability != Authorization Capability. Master §8 capabilities are a
 *    SEPARATE platform-adapter concept; the authorization Capability registry is NOT
 *    seeded from them (no governance-enumerated auth capabilities yet).
 * 2. ResourceScope is a discriminated union over the three governance-confirmed kinds
 *    (merchant / store / platformAccount); every narrower scope retains explicit
 *    merchantId; no arbitrary optional-field combinations; no invented scope kinds.
 * 3. RoleCapabilitySet is authorization INPUT (composition structure) only; it is NOT
 *    a final role=>allow permission result; no concrete role->capability mapping here.
 * 4. Capability / ResourceScope are strictly separated from Commercial Entitlement
 *    (PDD_ENABLED / AI_AUTO_REPLY_ENABLED / MAX_STORES etc. belong to Phase 11 control).
 */

import type { MerchantId, StoreId, PlatformAccountId } from "./merchant-domain.js";
import type { RoleId } from "./membership-domain.js";

/** Authorization-layer capability identifier (extensible). */
export type CapabilityId = string;

/** Capability descriptor used when governance later defines auth capabilities. */
export interface CapabilityDescriptor {
  readonly id: CapabilityId;
  readonly description?: string;
}

/**
 * Capability registry CONTRACT (structure only).
 * Deliberately NOT seeded: governance has not enumerated authorization-layer
 * capabilities, so no canonical auth capability constants are defined here.
 * Platform capabilities (Master §8) are a separate concept (see below).
 */
export type CapabilityRegistry = ReadonlyMap<CapabilityId, CapabilityDescriptor>;

/**
 * Platform-adapter capability identifier — a SEPARATE concept from authorization
 * CapabilityId (Owner tightening #1). Master §8 lists these as normalized platform
 * adapter capabilities; they are NOT user-authorization capabilities.
 */
export type PlatformCapabilityId = string;

/** Master §8 platform adapter capability list (13 items, governance-confirmed). */
export const PLATFORM_CAPABILITIES: readonly PlatformCapabilityId[] = [
  "receive_message",
  "send_text",
  "send_image",
  "read_customer",
  "read_product",
  "read_order",
  "read_logistics",
  "read_refund",
  "send_product_card",
  "send_order_card",
  "transfer_human",
  "add_customer_tag",
  "add_internal_note",
] as const;

/**
 * Resource scope — discriminated union over the three governance-confirmed kinds.
 * Every variant carries an explicit merchantId (Merchant context retained);
 * no arbitrary optional-field combinations; no invented scope kinds.
 */
export type ResourceScope =
  | { readonly kind: "merchant"; readonly merchantId: MerchantId }
  | { readonly kind: "store"; readonly merchantId: MerchantId; readonly storeId: StoreId }
  | {
      readonly kind: "platformAccount";
      readonly merchantId: MerchantId;
      readonly platformAccountId: PlatformAccountId;
    };

/**
 * Role capability composition — authorization INPUT only (Owner tightening #3).
 * Represents the structure by which a default role composes capabilities.
 * It is NOT a final role=>allow permission decision, and SHEEP-012 does NOT fill
 * any concrete role->capability mapping (no governance evidence).
 */
export interface RoleCapabilitySet {
  readonly role: RoleId;
  readonly capabilities: readonly CapabilityId[];
}