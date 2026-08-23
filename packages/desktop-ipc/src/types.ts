// Request/response/event type mappings for the M6 typed IPC (clean-room).
import type { IPC } from "./channels.js";

export interface DesktopQueryResult<T> { ok: true; data: T }
export interface DesktopErrorResult { ok: false; error: { code: string; category: string; message: string; retryable: boolean } }
export type DesktopResult<T> = DesktopQueryResult<T> | DesktopErrorResult;

export interface SetModeRequest { shop_id: string; conversation_id?: string; mode: "human_review" | "full_auto" }
export interface ManualSendRequest { shop_id: string; conversation_id: string }
export interface NoSaveSendRequest { shop_id: string; conversation_id: string }
export interface CancelRequest { shop_id: string; conversation_id: string }
export interface FocusRequest { shop_id: string }

export interface WorkerStatusView { status: "starting" | "ready" | "restarting" | "stopped" | "error"; worker_version?: string; protocol_version?: number; last_error?: string }
export interface ShopSummary { shop_id: string; name: string; type: string; enabled: boolean }
export interface SuggestionView { reply: string; generation: number; status: string; mode?: string }
export interface ConversationView { conversation_id: string; shop_id: string; state: string; buyer?: string }
export interface WorkbenchViewModel {
  revision: number;
  shop_summaries: ShopSummary[];
  selected_shop_id?: string;
  conversation?: ConversationView;
  suggestion?: SuggestionView;
  mode?: "human_review" | "full_auto";
  countdown?: { enabled: boolean; remaining_ticks: number; tick_ms: number };
  send_status?: string;
  takeover_status?: string;
  worker_status: WorkerStatusView;
  last_error?: string;
  platform_capability: "none" | "pdd";
}
export interface BootstrapState { revision: number; worker_status: WorkerStatusView; shops: ShopSummary[]; view_model: WorkbenchViewModel }

export interface OrchestratorEventPayload { event: string; revision: number; shop_id?: string; conversation_id?: string; payload?: Record<string, unknown> }

export type PlatformSessionStatus = "STOPPED" | "CREATING" | "LOADING" | "LOGIN_REQUIRED" | "READY" | "DOM_UNSUPPORTED" | "ERROR" | "DISPOSED";

export interface PlatformStatusView {
  shop_id: string;
  platform: string;
  session_status: PlatformSessionStatus;
  view_visible: boolean;
  last_error?: string;
  capabilities?: Record<string, unknown>;
}

export interface PlatformActivateShopRequest { shop_id: string }
export interface PlatformSetViewBoundsRequest { shop_id: string; x: number; y: number; width: number; height: number; visible: boolean }
export interface PlatformReloadRequest { shop_id: string }

export interface PlatformStatusChangedEvent { shop_id: string; session_status: PlatformSessionStatus; revision: number; last_error?: string }

// ---------------------------------------------------------------------------
// M10 background jobs / learning / review / audit / optimization typed IPC
// ---------------------------------------------------------------------------
export type JobState = "QUEUED" | "RUNNING" | "CANCELLING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type JobType = "learning" | "review" | "audit" | "optimization" | "index_rebuild";

export interface JobRecordView {
  job_id: string;
  type: JobType;
  state: JobState;
  progress: number;
  message: string;
  started_at?: string | null;
  finished_at?: string | null;
  error?: string | null;
}

export interface JobListResult { jobs: JobRecordView[] }
export interface JobGetRequest { job_id: string }
export interface JobCancelRequest { job_id: string }
export interface BackgroundJobEvent { event: string; payload?: Record<string, unknown> }

export interface LearningStartRequest { import_source?: string; config?: Record<string, unknown> }
export interface ReviewActionRequest { action: "propose" | "apply" | "restore"; request?: Record<string, unknown> }
export interface AuditActionRequest { action: "保留" | "丢弃" | "待定"; entry?: Record<string, unknown> }
export interface OptimizationActionRequest { action: "propose" | "apply"; request?: Record<string, unknown> }

export interface LearningChangedEvent { event: string; payload?: Record<string, unknown> }
export interface ReviewChangedEvent { event: string; payload?: Record<string, unknown> }
export interface AuditChangedEvent { event: string; payload?: Record<string, unknown> }
export interface OptimizationChangedEvent { event: string; payload?: Record<string, unknown> }

// ---- M11 legacy import ----
export interface LegacyImportSelectRequest { paths?: string[] }
export interface LegacyImportSelectResult { selection_token: string; item_count: number }
export interface LegacyImportPlanRequest { selection_token: string; options?: Record<string, unknown> }
export interface LegacyImportApplyAction { selection_token: string; plan_sha256?: string; session_id?: string; legacy_timezone?: string; import_provider_secret?: boolean }
export interface LegacyImportStatusView { session_id: string; state: string; phases: string[]; backup_id?: string | null; error?: string | null }
export interface LegacyImportEvent { event: string; payload?: Record<string, unknown> }

export type RequestByChannel = {
  [IPC.bootstrap]: undefined;
  [IPC.listShops]: undefined;
  [IPC.snapshot]: { shop_id?: string };
  [IPC.workerStatus]: undefined;
  [IPC.setMode]: SetModeRequest;
  [IPC.manualSend]: ManualSendRequest;
  [IPC.noSaveSend]: NoSaveSendRequest;
  [IPC.cancel]: CancelRequest;
  [IPC.focus]: FocusRequest;
  [IPC.platformStatus]: { shop_id: string };
  [IPC.platformActivateShop]: PlatformActivateShopRequest;
  [IPC.platformSetViewBounds]: PlatformSetViewBoundsRequest;
  [IPC.platformReload]: PlatformReloadRequest;
  [IPC.jobsList]: undefined;
  [IPC.jobsGet]: JobGetRequest;
  [IPC.jobsCancel]: JobCancelRequest;
  [IPC.learningStart]: LearningStartRequest;
  [IPC.reviewPropose]: ReviewActionRequest;
  [IPC.reviewApply]: ReviewActionRequest;
  [IPC.reviewRestore]: ReviewActionRequest;
  [IPC.auditDecide]: AuditActionRequest;
  [IPC.optimizationPropose]: OptimizationActionRequest;
  [IPC.optimizationApply]: OptimizationActionRequest;
  [IPC.legacyImportSelect]: LegacyImportSelectRequest;
  [IPC.legacyImportScan]: LegacyImportPlanRequest;
  [IPC.legacyImportPlan]: LegacyImportPlanRequest;
  [IPC.legacyImportDryRun]: LegacyImportPlanRequest;
  [IPC.legacyImportApply]: LegacyImportApplyAction;
  [IPC.legacyImportStatus]: { session_id: string };
  [IPC.legacyImportCancel]: { session_id: string };
};
