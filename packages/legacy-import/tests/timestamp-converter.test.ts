import { test } from "node:test";
import assert from "node:assert/strict";
import { convertLegacyTimestamp, LegacyImportError } from "../dist/index.js";

test("naive legacy timestamp requires an explicit timezone (never guessed)", () => {
  assert.throws(() => convertLegacyTimestamp("2026-08-15 10:00:00"), (e) => (e as LegacyImportError).code === "import.validation_error");
});

test("naive + explicit timezone converts to ISO-8601 UTC", () => {
  const r = convertLegacyTimestamp("2026-08-15 10:00:00", "Asia/Shanghai");
  assert.ok(r.converted.endsWith("Z"));
  assert.equal(r.timezone, "Asia/Shanghai");
});

test("already ISO passes through", () => {
  const r = convertLegacyTimestamp("2026-08-15T10:00:00Z");
  assert.equal(r.converted, "2026-08-15T10:00:00.000Z");
});

test("invalid timestamp errors", () => {
  assert.throws(() => convertLegacyTimestamp("garbage", "Asia/Shanghai"), (e) => (e as LegacyImportError).code === "import.parse_error");
});
