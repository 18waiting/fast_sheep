// M6 renderer workbench store (clean-room).
// Ephemeral UI projection only. Main / Orchestrator remain the sole business
// state authority. The store never decides generation staleness, takeover
// breaker, countdown send eligibility, feedback class, send serialization,
// provider route, or handoff decisions.
import type {
  BootstrapState,
  CancelRequest,
  DesktopResult,
  ManualSendRequest,
  NoSaveSendRequest,
  OrchestratorEventPayload,
  PlatformActivateShopRequest,
  PlatformSetViewBoundsRequest,
  PlatformStatusChangedEvent,
  PlatformStatusView,
  SetModeRequest,
  WorkbenchViewModel,
  WorkerStatusView,
  JobListResult,
  JobGetRequest,
  JobRecordView,
  LearningStartRequest,
  ReviewActionRequest,
  AuditActionRequest,
  OptimizationActionRequest,
  BackgroundJobEvent,
  LearningChangedEvent,
  ReviewChangedEvent,
  AuditChangedEvent,
  OptimizationChangedEvent,
  LegacyImportSelectRequest,
  LegacyImportSelectResult,
  LegacyImportPlanRequest,
  LegacyImportApplyAction,
  LegacyImportStatusView,
  ConversationListRequest,
  ConversationListResult,
  ConversationTimelineRequest,
  ConversationTimelineResult,
  QueueScope,
  QueuePlatformFilter,
  TimelineMessageView,
} from "@fastwork/desktop-ipc";
import { EMPTY_PLATFORM_VIEW_STATE, type PlatformViewState } from "./platform-view-state.js";
import type { M10PanelViewModel } from "../components/m10-panel-types.js";
import { EMPTY_M10_VIEW_MODEL } from "../components/m10-panel-types.js";
import type { LegacyImportPanelViewModel } from "../components/legacy-import-types.js";
import { EMPTY_LEGACY_IMPORT_VIEW_MODEL } from "../components/legacy-import-types.js";
import type { LegacyImportEvent } from "@fastwork/desktop-ipc";
import {
  EMPTY_UI_STATE,
  clearPendingCommand,
  revisionOf,
  selectShop as selectShopPure,
  setPendingCommand,
  setQueueScope as setQueueScopePure,
  setQueueItems as setQueueItemsPure,
  setQueueError as setQueueErrorPure,
  setQueuePlatform as setQueuePlatformPure,
  setQueueOptions as setQueueOptionsPure,
  setActiveConversation as setActiveConversationPure,
  setTimelineLoading as setTimelineLoadingPure,
  setTimelineItems as setTimelineItemsPure,
  setTimelineError as setTimelineErrorPure,
  clearTimeline as clearTimelinePure,
  type UiState,
} from "./view-model.js";
import { reduceEvent, shouldResync } from "./event-reducer.js";

export type StoreListener = (state: UiState) => void;

