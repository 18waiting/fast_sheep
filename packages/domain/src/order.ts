/**
 * Order / Logistics Domain (SHEEP-017, Phase 1 / M1.3 Product/Customer/Order Context).
 *
 * Governance basis:
 * - Master §7: Order sits under PlatformAccount.
 * - Master §5.4: merchant_id / store_id / platform_account_id scoping (general).
 * - Master §8: read_order / read_logistics / read_refund are platform-adapter
 *   capabilities (platform layer). read_refund is NOT evidence to build a Refund
 *   Domain here.
 * - DEC-006: read order/logistics are T0 read-only tools (Phase 8, not this task).
 *
 * Owner SHEEP-017 decisions / tightening applied:
 * D1: NO storeId on Order now; Order<->Store identity/scope semantics DEFERRED.
 * D2: Logistics.orderId expresses minimal Logistics->Order ownership; no Order<->Logistics
 *     cardinality/lifecycle rules (an Order may have zero/one/many Logistics in future;
 *     collections are not modeled here).
 * T1: Order is the ownership fact source for Logistics. Logistics does NOT repeat
 *     merchantId/platformAccountId (no dual fact sources). Authoritative scope
 *     validation belongs to persistence/authorization, not SHEEP-017.
 * T2: Order identity is not bound to Customer/Product/SKU/OrderLine. No customerId,
 *     productId, skuId, line items, amount, payment, refund fields (need future
 *     domain evidence and Context/Platform tasks).
 * T3: LogisticsExternalRef is an opaque external logistics identity reference only;
 *     it is NOT fixed as a tracking number/运单号, and no carrier/trackingNumber/
 *     status/events business fields are added.
 * T4: read_refund platform capability does NOT require a Refund Domain here.
 *     SHEEP-017 only builds Order / Logistics identity foundations.
 */

import type { MerchantId, PlatformAccountId } from "./merchant-domain.js";

/** Opaque, branded local order / logistics identity ids. */
export type OrderId = string & { readonly __order: true };
export type LogisticsId = string & { readonly __logistics: true };

/** Opaque platform-external order reference (dedicated type; NOT AccountRef). */
export interface OrderExternalRef {
  readonly value: string;
}

/**
 * Opaque platform-external logistics reference (dedicated type; NOT AccountRef).
 * Deliberately NOT interpreted as a tracking number / 运单号; no carrier/status/
 * events fields (T3).
 */
export interface LogisticsExternalRef {
  readonly value: string;
}

/**
 * Normalized order identity core.
 * - merchantId / platformAccountId: governance-confirmed scopes (Master §7/§5.4).
 * - externalRef (OPTIONAL): platform-external order reference, identity only.
 * - storeId: intentionally NOT present (Order<->Store semantics DEFERRED).
 * - No order business structure (customer/product/sku/line items/amount/payment/
 *   refund) — those need future domain evidence and Context/Platform tasks (T2).
 */
export interface Order {
  readonly id: OrderId;
  readonly merchantId: MerchantId;
  readonly platformAccountId: PlatformAccountId;
  readonly externalRef?: OrderExternalRef;
}

/**
 * Normalized logistics identity.
 * - orderId: minimal Logistics->Order ownership; Order is the ownership fact source,
 *   so Logistics does NOT repeat merchantId/platformAccountId (T1). No cardinality/
 *   lifecycle rules (D2).
 * - externalRef (OPTIONAL): opaque platform-external logistics identity reference
 *   (T3), identity only.
 */
export interface Logistics {
  readonly id: LogisticsId;
  readonly orderId: OrderId;
  readonly externalRef?: LogisticsExternalRef;
}