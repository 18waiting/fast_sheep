// M6 renderer application wiring (clean-room).
// The renderer is a WorkbenchViewModel projection only; it never holds
// canonical business state and never touches Node/fs/sqlite/raw IPC.
import type { UiState } from "./state/view-model.js";
import { WorkbenchStore, type WorkbenchApiLike } from "./state/workbench-store.js";
import { renderAppShell } from "./components/app-shell.js";
import type { WorkbenchActions } from "./components/actions.js";
import type { M10PanelActions } from "./components/m10-panel-types.js";
import type { LegacyImportActions } from "./components/legacy-import-types.js";

export function mountApp(root: HTMLElement): WorkbenchStore {
  // Provided by the context-isolated preload (window.fastworkDesktop).
  const api: WorkbenchApiLike = window.fastworkDesktop;

  const store = new WorkbenchStore(api);
  const actions: WorkbenchActions = {
    onSelectShop: (shopId) => void store.selectShop(shopId),
    onSetMode: (mode) => void store.setMode(mode),
    onManualSend: () => void store.manualSend(),
    onNoSaveSend: () => void store.noSaveSend(),
    onCancel: () => void store.cancel(),
    onPlatformBoundsChange: (bounds) => void store.reportPlatformBounds(bounds),
    onReloadPlatform: () => void store.reloadPlatform(),
  };

  // M10 panels: projection/control only. All controls forward to typed IPC
  // commands; the renderer never mutates knowledge/products directly.
  const m10Actions: M10PanelActions = {
    onRefreshJobs: () => void store.refreshJobs(),
    onStartLearning: (source) => void store.startLearning(source),
    onReviewPropose: () => void store.reviewAction("propose"),
    onReviewApply: () => void store.reviewAction("apply"),
    onReviewRestore: () => void store.reviewAction("restore"),
    onAudit: (action) => void store.auditAction(action),
    onOptimizationPropose: (productId) => void store.optimizationAction("propose", productId),
    onOptimizationApply: (productId, detail) => void store.optimizationAction("apply", productId, detail),
    onCancelJob: (jobId) => void store.cancelJob(jobId),
  };

  // M11 legacy import: projection/control only.
  const legacyImportActions: LegacyImportActions = {
    onSelect: () => void store.selectLegacyImport(),
    onScan: () => void store.refreshLegacyImportStatus(),
    onPlan: () => void store.planLegacyImport(),
    onDryRun: () => void store.dryRunLegacyImport(),
    onApply: () => void store.applyLegacyImport(),
    onCancel: () => void store.cancelLegacyImport(),
    onRefreshStatus: () => void store.refreshLegacyImportStatus(),
  };

  const render = (state: UiState): void => {
    renderAppShell(root, state, actions, m10Actions, legacyImportActions);
  };

  store.subscribe(render);
  render(store.getState());

  // Narrow event subscriptions; stale/gapped events trigger an authoritative
  // snapshot reload from Main. No unbounded event history is kept.
  api.onOrchestratorEvent((ev) => void store.onEvent(ev));
  api.onWorkerStatusChanged(() => void store.resync());
  api.onShopsChanged(() => void store.resync());
  api.onPlatformStatusChanged((ev) => store.applyPlatformStatusChanged(ev));
  api.onJobsChanged?.((ev) => store.applyJobsChanged(ev));
  api.onLearningChanged?.((ev) => store.applyLearningChanged(ev));
  api.onReviewChanged?.((ev) => store.applyReviewChanged(ev));
  api.onAuditChanged?.((ev) => store.applyAuditChanged(ev));
  api.onOptimizationChanged?.((ev) => store.applyOptimizationChanged(ev));
  api.onLegacyImportChanged?.((ev) => store.applyLegacyImportChanged(ev));

  void store.boot().then(() => {
    // Boot marker for the real-Electron smoke probe (test mode only reads it).
    if (document.body) document.body.dataset.booted = "true";
  });

  return store;
}
