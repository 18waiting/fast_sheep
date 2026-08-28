-- 0009_relax_merchant_name.sql — Merchant identity bootstrap support (SHEEP-063-PR2-PR1, Option B).
-- Append-only forward migration; 0001-0008 unchanged (v8 -> v9).
--
-- DP-103 MERCHANT_IDENTITY_DOES_NOT_REQUIRE_KNOWN_DISPLAY_NAME:
--   MerchantId remains the authoritative identity; merchants.name may be NULL,
--   meaning "no trusted business/display-name fact yet". Identity validity is
--   unaffected by an unknown name.
-- DP-104 MIGRATION_0009_ONLY_RELAXES_UNEVIDENCED_MERCHANT_NAME_REQUIREMENT:
--   This migration ONLY removes the NOT NULL constraint on merchants.name. No
--   display/legal/cloud/status/owner/onboarding/profile fields are added.
-- I-23 PRESENTATION_FALLBACK_LABELS_MUST_NOT_BE_PERSISTED_AS_UNKNOWN_DOMAIN_FACTS:
--   UI presentation fallbacks (e.g. a workspace label) must never be written back
--   into merchant.name.
-- I-24 UNKNOWN_OPTIONAL_IDENTITY_FACTS_USE_NULL_NOT_MAGIC_OR_EMPTY_VALUES:
--   Unknown name is stored as NULL; never "", "default", a generated id, or any
--   magic placeholder.
--
-- Existing non-null merchant names are preserved verbatim (no rewrite/backfill).
-- SQLite cannot alter column nullability, so this is a table rebuild. PK and the
-- FK references from child tables are preserved by rebuilding with the same name.
-- Foreign key enforcement is suspended by the migration runner around migration
-- execution (standard SQLite schema-change procedure) and re-enabled afterwards.

CREATE TABLE merchants_v9 (
  id TEXT PRIMARY KEY,
  name TEXT
);

INSERT INTO merchants_v9 (id, name) SELECT id, name FROM merchants;

DROP TABLE merchants;

ALTER TABLE merchants_v9 RENAME TO merchants;
