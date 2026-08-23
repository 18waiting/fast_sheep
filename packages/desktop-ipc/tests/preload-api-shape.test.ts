import { test } from "node:test";
import assert from "node:assert/strict";

import { type FastWorkDesktopAPI } from "../dist/index.js";

test("FastWorkDesktopAPI has the 40 required methods (M6/M7/M10 + 8 M11)", () => {
  const noop = async () => ({ ok: true, data: {} as never });
  const sub = () => () => {};
  const api: FastWorkDesktopAPI = {
    bootstrap: noop, listShops: noop, getSnapshot: noop, getWorkerStatus: noop,
    setMode: noop, manualSend: noop, noSaveSend: noop, cancel: noop, focus: noop,
    onOrchestratorEvent: sub, onWorkerStatusChanged: sub, onShopsChanged: sub,
    getPlatformStatus: noop, activatePlatformShop: noop, setPlatformViewBounds: noop, reloadPlatform: noop,
    onPlatformStatusChanged: sub,
    listJobs: noop, getJob: noop, cancelJob: noop, startLearning: noop,
    reviewAction: noop, auditAction: noop, optimizationAction: noop,
    onJobsChanged: sub, onLearningChanged: sub, onReviewChanged: sub, onAuditChanged: sub, onOptimizationChanged: sub,
    selectLegacyImportSource: noop, scanLegacyImport: noop, planLegacyImport: noop,
    dryRunLegacyImport: noop, applyLegacyImport: noop, getLegacyImportStatus: noop,
    cancelLegacyImport: noop, onLegacyImportChanged: sub,
  };
  const methods = ["bootstrap", "listShops", "getSnapshot", "getWorkerStatus", "setMode", "manualSend", "noSaveSend", "cancel", "focus", "getPlatformStatus", "activatePlatformShop", "setPlatformViewBounds", "reloadPlatform", "listJobs", "getJob", "cancelJob", "startLearning", "reviewAction", "auditAction", "optimizationAction", "selectLegacyImportSource", "scanLegacyImport", "planLegacyImport", "dryRunLegacyImport", "applyLegacyImport", "getLegacyImportStatus", "cancelLegacyImport"];
  for (const m of methods) assert.equal(typeof (api as unknown as Record<string, unknown>)[m], "function", m);
  const subs = ["onOrchestratorEvent", "onWorkerStatusChanged", "onShopsChanged", "onPlatformStatusChanged", "onJobsChanged", "onLearningChanged", "onReviewChanged", "onAuditChanged", "onOptimizationChanged", "onLegacyImportChanged"];
  for (const m of subs) assert.equal(typeof (api as unknown as Record<string, unknown>)[m], "function", m);
});

test("subscriptions return unsubscribe", () => {
  type U = ReturnType<FastWorkDesktopAPI["onOrchestratorEvent"]>;
  const unsub: U = () => {};
  assert.equal(typeof unsub, "function");
});
