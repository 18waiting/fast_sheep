// M6 sandboxed preload entry (single self-contained classic script).
//
// IMPORTANT: Electron `sandbox: true` preloads cannot use ESM imports or
// relative `require(...)`. This file intentionally contains NO runtime
// import/export statements so `tsc` (module "none", see tsconfig.preload.json)
// emits a plain script. The pure factories in api.ts / subscriptions.ts mirror
// this surface and are exercised by the Node-side unit tests.
//
// Only the narrow, typed FastWorkDesktopAPI surface is exposed. The raw
// ipcRenderer object is never exposed to the renderer.

const { contextBridge, ipcRenderer } = require("electron");

// Channel allowlist mirrored from @fastwork/desktop-ipc (IPC). String literals
// keep this file self-contained for the sandboxed preload runtime.
const CH = {
  bootstrap: "desktop.bootstrap",
  listShops: "shops.list",
  snapshot: "orchestrator.snapshot",
  workerStatus: "worker.status",
  setMode: "orchestrator.set_mode",
  manualSend: "orchestrator.manual_send",
  noSaveSend: "orchestrator.no_save_send",
  cancel: "orchestrator.cancel",
  focus: "orchestrator.focus",
  orchestratorEvent: "orchestrator.event",
  workerStatusChanged: "worker.status_changed",
  shopsChanged: "shops.changed",
  platformStatus: "platform.status",
  platformActivateShop: "platform.activate_shop",
  platformSetViewBounds: "platform.set_view_bounds",
  platformReload: "platform.reload",
  platformStatusChanged: "platform.status_changed",
  jobsList: "jobs.list",
  jobsGet: "jobs.get",
  jobsCancel: "jobs.cancel",
  learningStart: "learning.start",
  reviewPropose: "review.propose",
  reviewApply: "review.apply",
  reviewRestore: "review.restore",
  auditDecide: "audit.decide",
  optimizationPropose: "optimization.propose",
  optimizationApply: "optimization.apply",
  jobsChanged: "jobs.changed",
  learningChanged: "learning.changed",
  reviewChanged: "review.changed",
  auditChanged: "audit.changed",
  optimizationChanged: "optimization.changed",
  legacyImportSelect: "legacy_import.select",
  legacyImportScan: "legacy_import.scan",
  legacyImportPlan: "legacy_import.plan",
  legacyImportDryRun: "legacy_import.dry_run",
  legacyImportApply: "legacy_import.apply",
  legacyImportStatus: "legacy_import.status",
  legacyImportCancel: "legacy_import.cancel",
  legacyImportChanged: "legacy_import.changed",
} as const;

function subscribe(channel: string, handler: (payload: unknown) => void): () => void {
  const listener = (_event: unknown, payload: unknown) => handler(payload);
  ipcRenderer.on(channel, listener as never);
  return () => {
    ipcRenderer.removeListener(channel, listener as never);
  };
}

