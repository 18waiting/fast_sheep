// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, resolveDataRoot, provisionDataRoot, SqliteConnection, MigrationRunner, PersistenceError, ERROR_CODES, DB_FILENAME, MIGRATIONS_DIR } from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fw-t-")); }

test("resolveDataRoot: explicit override wins; invalid relative root rejected", () => {
  const r = root();
  assert.ok(resolveDataRoot(r).startsWith(r));
  assert.throws(() => resolveDataRoot("relative/path"), (e) => e.code === ERROR_CODES.INVALID_DATA_ROOT);
});

test("provisionDataRoot creates required directories and exposes DB at root", () => {
  const r = root();
  const dr = provisionDataRoot(r);
  assert.equal(dr.databasePath, join(r, "fastwork.sqlite3"));
  for (const d of [dr.backupDir, dr.logsDir, dr.skillsDir, dr.derivedDir]) {
        assert.ok(existsSync(d));
  }
});
