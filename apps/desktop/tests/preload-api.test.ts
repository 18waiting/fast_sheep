import { test } from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../dist/preload/api.js";
import { IPC } from "@fastwork/desktop-ipc";

const EXPECTED = [
  ["bootstrap", IPC.bootstrap, []],
  ["listShops", IPC.listShops, []],
  ["getSnapshot", IPC.snapshot, [{ shop_id: "s1" }]],
  ["getWorkerStatus", IPC.workerStatus, []],
  ["setMode", IPC.setMode, [{ shop_id: "s1", conversation_id: "c1", mode: "full_auto" }]],
  ["manualSend", IPC.manualSend, [{ shop_id: "s1", conversation_id: "c1" }]],
  ["noSaveSend", IPC.noSaveSend, [{ shop_id: "s1", conversation_id: "c1" }]],
  ["cancel", IPC.cancel, [{ shop_id: "s1", conversation_id: "c1" }]],
  ["focus", IPC.focus, [{ shop_id: "s2" }]],
  ["listJobs", IPC.jobsList, []],
  ["getJob", IPC.jobsGet, [{ job_id: "j1" }]],
  ["cancelJob", IPC.jobsCancel, [{ job_id: "j1" }]],
  ["startLearning", IPC.learningStart, [{ import_source: "chat.txt" }]],
  ["reviewAction", IPC.reviewPropose, [{ action: "propose" }]],
  ["auditAction", IPC.auditDecide, [{ action: "保留" }]],
  ["optimizationAction", IPC.optimizationPropose, [{ action: "propose" }]],
] as const;

test("preload api maps all 16 invoke methods to the exact typed channels", async () => {
  const calls: Array<{ channel: string; payload: unknown }> = [];
  const api = createApi(async (channel, payload) => {
    calls.push({ channel, payload });
    return { ok: true, data: {} };
  });
  for (const [method, channel, args] of EXPECTED) {
    await (api as unknown as Record<string, (a: unknown) => Promise<unknown>>)[method](...(args as unknown[]));
  }
  assert.equal(calls.length, EXPECTED.length);
  EXPECTED.forEach(([, channel], i) => assert.equal(calls[i].channel, channel));
});

test("preload api never exposes raw ipcRenderer or generic invoke", () => {
  const api = createApi(async () => ({ ok: true, data: {} }));
  const keys = Object.keys(api).sort();
  assert.deepEqual(keys, [
    "activatePlatformShop", "applyLegacyImport", "auditAction", "bootstrap", "cancel", "cancelJob",
    "cancelLegacyImport", "dryRunLegacyImport", "focus", "getJob", "getLegacyImportStatus",
    "getPlatformStatus", "getSnapshot", "getWorkerStatus", "listJobs", "listShops", "manualSend",
    "noSaveSend", "optimizationAction", "planLegacyImport", "reloadPlatform", "reviewAction",
    "scanLegacyImport", "selectLegacyImportSource", "setMode", "setPlatformViewBounds", "startLearning",
  ]);
  assert.ok(!("invoke" in api));
  assert.ok(!("ipcRenderer" in api));
  assert.ok(!("send" in api));
});
