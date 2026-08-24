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

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  account_ref_kind TEXT NOT NULL,      -- local|platform|cloud identity boundary
  account_ref_value TEXT NOT NULL
);

CREATE TABLE memberships (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  role TEXT NOT NULL
);
CREATE INDEX idx_memberships_merchant ON memberships(merchant_id);
CREATE INDEX idx_memberships_member ON memberships(member_id);

CREATE TABLE seats (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id)
);
CREATE INDEX idx_seats_merchant ON seats(merchant_id);