import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteConnection, DB_FILENAME } from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fw-t-")); }
function open() { return openDatabase(root()); }

import { SqliteSettingsRepository } from "../dist/index.js";
test("default provisioning is insert-if-missing and idempotent", () => {
  const r = root();
  const a = openDatabase(r);
  const ra = new SqliteSettingsRepository(a.conn);
  ra.setGroup("RAGConfig", { embedding_dim: 1024, metric: "cosine", similarity_weight: 0.5 });
  assert.ok(ra.getGroup("CollaborationConfig")); // seeded
  a.conn.close();
  const b = openDatabase(r); // reopen -> seed runs again
  const rb = new SqliteSettingsRepository(b.conn);
  assert.equal(rb.getGroup("RAGConfig").similarity_weight, 0.5); // user value preserved
  assert.equal(rb.getGroup("CollaborationConfig").breaker_threshold, 2);
  b.conn.close();
});
