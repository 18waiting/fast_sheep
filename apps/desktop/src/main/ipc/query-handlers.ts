// M6/M10 query handlers: bootstrap / shops / snapshot / worker.status / platform.status / jobs.
import { IPC, DesktopError, DESKTOP_ERROR_CODES, type BootstrapState, type DesktopResult, type JobListResult, type JobRecordView, type LegacyImportStatusView, type PlatformStatusView, type WorkbenchViewModel, type WorkerStatusView, type ConversationListRequest, type ConversationListResult, type QueueItemView, type QueuePlatformFilter } from "@fastwork/desktop-ipc";
import type { PlatformSessionCoordinator } from "../platforms/platform-session-coordinator.js";
import type { PlatformId } from "../platforms/platform-host-registry.js";
import type { OrchestratorHost } from "../services/orchestrator-host.js";
import type { ShopService } from "../services/shop-service.js";
import type { WorkerStatusService } from "../services/worker-status-service.js";
import type { WorkbenchProjectionService } from "../services/workbench-projection-service.js";
import type { BackgroundJobService } from "../services/background-job-service.js";
import type { LegacyImportService } from "../services/legacy-import-service.js";
import type { WorkspaceMerchantContext } from "../services/workspace-merchant-context.js";
import type { NormalizedConversationRepository, StoreRepository, PlatformAccountRepository } from "@fastwork/persistence";
import { ok, err } from "./ipc-guard.js";

// SHEEP-061: canonical platform set for queue filter options (mirror of Main PLATFORM_IDS; validated by isPlatformId).
const CANONICAL_PLATFORMS: QueuePlatformFilter[] = ["pdd", "doudian", "jd", "kuaishou", "qianniu", "xianyu"];

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
  /** SHEEP-061: PlatformAccount repository port (canonical platform fact source). */
  platformAccounts: PlatformAccountRepository;
  /** SHEEP-063-PR2 (DP-94/98): Main-owned WorkspaceMerchantContext — the SINGLE merchant
   *  authority source for Main-side merchant containment (Queue/Timeline). It is
   *  independent of Queue Scope / selected shop / active conversation (DP-94/I-17).
   *  null = no trusted merchant authority (offline/test composition without context);
   *  handlers must fail closed (no merchant-contained results). */
  workspaceMerchant: WorkspaceMerchantContext | null;
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
    const platform = req.platform;
    const workspace = deps.workspaceMerchant;
    // DP-94/I-17/DP-98: merchant authority = Main-owned WorkspaceMerchantContext,
    // NOT Queue Scope / selected shop / active conversation. Without a trusted
    // workspace merchant, fail closed (no merchant-contained results, no leak).
    if (!workspace) {
      return ok({ items: [], scope, platform, stores: [], platforms: [] });
    }
    const workspaceMerchantId = workspace.merchantId;
    let rows: Array<{ id: string; storeId: string; platformAccountId: string; merchantId: string }> = [];
    if (scope.kind === "specific_store") {
      const store = deps.stores.findById(scope.storeId);
      if (!store) return err(new DesktopError(DESKTOP_ERROR_CODES.NOT_FOUND, "unknown store"));
      // I-18/DP-98: a store of another merchant is NOT in this workspace -> deny
      // (cross-merchant); renderer never supplies merchant.
      if (!workspace.containsMerchant(store.merchantId)) {
        return err(new DesktopError(DESKTOP_ERROR_CODES.NOT_FOUND, "unknown store"));
      }
      rows = deps.conversations.listByStore(store.id);
    } else {
      // all_stores: merchant boundary = workspace merchant (DP-72/98); All Stores
      // is a merchant-scoped queue query, not a data ownership scope.
      rows = deps.conversations.listByMerchant(workspaceMerchantId);
    }
    // Platform filter: resolve each conversation's platform via platform_accounts (DP-71 canonical fact source);
    // I-8: final query = merchant boundary ∩ Store Scope ∩ Platform Filter.
    let items: QueueItemView[] = rows
      .filter((c) => !platform || deps.platformAccounts.findById(c.platformAccountId)?.platform === platform)
      .map((c) => ({ conversation_id: c.id, store_id: c.storeId }))
      .sort((a, b) => (a.conversation_id < b.conversation_id ? -1 : a.conversation_id > b.conversation_id ? 1 : 0));
    // Fact-backed filter options (DP-77): stores of the merchant + canonical platforms (Main capability set).
    const stores = deps.stores.listByMerchant(workspaceMerchantId).map((s) => ({ store_id: s.id, name: s.name })).sort((a, b) => (a.store_id < b.store_id ? -1 : a.store_id > b.store_id ? 1 : 0));
    const platforms = CANONICAL_PLATFORMS;
    return ok({ items, scope, platform, stores, platforms });
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

