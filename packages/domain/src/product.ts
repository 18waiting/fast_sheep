/**
 * Product / SKU Domain (SHEEP-016, Phase 1 / M1.3 Product/Customer/Order Context).
 *
 * Governance basis:
 * - Master §7: Product sits under PlatformAccount.
 * - Master §5.4: merchant_id / store_id / platform_account_id scoping (general).
 * - Master §8: read_product is a platform-adapter capability (platform layer).
 * - DEC-008: Product is a Knowledge scope layer — this is Product KNOWLEDGE scope, and
 *   is NOT evidence for deciding Product identity Store-split semantics.
 *
 * Owner SHEEP-016 decisions / tightening applied:
 * D1: NO storeId is added now. Governance confirms Merchant + PlatformAccount context
 *     but not that Product identity is permanently store-split. Product<->Store
 *     identity/scope semantics is explicitly DEFERRED ("no storeId now" != "no Store
 *     association ever").
 * D2: Sku.productId models the minimal SKU->Product domain ownership ONLY. It carries
 *     no price, stock, spec, sales status, or platform SPU/SKU lifecycle semantics.
 * T1: ProductExternalRef and SkuExternalRef are INDEPENDENT, dedicated, opaque types;
 *     not merged; not AccountRef.
 * T2: No rules dictating Product SKU count, SKU lifecycle, variant options,
 *     price/stock/status business semantics.
 * T3: Product Domain != Product Knowledge. DEC-008 Product Knowledge scope must not
 *     decide Product identity's Store-split model.
 */

import type { MerchantId, PlatformAccountId } from "./merchant-domain.js";

/** Opaque, branded local product / sku identity ids. */
export type ProductId = string & { readonly __product: true };
export type SkuId = string & { readonly __sku: true };

/** Opaque platform-external product reference (dedicated type; NOT AccountRef). */
export interface ProductExternalRef {
  readonly value: string;
}

/** Opaque platform-external SKU reference (dedicated type; NOT AccountRef, NOT merged with product ref). */
export interface SkuExternalRef {
  readonly value: string;
}

/**
 * Normalized product identity core.
 * - merchantId / platformAccountId: governance-confirmed scopes (Master §7/§5.4).
 * - externalRef (OPTIONAL): platform-external product reference, identity only.
 * - storeId: intentionally NOT present (Product<->Store semantics DEFERRED).
 * - No catalog/business fields (title/price/stock/status) in the identity core.
 */
export interface Product {
  readonly id: ProductId;
  readonly merchantId: MerchantId;
  readonly platformAccountId: PlatformAccountId;
  readonly externalRef?: ProductExternalRef;
}

/**
 * Normalized SKU identity.
 * - productId: minimal SKU->Product domain ownership (D2). No price/stock/spec/
 *   sales-status/lifecycle semantics are attached here.
 * - externalRef (OPTIONAL): platform-external SKU reference, identity only.
 */
export interface Sku {
  readonly id: SkuId;
  readonly productId: ProductId;
  readonly externalRef?: SkuExternalRef;
}