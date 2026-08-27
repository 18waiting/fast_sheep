// M6/M10 query handlers: bootstrap / shops / snapshot / worker.status / platform.status / jobs.
import { IPC, DesktopError, DESKTOP_ERROR_CODES, type BootstrapState, type DesktopResult, type JobListResult, type JobRecordView, type LegacyImportStatusView, type PlatformStatusView, type WorkbenchViewModel, type WorkerStatusView, type ConversationListRequest, type ConversationListResult, type QueueItemView } from "@fastwork/desktop-ipc";
import type { PlatformSessionCoordinator } from "../platforms/platform-session-coordinator.js";
import type { PlatformId } from "../platforms/platform-host-registry.js";
import type { OrchestratorHost } from "../services/orchestrator-host.js";
import type { ShopService } from "../services/shop-service.js";
import type { WorkerStatusService } from "../services/worker-status-service.js";
import type { WorkbenchProjectionService } from "../services/workbench-projection-service.js";
import type { BackgroundJobService } from "../services/background-job-service.js";
import type { LegacyImportService } from "../services/legacy-import-service.js";
import type { NormalizedConversationRepository, StoreRepository } from "@fastwork/persistence";
import { ok, err } from "./ipc-guard.js";

export interface QueryDeps {
  orchestrator: OrchestratorHost;
  shops: ShopService;
  worker: WorkerStatusService;
  projection: WorkbenchProjectionService;
  coordinator: PlatformSessionCoordinator;
  platformForShop(shopId: string): string | null;
  revision(): number;
  jobs: BackgroundJobService;
  legacyImport: LegacyImportService;
  /** PR1/SHEEP-060: Conversation repository port (merchant-constrained Main-side queries). */
  conversations: NormalizedConversationRepository;
  /** SHEEP-060: Store repository port (merchant boundary resolution). */
  stores: StoreRepository;
  /** SHEEP-060: currently selected shop id (provisional queue scope merchant anchor). */
  selectedShopId(): string | null;
}

export const QUERY_HANDLERS = {
  [IPC.bootstrap]: (deps: QueryDeps) => async (): Promise<DesktopResult<BootstrapState>> => {
    const worker = deps.worker.status();
    const shops = await deps.shops.list();
    const viewModel = deps.projection.project();
    return ok({ revision: deps.revision(), worker_status: worker, shops, view_model: viewModel });
  },
  [IPC.listShops]: (deps: QueryDeps) => async (): Promise<DesktopResult<{ shops: Array<{ shop_id: string; name: string; type: string; enabled: boolean }> }>> => {
    return ok({ shops: await deps.shops.list() });
  },
  [IPC.snapshot]: (deps: QueryDeps) => async (req: { shop_id?: string }): Promise<DesktopResult<WorkbenchViewModel>> => {
    return ok(deps.projection.project());
  },
  [IPC.conversationsList]: (deps: QueryDeps) => async (req: ConversationListRequest): Promise<DesktopResult<ConversationListResult>> => {
    if (!req || !req.scope) return err(new DesktopError(DESKTOP_ERROR_CODES.INVALID_REQUEST, "missing queue scope"));
    const scope = req.scope;
    let items: QueueItemView[] = [];
    if (scope.kind === "specific_store") {
      const store = deps.stores.findById(scope.storeId);
      if (!store) return err(new DesktopError(DESKTOP_ERROR_CODES.NOT_FOUND, "unknown store"));
      // Merchant boundary enforced Main-side (I-6); renderer never supplies merchant.
      items = deps.conversations.listByStore(store.id)
        .filter((c) => c.merchantId === store.merchantId)
        .map((c) => ({ conversation_id: c.id, store_id: c.storeId }))
        .sort((a, b) => (a.conversation_id < b.conversation_id ? -1 : a.conversation_id > b.conversation_id ? 1 : 0));
    } else {
      // all_stores: merchant boundary = currently selected shop's store (provisional; full All Stores UI = SHEEP-061)
      const sid = deps.selectedShopId();
      const store = sid ? deps.stores.findById(sid) : null;
      if (store) {
        items = deps.conversations.listByMerchant(store.merchantId)
          .map((c) => ({ conversation_id: c.id, store_id: c.storeId }))
          .sort((a, b) => (a.conversation_id < b.conversation_id ? -1 : a.conversation_id > b.conversation_id ? 1 : 0));
      }
    }
    return ok({ items, scope });
  },
    [IPC.workerStatus]: (deps: QueryDeps) => async (): Promise<DesktopResult<WorkerStatusView>> => {
    return ok(deps.worker.status());
  },
  [IPC.platformStatus]: (deps: QueryDeps) => async (req: { shop_id: string }): Promise<DesktopResult<PlatformStatusView>> => {
    const platform = deps.platformForShop(req.shop_id) as PlatformId | null;
    if (!platform) return err(new DesktopError(DESKTOP_ERROR_CODES.NOT_FOUND, "unknown platform shop"));
    const status = deps.coordinator.status(platform, req.shop_id);
    if (!status) return err(new DesktopError(DESKTOP_ERROR_CODES.NOT_FOUND, "unknown platform shop"));
    return ok(status as PlatformStatusView);
  },
  [IPC.jobsList]: (deps: QueryDeps) => async (): Promise<DesktopResult<JobListResult>> => {
    return ok({ jobs: deps.jobs.list().map(toJobView) });
  },
  [IPC.jobsGet]: (deps: QueryDeps) => async (req: { job_id: string }): Promise<DesktopResult<JobRecordView>> => {
    const job = deps.jobs.get(req.job_id);
    if (!job) return err(new DesktopError(DESKTOP_ERROR_CODES.NOT_FOUND, "unknown job"));
    return ok(toJobView(job));
  },
  [IPC.legacyImportStatus]: (deps: QueryDeps) => async (req: { session_id: string }): Promise<DesktopResult<LegacyImportStatusView>> => {
    try {
      const view = await deps.legacyImport.status(req.session_id);
      if (!view) return err(new DesktopError(DESKTOP_ERROR_CODES.NOT_FOUND, "unknown import session"));
      return ok(view);
    } catch {
      return err(new DesktopError(DESKTOP_ERROR_CODES.NOT_FOUND, "unknown import session"));
    }
  },
} as const;

export function toJobView(job: { job_id: string; type: string; state: string; progress: number; message: string; started_at?: string | null; finished_at?: string | null; error?: unknown | null }): JobRecordView {
  return {
    job_id: job.job_id,
    type: job.type as JobRecordView["type"],
    state: job.state as JobRecordView["state"],
    progress: job.progress,
    message: job.message ?? "",
    started_at: job.started_at ?? null,
    finished_at: job.finished_at ?? null,
    error: typeof job.error === "string" ? job.error : job.error ? JSON.stringify(job.error) : null,
  };
}
