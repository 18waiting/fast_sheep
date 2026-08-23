import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanSelection } from "../dist/index.js";

test("scanSelection discovers known legacy files under an explicit root", () => {
  const root = mkdtempSync(join(tmpdir(), "fw-scan-"));
  writeFileSync(join(root, "shops.json"), "[]");
  mkdirSync(join(root, "知识库"), { recursive: true });
  writeFileSync(join(root, "知识库", "A库全自动收录.csv"), "问题,答案\nq,a\n");
  const r = scanSelection(root);
  assert.ok(r.items.some((i) => i.display_name === "shops.json"));
  assert.ok(r.items.some((i) => i.source_type === "knowledge"));
});

test("scanSelection never auto-scans outside the given root", () => {
  const root = mkdtempSync(join(tmpdir(), "fw-scan2-"));
  writeFileSync(join(root, "shops.json"), "[]");
  const r = scanSelection(root);
  assert.ok(r.items.every((i) => i.path.startsWith(root)));
});