const api = {
  bootstrap: () => ipcRenderer.invoke(CH.bootstrap),
  listShops: () => ipcRenderer.invoke(CH.listShops),
  getSnapshot: (req?: { shop_id?: string }) => ipcRenderer.invoke(CH.snapshot, req ?? {}),
  getWorkerStatus: () => ipcRenderer.invoke(CH.workerStatus),
  setMode: (req: { shop_id: string; conversation_id?: string; mode: "human_review" | "full_auto" }) =>
    ipcRenderer.invoke(CH.setMode, req),
  manualSend: (req: { shop_id: string; conversation_id: string }) => ipcRenderer.invoke(CH.manualSend, req),
  noSaveSend: (req: { shop_id: string; conversation_id: string }) => ipcRenderer.invoke(CH.noSaveSend, req),
  cancel: (req: { shop_id: string; conversation_id: string }) => ipcRenderer.invoke(CH.cancel, req),
  focus: (req: { shop_id: string }) => ipcRenderer.invoke(CH.focus, req),
  getPlatformStatus: (req: { shop_id: string }) => ipcRenderer.invoke(CH.platformStatus, req),
  activatePlatformShop: (req: { shop_id: string }) => ipcRenderer.invoke(CH.platformActivateShop, req),
  setPlatformViewBounds: (req: { shop_id: string; x: number; y: number; width: number; height: number; visible: boolean }) =>
    ipcRenderer.invoke(CH.platformSetViewBounds, req),
  reloadPlatform: (req: { shop_id: string }) => ipcRenderer.invoke(CH.platformReload, req),
  onOrchestratorEvent: (handler: (ev: unknown) => void) => subscribe(CH.orchestratorEvent, handler),
  onWorkerStatusChanged: (handler: (status: unknown) => void) => subscribe(CH.workerStatusChanged, handler),
  onShopsChanged: (handler: () => void) => subscribe(CH.shopsChanged, handler),
  onPlatformStatusChanged: (handler: (ev: unknown) => void) => subscribe(CH.platformStatusChanged, handler),
  listJobs: () => ipcRenderer.invoke(CH.jobsList),
  getJob: (req: { job_id: string }) => ipcRenderer.invoke(CH.jobsGet, req),
  cancelJob: (req: { job_id: string }) => ipcRenderer.invoke(CH.jobsCancel, req),
  startLearning: (req: { import_source?: string; config?: unknown }) => ipcRenderer.invoke(CH.learningStart, req ?? {}),
  reviewAction: (req: { action: string; request?: unknown }) => {
    const action = req.action || "propose";
    const channel = action === "apply" ? CH.reviewApply : action === "restore" ? CH.reviewRestore : CH.reviewPropose;
    return ipcRenderer.invoke(channel, req);
  },
  auditAction: (req: { action: string; entry?: unknown }) => ipcRenderer.invoke(CH.auditDecide, req),
  optimizationAction: (req: { action: string; request?: unknown }) => {
    const channel = (req.action || "propose") === "apply" ? CH.optimizationApply : CH.optimizationPropose;
    return ipcRenderer.invoke(channel, req);
  },
  onJobsChanged: (handler: (ev: unknown) => void) => subscribe(CH.jobsChanged, handler),
  onLearningChanged: (handler: (ev: unknown) => void) => subscribe(CH.learningChanged, handler),
  onReviewChanged: (handler: (ev: unknown) => void) => subscribe(CH.reviewChanged, handler),
  onAuditChanged: (handler: (ev: unknown) => void) => subscribe(CH.auditChanged, handler),
  onOptimizationChanged: (handler: (ev: unknown) => void) => subscribe(CH.optimizationChanged, handler),
  selectLegacyImportSource: () => ipcRenderer.invoke(CH.legacyImportSelect, {}),
  scanLegacyImport: (req: { selection_token?: string }) => ipcRenderer.invoke(CH.legacyImportScan, req ?? {}),
  planLegacyImport: (req: { selection_token?: string; options?: unknown }) => ipcRenderer.invoke(CH.legacyImportPlan, req ?? {}),
  dryRunLegacyImport: (req: { selection_token?: string; options?: unknown }) => ipcRenderer.invoke(CH.legacyImportDryRun, req ?? {}),
  applyLegacyImport: (req: { selection_token?: string; plan_sha256?: string; session_id?: string; legacy_timezone?: string; import_provider_secret?: boolean }) => ipcRenderer.invoke(CH.legacyImportApply, req ?? {}),
  getLegacyImportStatus: (req: { session_id?: string }) => ipcRenderer.invoke(CH.legacyImportStatus, req ?? {}),
  cancelLegacyImport: (req: { session_id?: string }) => ipcRenderer.invoke(CH.legacyImportCancel, req ?? {}),
  onLegacyImportChanged: (handler: (ev: unknown) => void) => subscribe(CH.legacyImportChanged, handler),
};

contextBridge.exposeInMainWorld("fastworkDesktop", api);


