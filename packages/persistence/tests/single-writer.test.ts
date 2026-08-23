import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteConnection, DB_FILENAME } from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fw-t-")); }
function open() { return openDatabase(root()); }

import * as P from "../dist/index.js";
test("Node persistence does NOT export a knowledge mutation implementation", () => {
  assert.ok(!("KnowledgeRepository" in P));
  assert.ok(!("SqliteKnowledgeRepository" in P));
  assert.ok(!("KnowledgeCandidateRepository" in P));
  assert.ok("SqliteProductRepository" in P);   // MAIN-owned
  assert.ok("SqliteSettingsRepository" in P);  // MAIN-owned
});