/** Narrow typed-IPC adapter used by the store (window.fastworkDesktop). */
export interface WorkbenchApiLike {
  bootstrap(): Promise<DesktopResult<BootstrapState>>;
  getSnapshot(req: { shop_id?: string }): Promise<DesktopResult<WorkbenchViewModel>>;
  listConversations?(req: ConversationListRequest): Promise<DesktopResult<ConversationListResult>>;
  listConversationMessages?(req: ConversationTimelineRequest): Promise<DesktopResult<ConversationTimelineResult>>;
  setMode(req: SetModeRequest): Promise<DesktopResult<{ ok: boolean }>>;
  manualSend(req: ManualSendRequest): Promise<DesktopResult<{ ok: boolean }>>;
  noSaveSend(req: NoSaveSendRequest): Promise<DesktopResult<{ ok: boolean }>>;
  cancel(req: CancelRequest): Promise<DesktopResult<{ ok: boolean }>>;
  focus(req: { shop_id: string }): Promise<DesktopResult<{ ok: boolean }>>;
  onOrchestratorEvent(handler: (ev: OrchestratorEventPayload) => void): () => void;
  onWorkerStatusChanged(handler: (status: WorkerStatusView) => void): () => void;
  onShopsChanged(handler: () => void): () => void;
  getPlatformStatus(req: { shop_id: string }): Promise<DesktopResult<PlatformStatusView>>;
  activatePlatformShop(req: PlatformActivateShopRequest): Promise<DesktopResult<{ ok: boolean }>>;
  setPlatformViewBounds(req: PlatformSetViewBoundsRequest): Promise<DesktopResult<{ ok: boolean }>>;
  reloadPlatform(req: { shop_id: string }): Promise<DesktopResult<{ ok: boolean }>>;
  onPlatformStatusChanged(handler: (ev: PlatformStatusChangedEvent) => void): () => void;
  listJobs?(): Promise<DesktopResult<JobListResult>>;
  getJob?(req: JobGetRequest): Promise<DesktopResult<JobRecordView>>;
  cancelJob?(req: JobGetRequest): Promise<DesktopResult<{ ok: boolean }>>;
  startLearning?(req: LearningStartRequest): Promise<DesktopResult<{ job_id: string; ok: boolean }>>;
  reviewAction?(req: ReviewActionRequest): Promise<DesktopResult<{ ok: boolean }>>;
  auditAction?(req: AuditActionRequest): Promise<DesktopResult<{ ok: boolean }>>;
  optimizationAction?(req: OptimizationActionRequest): Promise<DesktopResult<{ ok: boolean }>>;
  onJobsChanged?(handler: (ev: BackgroundJobEvent) => void): () => void;
  onLearningChanged?(handler: (ev: LearningChangedEvent) => void): () => void;
  onReviewChanged?(handler: (ev: ReviewChangedEvent) => void): () => void;
  onAuditChanged?(handler: (ev: AuditChangedEvent) => void): () => void;
  onOptimizationChanged?(handler: (ev: OptimizationChangedEvent) => void): () => void;
  selectLegacyImportSource?(req: LegacyImportSelectRequest): Promise<DesktopResult<LegacyImportSelectResult>>;
  scanLegacyImport?(req: LegacyImportSelectRequest): Promise<DesktopResult<{ item_count: number }>>;
  planLegacyImport?(req: LegacyImportPlanRequest): Promise<DesktopResult<{ plan_sha256: string }>>;
  dryRunLegacyImport?(req: LegacyImportPlanRequest): Promise<DesktopResult<{ plan: unknown }>>;
  applyLegacyImport?(req: LegacyImportApplyAction): Promise<DesktopResult<{ session_id: string; state: string }>>;
  getLegacyImportStatus?(req: { session_id: string }): Promise<DesktopResult<LegacyImportStatusView>>;
  cancelLegacyImport?(req: { session_id: string }): Promise<DesktopResult<{ ok: boolean }>>;
  onLegacyImportChanged?(handler: (ev: LegacyImportEvent) => void): () => void;
}

export class WorkbenchStore {
  private state: UiState = EMPTY_UI_STATE;
  private readonly listeners = new Set<StoreListener>();
  private resyncInFlight = false;

  constructor(private readonly api: WorkbenchApiLike) {}

