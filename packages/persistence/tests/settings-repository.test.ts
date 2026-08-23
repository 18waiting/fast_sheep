import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteConnection, DB_FILENAME } from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fw-t-")); }
function open() { return openDatabase(root()); }

import { SqliteSettingsRepository, PersistenceError, ERROR_CODES } from "../dist/index.js";
test("settings default insert, read, valid update", () => {
  const { conn } = open();
  const r = new SqliteSettingsRepository(conn);
  r.setGroup("RAGConfig", { embedding_dim: 1024, metric: "cosine", product_quality_threshold: 0.6 });
  assert.equal(r.getGroup("RAGConfig").embedding_dim, 1024);
  conn.close();
});
test("settings invalid schema rejected; old value intact", () => {
  const { conn } = open();
  const r = new SqliteSettingsRepository(conn);
  r.setGroup("RAGConfig", { embedding_dim: 1024, metric: "cosine", similarity_weight: 0.5 });
  assert.throws(() => r.setGroup("RAGConfig", { embedding_dim: 512, metric: "cosine" }), (e) => e.code === ERROR_CODES.INVALID_CONFIG);
  assert.equal(r.getGroup("RAGConfig").embedding_dim, 1024);
  assert.equal(r.getGroup("RAGConfig").similarity_weight, 0.5);
  conn.close();
});
test("settings defaults do not overwrite user values; credential_ref accepted, plain credential rejected", () => {
  const r = root();
  const a = openDatabase(r);
  const ra = new SqliteSettingsRepository(a.conn);
  ra.setGroup("AIConfig", { current_model: "custom", providers: [{ id: "c1", display_name: "c", provider: "custom", protocol: "chat_completions", base_url: "https://example.com/v1", model: "m", credential_ref: "vault:p1", enabled: true }], max_tokens: "20个字以内", image_recognition: true, question_completion: true });
  a.conn.close();
  const b = openDatabase(r);
  const rb = new SqliteSettingsRepository(b.conn);
  const cfg = rb.getGroup("AIConfig");
  assert.equal(cfg.providers[0].credential_ref, "vault:p1");
  assert.equal(cfg.providers[0].api_key, undefined);
  assert.throws(() => rb.setGroup("AIConfig", { current_model: "x", providers: [{ id: "c", display_name: "c", provider: "custom", protocol: "chat_completions", base_url: "https://e/v1", model: "m", api_key: "fake-super-secret-value", enabled: true }], max_tokens: "x", image_recognition: true, question_completion: true }), (e) => e.code === ERROR_CODES.INVALID_CONFIG);
  const blob = b.conn.all("SELECT payload_json FROM config_groups").map((x) => x.payload_json).join("\n");
  assert.ok(!blob.includes("fake-super-secret-value"));
  b.conn.close();
});
