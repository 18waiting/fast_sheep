-- 0005_identity_domain.sql — Phase 1 identity domain persistence (SHEEP-019-A).
-- Append-only; 0001-0004 unchanged; legacy tables (shops/products/conversations) coexist.
-- Entities: merchants, stores, platform_accounts, members, memberships, seats.
-- NOTE: members has NO merchant_id — Membership is the single Member<->Merchant
-- ownership fact source. No deleted_at / sync / revision fields (R-07 additivity only).

CREATE TABLE merchants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE stores (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  name TEXT NOT NULL,
  platform TEXT NOT NULL
);
CREATE INDEX idx_stores_merchant ON stores(merchant_id);

CREATE TABLE platform_accounts (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  platform TEXT NOT NULL,
  external_ref TEXT
);
CREATE INDEX idx_platform_accounts_merchant ON platform_accounts(merchant_id);

-- members / memberships / seats tables removed in realignment B2 (2026-10-12):
-- FastWork has no membership/seat/billing line (owner decision D2).
