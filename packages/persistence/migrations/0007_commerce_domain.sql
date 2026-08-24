-- 0007_commerce_domain.sql — Phase 1 commerce domain persistence (SHEEP-019-C).
-- Append-only; 0001-0006 unchanged. Table `domain_products` avoids legacy `products`.
-- Entities: customers, domain_products, skus, orders, logistics.
-- NOTE:
-- - customers/domain_products/orders have NO store_id (Store semantics DEFERRED).
-- - skus -> domain_products and logistics -> orders are single fact sources
--   (no duplicated merchant_id).
-- - external_ref is OPAQUE TEXT with NO UNIQUE constraint (no unconfirmed
--   identity-resolution/dedup semantics).
-- - FKs express structural relations only; NO ON DELETE CASCADE / deletion
--   propagation (delete/tombstone/retention semantics not implemented).

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  platform_account_id TEXT NOT NULL REFERENCES platform_accounts(id),
  external_ref TEXT
);
CREATE INDEX idx_customers_merchant ON customers(merchant_id);

CREATE TABLE domain_products (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  platform_account_id TEXT NOT NULL REFERENCES platform_accounts(id),
  external_ref TEXT
);
CREATE INDEX idx_domain_products_merchant ON domain_products(merchant_id);

CREATE TABLE skus (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES domain_products(id),
  external_ref TEXT
);
CREATE INDEX idx_skus_product ON skus(product_id);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  platform_account_id TEXT NOT NULL REFERENCES platform_accounts(id),
  external_ref TEXT
);
CREATE INDEX idx_orders_merchant ON orders(merchant_id);

CREATE TABLE logistics (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  external_ref TEXT
);
CREATE INDEX idx_logistics_order ON logistics(order_id);