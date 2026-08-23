import { test } from "node:test";
import assert from "node:assert/strict";
import { ElectronImportDialog } from "../dist/main/import/legacy-import-dialog.js";

test("dialog wrapper forwards explicit open-file options", async () => {
  let called = false;
  const dialog = {
    showOpenDialog: async (options: unknown) => { called = true; return { canceled: false, filePaths: ["C:/data/shops.json"] }; },
  };
  const d = new ElectronImportDialog(dialog as never);
  const r = await d.showOpenDialog({});
  assert.equal(called, true);
  assert.equal(r.filePaths[0], "C:/data/shops.json");
});

test("dialog never auto-selects paths without an explicit user action", async () => {
  const dialog = { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) };
  const d = new ElectronImportDialog(dialog as never);
  const r = await d.showOpenDialog({});
  assert.equal(r.canceled, true);
  assert.equal(r.filePaths.length, 0);
});
