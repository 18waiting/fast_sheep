import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildItemManifest } from "../dist/index.js";

test("manifest carries target aggregate/writer and counts", async () => {
  const root = mkdtempSync(join(tmpdir(), "fw-man-"));
  mkdirSync(join(root, "知识库"), { recursive: true });
  writeFileSync(join(root, "知识库", "A库全自动收录.csv"), "问题,答案,商品ID,标签\nq,a,10001,\n");
  const item = { item_id: "it-1", display_name: "A库全自动收录.csv", path: join(root, "知识库", "A库全自动收录.csv"), source_type: "knowledge" as const };
  const m = await buildItemManifest(item, "sel-1");
  assert.equal(m.target_aggregate, "knowledge_entries");
  assert.equal(m.target_writer, "worker");
  assert.equal(m.record_count, 1);
  assert.ok(m.source_fingerprint.sha256.length === 64);
});

test("manifest detects secret field names", async () => {
  const root = mkdtempSync(join(tmpdir(), "fw-man2-"));
  writeFileSync(join(root, "ai_settings.json"), JSON.stringify({ api_key: "fake-super-secret-value" }));
  const item = { item_id: "it-2", display_name: "ai_settings.json", path: join(root, "ai_settings.json"), source_type: "ai_settings" as const };
  const m = await buildItemManifest(item, "sel-2");
  assert.ok(m.secret_fields_detected.includes("api_key"));
});
