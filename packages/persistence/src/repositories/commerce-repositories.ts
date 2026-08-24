// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// SHEEP-019-C: commerce domain persistence (Customer/DomainProduct/Sku/Order/Logistics).
// Constraints:
// - No delete/hard-delete/tombstone operations.
// - customers/domain_products/orders carry NO storeId (Store semantics DEFERRED).
// - skus carry productId only; logistics carry orderId only (single fact source;
//   no duplicated merchantId).
// - externalRef stays OPAQUE; no UNIQUE/dedup/identity-resolution semantics.

export interface CustomerRecord {
  id: string;
  merchantId: string;
  platformAccountId: string;
  externalRef?: string | null;
}

export interface DomainProductRecord {
  id: string;
  merchantId: string;
  platformAccountId: string;
  externalRef?: string | null;
}

export interface SkuRecord {
  id: string;
  productId: string;
  externalRef?: string | null;
}

export interface OrderRecord {
  id: string;
  merchantId: string;
  platformAccountId: string;
  externalRef?: string | null;
}

export interface LogisticsRecord {
  id: string;
  orderId: string;
  externalRef?: string | null;
}

export interface CustomerRepository {
  save(c: CustomerRecord): void;
  findById(id: string): CustomerRecord | null;
  listByMerchant(merchantId: string): CustomerRecord[];
}

export interface DomainProductRepository {
  save(p: DomainProductRecord): void;
  findById(id: string): DomainProductRecord | null;
  listByMerchant(merchantId: string): DomainProductRecord[];
}

export interface SkuRepository {
  save(s: SkuRecord): void;
  findById(id: string): SkuRecord | null;
  listByProduct(productId: string): SkuRecord[];
}

export interface OrderRepository {
  save(o: OrderRecord): void;
  findById(id: string): OrderRecord | null;
  listByMerchant(merchantId: string): OrderRecord[];
}

export interface LogisticsRepository {
  save(l: LogisticsRecord): void;
  findById(id: string): LogisticsRecord | null;
  listByOrder(orderId: string): LogisticsRecord[];
}