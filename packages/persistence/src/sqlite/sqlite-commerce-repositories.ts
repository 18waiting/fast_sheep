// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// SHEEP-019-C: Sqlite implementations for commerce domain repositories.
import type { SqliteConnection } from "../db/sqlite-driver.js";
import type {
  CustomerRecord, DomainProductRecord, SkuRecord, OrderRecord, LogisticsRecord,
  CustomerRepository, DomainProductRepository, SkuRepository, OrderRepository, LogisticsRepository,
} from "../repositories/commerce-repositories.js";

interface CustomerRow { id: string; merchant_id: string; platform_account_id: string; external_ref: string | null; }
interface DProductRow { id: string; merchant_id: string; platform_account_id: string; external_ref: string | null; }
interface SkuRow { id: string; product_id: string; external_ref: string | null; }
interface OrderRow { id: string; merchant_id: string; platform_account_id: string; external_ref: string | null; }
interface LogisticsRow { id: string; order_id: string; external_ref: string | null; }

export class SqliteCustomerRepository implements CustomerRepository {
  constructor(private conn: SqliteConnection) {}
  save(c: CustomerRecord): void {
    this.conn.run("INSERT INTO customers (id, merchant_id, platform_account_id, external_ref) VALUES (?, ?, ?, ?)", c.id, c.merchantId, c.platformAccountId, c.externalRef ?? null);
  }
  findById(id: string): CustomerRecord | null {
    const r = this.conn.get<CustomerRow | undefined>("SELECT id, merchant_id, platform_account_id, external_ref FROM customers WHERE id = ?", id);
    return r ? { id: r.id, merchantId: r.merchant_id, platformAccountId: r.platform_account_id, externalRef: r.external_ref } : null;
  }
  listByMerchant(merchantId: string): CustomerRecord[] {
    return this.conn.all<CustomerRow>("SELECT id, merchant_id, platform_account_id, external_ref FROM customers WHERE merchant_id = ? ORDER BY id", merchantId)
      .map((r) => ({ id: r.id, merchantId: r.merchant_id, platformAccountId: r.platform_account_id, externalRef: r.external_ref }));
  }
}

export class SqliteDomainProductRepository implements DomainProductRepository {
  constructor(private conn: SqliteConnection) {}
  save(p: DomainProductRecord): void {
    this.conn.run("INSERT INTO domain_products (id, merchant_id, platform_account_id, external_ref) VALUES (?, ?, ?, ?)", p.id, p.merchantId, p.platformAccountId, p.externalRef ?? null);
  }
  findById(id: string): DomainProductRecord | null {
    const r = this.conn.get<DProductRow | undefined>("SELECT id, merchant_id, platform_account_id, external_ref FROM domain_products WHERE id = ?", id);
    return r ? { id: r.id, merchantId: r.merchant_id, platformAccountId: r.platform_account_id, externalRef: r.external_ref } : null;
  }
  listByMerchant(merchantId: string): DomainProductRecord[] {
    return this.conn.all<DProductRow>("SELECT id, merchant_id, platform_account_id, external_ref FROM domain_products WHERE merchant_id = ? ORDER BY id", merchantId)
      .map((r) => ({ id: r.id, merchantId: r.merchant_id, platformAccountId: r.platform_account_id, externalRef: r.external_ref }));
  }
}

export class SqliteSkuRepository implements SkuRepository {
  constructor(private conn: SqliteConnection) {}
  save(s: SkuRecord): void {
    this.conn.run("INSERT INTO skus (id, product_id, external_ref) VALUES (?, ?, ?)", s.id, s.productId, s.externalRef ?? null);
  }
  findById(id: string): SkuRecord | null {
    const r = this.conn.get<SkuRow | undefined>("SELECT id, product_id, external_ref FROM skus WHERE id = ?", id);
    return r ? { id: r.id, productId: r.product_id, externalRef: r.external_ref } : null;
  }
  listByProduct(productId: string): SkuRecord[] {
    return this.conn.all<SkuRow>("SELECT id, product_id, external_ref FROM skus WHERE product_id = ? ORDER BY id", productId)
      .map((r) => ({ id: r.id, productId: r.product_id, externalRef: r.external_ref }));
  }
}

export class SqliteOrderRepository implements OrderRepository {
  constructor(private conn: SqliteConnection) {}
  save(o: OrderRecord): void {
    this.conn.run("INSERT INTO orders (id, merchant_id, platform_account_id, external_ref) VALUES (?, ?, ?, ?)", o.id, o.merchantId, o.platformAccountId, o.externalRef ?? null);
  }
  findById(id: string): OrderRecord | null {
    const r = this.conn.get<OrderRow | undefined>("SELECT id, merchant_id, platform_account_id, external_ref FROM orders WHERE id = ?", id);
    return r ? { id: r.id, merchantId: r.merchant_id, platformAccountId: r.platform_account_id, externalRef: r.external_ref } : null;
  }
  listByMerchant(merchantId: string): OrderRecord[] {
    return this.conn.all<OrderRow>("SELECT id, merchant_id, platform_account_id, external_ref FROM orders WHERE merchant_id = ? ORDER BY id", merchantId)
      .map((r) => ({ id: r.id, merchantId: r.merchant_id, platformAccountId: r.platform_account_id, externalRef: r.external_ref }));
  }
}

export class SqliteLogisticsRepository implements LogisticsRepository {
  constructor(private conn: SqliteConnection) {}
  save(l: LogisticsRecord): void {
    this.conn.run("INSERT INTO logistics (id, order_id, external_ref) VALUES (?, ?, ?)", l.id, l.orderId, l.externalRef ?? null);
  }
  findById(id: string): LogisticsRecord | null {
    const r = this.conn.get<LogisticsRow | undefined>("SELECT id, order_id, external_ref FROM logistics WHERE id = ?", id);
    return r ? { id: r.id, orderId: r.order_id, externalRef: r.external_ref } : null;
  }
  listByOrder(orderId: string): LogisticsRecord[] {
    return this.conn.all<LogisticsRow>("SELECT id, order_id, external_ref FROM logistics WHERE order_id = ? ORDER BY id", orderId)
      .map((r) => ({ id: r.id, orderId: r.order_id, externalRef: r.external_ref }));
  }
}