  getState(): UiState {
    return this.state;
  }

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) l(this.state);
  }

  private setState(next: UiState): void {
    this.state = next;
    this.emit();
  }

  async boot(): Promise<void> {
    this.setState({ ...this.state, loading: true, lastError: null });
    const res = await this.api.bootstrap();
    if (!res.ok) {
      this.setState({ ...this.state, loading: false, lastError: safeMessage(res.error) });
      return;
    }
    this.applyBootstrap(res.data);
  }

  applyBootstrap(b: BootstrapState): void {
    const vm = b.view_model;
    const selected = vm.selected_shop_id ?? (vm.shop_summaries[0]?.shop_id ?? null);
    this.setState({
      ...this.state,
      viewModel: vm,
      selectedShopId: selected,
      loading: false,
      lastError: null,
      pendingCommand: null,
    });
    void this.refreshQueue();
  }

  applyViewModel(vm: WorkbenchViewModel): void {
    const selected = this.state.selectedShopId ?? vm.selected_shop_id ?? (vm.shop_summaries[0]?.shop_id ?? null);
    this.setState({ ...this.state, viewModel: vm, selectedShopId: selected, loading: false, lastError: null });
  }

  /** SHEEP-060: refresh Queue via Main typed projection (DP-57 semantic refresh: initial + scope-change re-query). */
  private queueRequestSeq = 0;

  /** SHEEP-061: refresh Queue via Main typed projection (platform filter + I-9 stale protection). */
  async refreshQueue(scope?: QueueScope, platform?: QueuePlatformFilter): Promise<void> {
    const targetScope = scope ?? this.state.queueScope;
    const targetPlatform = platform !== undefined ? platform : this.state.queuePlatform;
    this.setState(setQueueScopePure(this.state, targetScope));
    this.setState(setQueuePlatformPure(this.state, targetPlatform));
    if (!this.api.listConversations) {
      this.setState(setQueueErrorPure(this.state, "队列查询不可用"));
      return;
    }
    const seq = ++this.queueRequestSeq;
    const res = await this.api.listConversations({ scope: targetScope, platform: targetPlatform });
    if (seq !== this.queueRequestSeq) return; // I-9: stale response must not overwrite current scope
    if (!res.ok) {
      this.setState(setQueueErrorPure(this.state, safeMessage(res.error)));
      return;
    }
    this.setState(setQueueOptionsPure(this.state, res.data.stores, res.data.platforms));
    this.setState(setQueueItemsPure(this.state, res.data.items, res.data.scope));
  }

  /** SHEEP-060: change Queue Scope (re-query queue; does NOT touch active conversation, DP-59/5). */
  async setQueueScope(scope: QueueScope): Promise<void> {
    await this.refreshQueue(scope);
  }

  /** SHEEP-061: change Queue platform filter (I-8: composes by intersection; does NOT touch active conversation). */
  async setQueuePlatform(platform: QueuePlatformFilter | undefined): Promise<void> {
    await this.refreshQueue(undefined, platform);
  }

  /** SHEEP-060: activate conversation (DP-60/69: pointer/Enter activates; navigation state only).
   *  SHEEP-063: activation binds the Message Timeline to the active conversation (DP-85);
   *  switching identity clears old timeline facts first (DP-89/I-7), then loads. */
  activateConversation(conversationId: string | null): void {
    this.setState(setActiveConversationPure(this.state, conversationId));
    if (conversationId === null) {
      this.setState(clearTimelinePure(this.state));
      return;
    }
    if (this.state.timelineConversationId !== conversationId) {
      this.setState(clearTimelinePure(this.state));
    }
    void this.refreshTimeline(conversationId);
  }

  private timelineRequestSeq = 0;

  /** SHEEP-063: refresh Message Timeline via Main typed projection (DP-84/85 + I-14 stale
   *  protection: a stale response for a previous active conversation must not overwrite
   *  the current one). Failure is contained to the Timeline scope (DP-47/I-25). */
  async refreshTimeline(conversationId: string): Promise<void> {
    this.setState(setTimelineLoadingPure(this.state, conversationId));
    if (!this.api.listConversationMessages) {
      this.setState(setTimelineErrorPure(this.state, conversationId, "会话消息不可用"));
      return;
    }
    const seq = ++this.timelineRequestSeq;
    const res = await this.api.listConversationMessages({ conversation_id: conversationId });
    if (seq !== this.timelineRequestSeq) return; // I-14: stale response must not overwrite current active conversation
    if (!res.ok) {
      this.setState(setTimelineErrorPure(this.state, conversationId, safeMessage(res.error)));
      return;
    }
    this.setState(setTimelineItemsPure(this.state, conversationId, res.data.messages));
  }

    async onEvent(event: OrchestratorEventPayload): Promise<void> {
    const outcome = reduceEvent(this.state, event);
    if (!shouldResync(outcome)) return;
    // Event applied (or revision gap): reload the authoritative snapshot.
    await this.resync();
  }

  async resync(): Promise<void> {
    if (this.resyncInFlight) return;
    this.resyncInFlight = true;
    try {
      const req = this.state.selectedShopId ? { shop_id: this.state.selectedShopId } : {};
      const res = await this.api.getSnapshot(req);
      if (res.ok) this.applyViewModel(res.data);
      else this.setState({ ...this.state, lastError: safeMessage(res.error) });
    } finally {
      this.resyncInFlight = false;
    }
  }

  /** UI-local shop switch; loads a fresh authoritative snapshot from Main. */
  async selectShop(shopId: string): Promise<void> {
    const next = selectShopPure(this.state, shopId);
    this.setState({ ...next, pendingCommand: null });
    await this.resync();
    await this.activatePlatformFor(shopId);
  }

  /** Activate a platform session when a PDD shop is selected; reset otherwise. */
  async activatePlatformFor(shopId: string): Promise<void> {
    const shopType = this.state.viewModel?.shop_summaries.find((s) => s.shop_id === shopId)?.type;
    if (shopType === "pdd") {
      const res = await this.api.activatePlatformShop({ shop_id: shopId });
      if (!res.ok) {
        this.setState({ ...this.state, platform: { ...EMPTY_PLATFORM_VIEW_STATE, activeShopId: shopId, platformType: "pdd", sessionStatus: "ERROR", lastSafeError: safeMessage(res.error) } });
        return;
      }
      const status = await this.api.getPlatformStatus({ shop_id: shopId });
      if (status.ok) this.applyPlatformStatus(status.data);
    } else {
      this.setState({ ...this.state, platform: EMPTY_PLATFORM_VIEW_STATE });
    }
  }

  applyPlatformStatus(view: PlatformStatusView): void {
    this.setState({
      ...this.state,
      platform: {
        activeShopId: view.shop_id,
        platformType: view.platform,
        sessionStatus: view.session_status,
        viewVisible: view.view_visible,
        lastSafeError: view.last_error ?? null,
        capabilities: (view.capabilities as Record<string, boolean> | undefined) ?? {},
      },
    });
  }

  applyPlatformStatusChanged(ev: PlatformStatusChangedEvent): void {
    this.setState({
      ...this.state,
      platform: {
        activeShopId: ev.shop_id,
        platformType: this.state.platform.platformType ?? "pdd",
        sessionStatus: ev.session_status,
        viewVisible: this.state.platform.viewVisible,
        lastSafeError: ev.last_error ?? null,
        capabilities: this.state.platform.capabilities,
      },
    });
  }

  /** Report local surface bounds so Main can position the seller view. */
  async reportPlatformBounds(bounds: { x: number; y: number; width: number; height: number; visible: boolean }): Promise<void> {
    const shopId = this.state.selectedShopId;
    if (!shopId) return;
    const res = await this.api.setPlatformViewBounds({ shop_id: shopId, ...bounds });
    if (!res.ok) this.setState({ ...this.state, lastError: safeMessage(res.error) });
  }

  async reloadPlatform(): Promise<void> {
    const shopId = this.state.selectedShopId;
    if (!shopId) return;
    const res = await this.api.reloadPlatform({ shop_id: shopId });
    if (!res.ok) this.setState({ ...this.state, lastError: safeMessage(res.error) });
  }

  async setMode(mode: "human_review" | "full_auto"): Promise<void> {
    const s = this.state;
    const shopId = s.selectedShopId;
    const conversationId = s.viewModel?.conversation?.conversation_id ?? shopId;
    if (!shopId) return;
    this.setState(setPendingCommand(s, "set_mode"));
    const res = await this.api.setMode({ shop_id: shopId, conversation_id: conversationId ?? undefined, mode });
    this.finishCommand(res);
  }

  async manualSend(): Promise<void> {
    await this.runSendCommand("manual_send", (shopId, conversationId) =>
      this.api.manualSend({ shop_id: shopId, conversation_id: conversationId }));
  }

  async noSaveSend(): Promise<void> {
    await this.runSendCommand("no_save_send", (shopId, conversationId) =>
      this.api.noSaveSend({ shop_id: shopId, conversation_id: conversationId }));
  }

  async cancel(): Promise<void> {
    const s = this.state;
    const shopId = s.selectedShopId;
    const conversationId = s.viewModel?.conversation?.conversation_id;
    if (!shopId || !conversationId) return;
    this.setState(setPendingCommand(s, "cancel"));
    const res = await this.api.cancel({ shop_id: shopId, conversation_id: conversationId });
    this.finishCommand(res);
  }

  isCommandPending(command: UiState["pendingCommand"]): boolean {
    return this.state.pendingCommand === command;
  }

  private async runSendCommand(
    command: "manual_send" | "no_save_send",
    run: (shopId: string, conversationId: string) => Promise<DesktopResult<{ ok: boolean }>>,
  ): Promise<void> {
    const s = this.state;
    const shopId = s.selectedShopId;
    const conversationId = s.viewModel?.conversation?.conversation_id;
    if (!shopId || !conversationId) return;
    this.setState(setPendingCommand(s, command));
    const res = await run(shopId, conversationId);
    this.finishCommand(res);
  }

  private finishCommand(res: DesktopResult<{ ok: boolean }>): void {
    if (res.ok) {
      this.setState(clearPendingCommand(this.state));
      void this.resync();
    } else {
      // Keep the sanitized error visible; do not let a background resync clear it.
      this.setState({ ...clearPendingCommand(this.state), lastError: safeMessage(res.error) });
    }
  }

  // ---- M10 panels: projection + typed controls only ----
  private setM10(m10: M10PanelViewModel): void {
    this.setState({ ...this.state, m10 });
  }

  async refreshJobs(): Promise<void> {
    if (!this.api.listJobs) return;
    const res = await this.api.listJobs();
    if (!res.ok) {
      this.setState({ ...this.state, lastError: safeMessage(res.error) });
      return;
    }
    const jobs = res.data.jobs.map((j) => ({
      job_id: j.job_id,
      type: j.type,
      state: j.state,
      progress: j.progress,
      message: j.message ?? "",
    }));
    this.setM10({ ...(this.state.m10 ?? EMPTY_M10_VIEW_MODEL), jobs });
  }

  async startLearning(importSource?: string): Promise<void> {
    if (!this.api.startLearning) return;
    const res = await this.api.startLearning({ import_source: importSource ?? "" });
    if (!res.ok) this.setState({ ...this.state, lastError: safeMessage(res.error) });
    await this.refreshJobs();
  }

  async reviewAction(action: "propose" | "apply" | "restore"): Promise<void> {
    if (!this.api.reviewAction) return;
    const res = await this.api.reviewAction({ action, request: {} });
    if (!res.ok) this.setState({ ...this.state, lastError: safeMessage(res.error) });
    await this.refreshJobs();
  }

  async auditAction(action: "保留" | "丢弃" | "待定"): Promise<void> {
    if (!this.api.auditAction) return;
    const res = await this.api.auditAction({ action, entry: {} });
    if (!res.ok) this.setState({ ...this.state, lastError: safeMessage(res.error) });
    await this.refreshJobs();
  }

  async optimizationAction(action: "propose" | "apply", productId: string, detail?: string): Promise<void> {
    if (!this.api.optimizationAction) return;
    const request = action === "apply" ? { product_id: productId, proposal: { product_id: productId, detail: detail ?? "" } } : { product_id: productId };
    const res = await this.api.optimizationAction({ action, request });
    if (!res.ok) this.setState({ ...this.state, lastError: safeMessage(res.error) });
    await this.refreshJobs();
  }

  async cancelJob(jobId: string): Promise<void> {
    if (!this.api.cancelJob) return;
    const res = await this.api.cancelJob({ job_id: jobId });
    if (!res.ok) this.setState({ ...this.state, lastError: safeMessage(res.error) });
    await this.refreshJobs();
  }

  applyJobsChanged(ev: BackgroundJobEvent): void {
    const m10 = this.state.m10 ?? EMPTY_M10_VIEW_MODEL;
    this.setM10({ ...m10 });
    void this.refreshJobs();
  }

  applyLearningChanged(ev: LearningChangedEvent): void {
    const m10 = this.state.m10 ?? EMPTY_M10_VIEW_MODEL;
    this.setM10({ ...m10, lastLearningEvent: ev.event ?? String(ev) });
  }

  applyReviewChanged(ev: ReviewChangedEvent): void {
    const m10 = this.state.m10 ?? EMPTY_M10_VIEW_MODEL;
    this.setM10({ ...m10, lastReviewEvent: ev.event ?? String(ev) });
  }

  applyAuditChanged(ev: AuditChangedEvent): void {
    const m10 = this.state.m10 ?? EMPTY_M10_VIEW_MODEL;
    this.setM10({ ...m10, lastAuditEvent: ev.event ?? String(ev) });
  }

  applyOptimizationChanged(ev: OptimizationChangedEvent): void {
    const m10 = this.state.m10 ?? EMPTY_M10_VIEW_MODEL;
    this.setM10({ ...m10, lastOptimizationEvent: ev.event ?? String(ev) });
  }

  // ---- M11 legacy import: projection + typed controls only ----
  private setLegacyImport(li: LegacyImportPanelViewModel): void {
    this.setState({ ...this.state, legacyImport: li });
  }

  async selectLegacyImport(): Promise<void> {
    if (!this.api.selectLegacyImportSource) return;
    const res = await this.api.selectLegacyImportSource({});
    if (!res.ok) {
      this.setState({ ...this.state, lastError: safeMessage(res.error) });
      return;
    }
    const li = this.state.legacyImport ?? EMPTY_LEGACY_IMPORT_VIEW_MODEL;
    this.setLegacyImport({ ...li, selection_token: res.data.selection_token, item_count: res.data.item_count, plan: null, plan_sha256: null });
  }

  async planLegacyImport(): Promise<void> {
    const token = this.state.legacyImport?.selection_token;
    if (!token || !this.api.dryRunLegacyImport) return;
    const res = await this.api.dryRunLegacyImport({ selection_token: token });
    if (!res.ok) {
      this.setState({ ...this.state, lastError: safeMessage(res.error) });
      return;
    }
    const plan = res.data.plan as LegacyImportPanelViewModel["plan"] | null;
    const li = this.state.legacyImport ?? EMPTY_LEGACY_IMPORT_VIEW_MODEL;
    this.setLegacyImport({ ...li, plan, plan_sha256: plan?.plan_sha256 ?? null });
  }

  async dryRunLegacyImport(): Promise<void> {
    await this.planLegacyImport();
  }

  async applyLegacyImport(): Promise<void> {
    const li = this.state.legacyImport;
    if (!li?.selection_token || !this.api.applyLegacyImport) return;
    const res = await this.api.applyLegacyImport({ selection_token: li.selection_token, plan_sha256: li.plan_sha256 ?? "" });
    if (!res.ok) {
      this.setState({ ...this.state, lastError: safeMessage(res.error) });
      return;
    }
    await this.refreshLegacyImportStatus(res.data.session_id);
  }

  async cancelLegacyImport(): Promise<void> {
    const sessionId = this.state.legacyImport?.session?.session_id;
    if (!sessionId || !this.api.cancelLegacyImport) return;
    await this.api.cancelLegacyImport({ session_id: sessionId });
    await this.refreshLegacyImportStatus(sessionId);
  }

  async refreshLegacyImportStatus(sessionId?: string): Promise<void> {
    const id = sessionId ?? this.state.legacyImport?.session?.session_id;
    if (!id || !this.api.getLegacyImportStatus) return;
    const res = await this.api.getLegacyImportStatus({ session_id: id });
    if (!res.ok) {
      this.setState({ ...this.state, lastError: safeMessage(res.error) });
      return;
    }
    const li = this.state.legacyImport ?? EMPTY_LEGACY_IMPORT_VIEW_MODEL;
    this.setLegacyImport({ ...li, session: { session_id: res.data.session_id, state: res.data.state, phases: res.data.phases, error: res.data.error ?? null } });
  }

  applyLegacyImportChanged(ev: LegacyImportEvent): void {
    const li = this.state.legacyImport ?? EMPTY_LEGACY_IMPORT_VIEW_MODEL;
    this.setLegacyImport({ ...li });
    if (ev.payload && typeof ev.payload === "object" && "session_id" in ev.payload) {
      void this.refreshLegacyImportStatus(String((ev.payload as { session_id?: unknown }).session_id ?? ""));
    }
  }
}

function safeMessage(error: { code: string; message: string }): string {
  return error.message.slice(0, 200);
}

export function revisionOfStore(state: UiState): number {
  return revisionOf(state.viewModel);
}
