import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LegacyImportSelectionService } from "../dist/main/services/legacy-import-selection-service.js";

test("selection token is opaque and single-use", async () => {
  const root = mkdtempSync(join(tmpdir(), "fw-seltok-"));
  const p = join(root, "shops.json");
  writeFileSync(p, "[]");
  const dialog = { showOpenDialog: async () => ({ canceled: false, filePaths: [p] }) };
  const svc = new LegacyImportSelectionService(dialog as never);
  const first = await svc.select();
  assert.ok(first.selection_token.startsWith("seltok-"));
  assert.equal(first.item_count, 1);
  const sel = svc.take(first.selection_token);
  assert.ok(sel.items[0].path.startsWith(root));
  // Token is consumed.
  assert.equal(svc.peek(first.selection_token), null);
});

test("renderer never receives raw paths (only the token)", async () => {
  const root = mkdtempSync(join(tmpdir(), "fw-seltok2-"));
  const p = join(root, "shops.json");
  writeFileSync(p, "[]");
  const dialog = { showOpenDialog: async () => ({ canceled: false, filePaths: [p] }) };
  const svc = new LegacyImportSelectionService(dialog as never);
  const r = await svc.select();
  assert.ok(!JSON.stringify(r).includes(root));
});
