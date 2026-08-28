// FastWorkDesktopAPI preload surface (M6). No Electron classes in public types.
import type { BootstrapState, DesktopResult, WorkbenchViewModel, WorkerStatusView, SetModeRequest, ManualSendRequest, NoSaveSendRequest, CancelRequest, FocusRequest, OrchestratorEventPayload, PlatformStatusView, PlatformActivateShopRequest, PlatformSetViewBoundsRequest, PlatformReloadRequest, PlatformStatusChangedEvent, JobListResult, JobRecordView, JobGetRequest, JobCancelRequest, LearningStartRequest, ReviewActionRequest, AuditActionRequest, OptimizationActionRequest, LearningChangedEvent, ReviewChangedEvent, AuditChangedEvent, OptimizationChangedEvent, BackgroundJobEvent, LegacyImportSelectRequest, LegacyImportSelectResult, LegacyImportPlanRequest, LegacyImportApplyAction, LegacyImportStatusView, LegacyImportEvent, ConversationListRequest, ConversationListResult, ConversationTimelineRequest, ConversationTimelineResult } from "./types.js";

export interface Unsubscribe { (): void }

export interface FastWorkDesktopAPI {
  bootstrap(): Promise<DesktopResult<BootstrapState>>;
  listShops(): Promise<DesktopResult<{ shops: Array<{ shop_id: string; name: string; type: string; enabled: boolean }> }>>;
  getSnapshot(req: { shop_id?: string }): Promise<DesktopResult<WorkbenchViewModel>>;
  listConversations(req: ConversationListRequest): Promise<DesktopResult<ConversationListResult>>;
  listConversationMessages(req: ConversationTimelineRequest): Promise<DesktopResult<ConversationTimelineResult>>;
  getWorkerStatus(): Promise<DesktopResult<WorkerStatusView>>;
  setMode(req: SetModeRequest): Promise<DesktopResult<{ ok: boolean }>>;
  manualSend(req: ManualSendRequest): Promise<DesktopResult<{ ok: boolean }>>;
  noSaveSend(req: NoSaveSendRequest): Promise<DesktopResult<{ ok: boolean }>>;
  cancel(req: CancelRequest): Promise<DesktopResult<{ ok: boolean }>>;
  focus(req: FocusRequest): Promise<DesktopResult<{ ok: boolean }>>;
  onOrchestratorEvent(handler: (ev: OrchestratorEventPayload) => void): Unsubscribe;
  getPlatformStatus(req: { shop_id: string }): Promise<DesktopResult<PlatformStatusView>>;
  activatePlatformShop(req: PlatformActivateShopRequest): Promise<DesktopResult<{ ok: boolean }>>;
  setPlatformViewBounds(req: PlatformSetViewBoundsRequest): Promise<DesktopResult<{ ok: boolean }>>;
  reloadPlatform(req: PlatformReloadRequest): Promise<DesktopResult<{ ok: boolean }>>;
  onPlatformStatusChanged(handler: (ev: PlatformStatusChangedEvent) => void): Unsubscribe;
  onWorkerStatusChanged(handler: (status: WorkerStatusView) => void): Unsubscribe;
  onShopsChanged(handler: () => void): Unsubscribe;

  // ---- M10 ----
  listJobs(): Promise<DesktopResult<JobListResult>>;
  getJob(req: JobGetRequest): Promise<DesktopResult<JobRecordView>>;
  cancelJob(req: JobCancelRequest): Promise<DesktopResult<{ ok: boolean }>>;
  startLearning(req: LearningStartRequest): Promise<DesktopResult<{ job_id: string; ok: boolean }>>;
  reviewAction(req: ReviewActionRequest): Promise<DesktopResult<{ ok: boolean }>>;
  auditAction(req: AuditActionRequest): Promise<DesktopResult<{ ok: boolean }>>;
  optimizationAction(req: OptimizationActionRequest): Promise<DesktopResult<{ ok: boolean }>>;
  onJobsChanged(handler: (ev: BackgroundJobEvent) => void): Unsubscribe;
  onLearningChanged(handler: (ev: LearningChangedEvent) => void): Unsubscribe;
  onReviewChanged(handler: (ev: ReviewChangedEvent) => void): Unsubscribe;
  onAuditChanged(handler: (ev: AuditChangedEvent) => void): Unsubscribe;
  onOptimizationChanged(handler: (ev: OptimizationChangedEvent) => void): Unsubscribe;

  // ---- M11 ----
  selectLegacyImportSource(req: LegacyImportSelectRequest): Promise<DesktopResult<LegacyImportSelectResult>>;
  scanLegacyImport(req: LegacyImportSelectRequest): Promise<DesktopResult<{ item_count: number }>>;
  planLegacyImport(req: LegacyImportPlanRequest): Promise<DesktopResult<{ plan_sha256: string }>>;
  dryRunLegacyImport(req: LegacyImportPlanRequest): Promise<DesktopResult<{ plan: unknown }>>;
  applyLegacyImport(req: LegacyImportApplyAction): Promise<DesktopResult<{ session_id: string; state: string }>>;
  getLegacyImportStatus(req: { session_id: string }): Promise<DesktopResult<LegacyImportStatusView>>;
  cancelLegacyImport(req: { session_id: string }): Promise<DesktopResult<{ ok: boolean }>>;
  onLegacyImportChanged(handler: (ev: LegacyImportEvent) => void): Unsubscribe;
}

