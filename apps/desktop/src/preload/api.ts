// M6 preload API factory (pure, injectable, no Electron imports).
// This module is compiled to ESM and used by the Node-side unit tests.
// The sandboxed preload entry (index.ts) is a single self-contained classic
// script that exposes the same surface (Electron sandboxed preloads cannot use
// ESM imports or relative requires).
import { IPC } from "@fastwork/desktop-ipc";
import type {
  BootstrapState,
  CancelRequest,
  DesktopResult,
  FocusRequest,
  JobGetRequest,
  JobListResult,
  JobRecordView,
  LearningStartRequest,
  ManualSendRequest,
  NoSaveSendRequest,
  OptimizationActionRequest,
  PlatformActivateShopRequest,
  PlatformSetViewBoundsRequest,
  PlatformStatusView,
  ReviewActionRequest,
  AuditActionRequest,
  SetModeRequest,
  WorkbenchViewModel,
  WorkerStatusView,
  LegacyImportSelectRequest,
  LegacyImportSelectResult,
  LegacyImportPlanRequest,
  LegacyImportApplyAction,
  LegacyImportStatusView,
} from "@fastwork/desktop-ipc";

/** Minimal ipcRenderer.invoke-compatible adapter (dependency injection). */
export type InvokeFn = (channel: string, payload?: unknown) => Promise<unknown>;

/** The invoke methods of FastWorkDesktopAPI (no subscriptions). */
export interface DesktopApiInvokeSurface {
  bootstrap(): Promise<DesktopResult<BootstrapState>>;
  listShops(): Promise<DesktopResult<{ shops: Array<{ shop_id: string; name: string; type: string; enabled: boolean }> }>>;
  getSnapshot(req: { shop_id?: string }): Promise<DesktopResult<WorkbenchViewModel>>;
  getWorkerStatus(): Promise<DesktopResult<WorkerStatusView>>;
  setMode(req: SetModeRequest): Promise<DesktopResult<{ ok: boolean }>>;
  manualSend(req: ManualSendRequest): Promise<DesktopResult<{ ok: boolean }>>;
  noSaveSend(req: NoSaveSendRequest): Promise<DesktopResult<{ ok: boolean }>>;
  cancel(req: CancelRequest): Promise<DesktopResult<{ ok: boolean }>>;
  focus(req: FocusRequest): Promise<DesktopResult<{ ok: boolean }>>;
  getPlatformStatus(req: { shop_id: string }): Promise<DesktopResult<PlatformStatusView>>;
  activatePlatformShop(req: PlatformActivateShopRequest): Promise<DesktopResult<{ ok: boolean }>>;
  setPlatformViewBounds(req: PlatformSetViewBoundsRequest): Promise<DesktopResult<{ ok: boolean }>>;
  reloadPlatform(req: { shop_id: string }): Promise<DesktopResult<{ ok: boolean }>>;
  listJobs(): Promise<DesktopResult<JobListResult>>;
  getJob(req: JobGetRequest): Promise<DesktopResult<JobRecordView>>;
  cancelJob(req: JobGetRequest): Promise<DesktopResult<{ ok: boolean }>>;
  startLearning(req: LearningStartRequest): Promise<DesktopResult<{ job_id: string; ok: boolean }>>;
  reviewAction(req: ReviewActionRequest): Promise<DesktopResult<{ ok: boolean }>>;
  auditAction(req: AuditActionRequest): Promise<DesktopResult<{ ok: boolean }>>;
  optimizationAction(req: OptimizationActionRequest): Promise<DesktopResult<{ ok: boolean }>>;
  selectLegacyImportSource(req: LegacyImportSelectRequest): Promise<DesktopResult<LegacyImportSelectResult>>;
  scanLegacyImport(req: LegacyImportSelectRequest): Promise<DesktopResult<{ item_count: number }>>;
  planLegacyImport(req: LegacyImportPlanRequest): Promise<DesktopResult<{ plan_sha256: string }>>;
  dryRunLegacyImport(req: LegacyImportPlanRequest): Promise<DesktopResult<{ plan: unknown }>>;
  applyLegacyImport(req: LegacyImportApplyAction): Promise<DesktopResult<{ session_id: string; state: string }>>;
  getLegacyImportStatus(req: { session_id: string }): Promise<DesktopResult<LegacyImportStatusView>>;
  cancelLegacyImport(req: { session_id: string }): Promise<DesktopResult<{ ok: boolean }>>;
}

export function createApi(invoke: InvokeFn): DesktopApiInvokeSurface {
  return {
    bootstrap: () => invoke(IPC.bootstrap) as Promise<DesktopResult<BootstrapState>>,
    listShops: () => invoke(IPC.listShops) as Promise<DesktopResult<{ shops: Array<{ shop_id: string; name: string; type: string; enabled: boolean }> }>>,
    getSnapshot: (req) => invoke(IPC.snapshot, req ?? {}) as Promise<DesktopResult<WorkbenchViewModel>>,
    getWorkerStatus: () => invoke(IPC.workerStatus) as Promise<DesktopResult<WorkerStatusView>>,
    setMode: (req) => invoke(IPC.setMode, req) as Promise<DesktopResult<{ ok: boolean }>>,
    manualSend: (req) => invoke(IPC.manualSend, req) as Promise<DesktopResult<{ ok: boolean }>>,
    noSaveSend: (req) => invoke(IPC.noSaveSend, req) as Promise<DesktopResult<{ ok: boolean }>>,
    cancel: (req) => invoke(IPC.cancel, req) as Promise<DesktopResult<{ ok: boolean }>>,
    focus: (req) => invoke(IPC.focus, req) as Promise<DesktopResult<{ ok: boolean }>>,
    getPlatformStatus: (req) => invoke(IPC.platformStatus, req) as Promise<DesktopResult<PlatformStatusView>>,
    activatePlatformShop: (req) => invoke(IPC.platformActivateShop, req) as Promise<DesktopResult<{ ok: boolean }>>,
    setPlatformViewBounds: (req) => invoke(IPC.platformSetViewBounds, req) as Promise<DesktopResult<{ ok: boolean }>>,
    reloadPlatform: (req) => invoke(IPC.platformReload, req) as Promise<DesktopResult<{ ok: boolean }>>,
    listJobs: () => invoke(IPC.jobsList) as Promise<DesktopResult<JobListResult>>,
    getJob: (req) => invoke(IPC.jobsGet, req) as Promise<DesktopResult<JobRecordView>>,
    cancelJob: (req) => invoke(IPC.jobsCancel, req) as Promise<DesktopResult<{ ok: boolean }>>,
    startLearning: (req) => invoke(IPC.learningStart, req) as Promise<DesktopResult<{ job_id: string; ok: boolean }>>,
    reviewAction: (req) => invoke(IPC.reviewPropose, req) as Promise<DesktopResult<{ ok: boolean }>>,
    auditAction: (req) => invoke(IPC.auditDecide, req) as Promise<DesktopResult<{ ok: boolean }>>,
    optimizationAction: (req) => invoke(IPC.optimizationPropose, req) as Promise<DesktopResult<{ ok: boolean }>>,
    selectLegacyImportSource: (req) => invoke(IPC.legacyImportSelect, req) as Promise<DesktopResult<LegacyImportSelectResult>>,
    scanLegacyImport: (req) => invoke(IPC.legacyImportScan, req) as Promise<DesktopResult<{ item_count: number }>>,
    planLegacyImport: (req) => invoke(IPC.legacyImportPlan, req) as Promise<DesktopResult<{ plan_sha256: string }>>,
    dryRunLegacyImport: (req) => invoke(IPC.legacyImportDryRun, req) as Promise<DesktopResult<{ plan: unknown }>>,
    applyLegacyImport: (req) => invoke(IPC.legacyImportApply, req) as Promise<DesktopResult<{ session_id: string; state: string }>>,
    getLegacyImportStatus: (req) => invoke(IPC.legacyImportStatus, req) as Promise<DesktopResult<LegacyImportStatusView>>,
    cancelLegacyImport: (req) => invoke(IPC.legacyImportCancel, req) as Promise<DesktopResult<{ ok: boolean }>>,
  };
}
