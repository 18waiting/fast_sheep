// M6 renderer view-model helpers (clean-room, DESIGN_CONFORMANCE).
// The renderer holds ONLY an ephemeral projection of the WorkbenchViewModel
// produced by Main. It never decides business rules (staleness, takeover
// breaker, countdown send eligibility, feedback class, serialization, provider
// route, handoff decision).
import type { WorkbenchViewModel, OrchestratorEventPayload, QueueScope, QueueItemView } from "@fastwork/desktop-ipc";
import type { PlatformViewState } from "./platform-view-state.js";
import { EMPTY_PLATFORM_VIEW_STATE } from "./platform-view-state.js";
import type { M10PanelViewModel } from "../components/m10-panel-types.js";
import { EMPTY_M10_VIEW_MODEL } from "../components/m10-panel-types.js";
import type { LegacyImportPanelViewModel } from "../components/legacy-import-types.js";
import { EMPTY_LEGACY_IMPORT_VIEW_MODEL } from "../components/legacy-import-types.js";

/** UI-local, ephemeral renderer state. */
export interface UiState {
  viewModel: WorkbenchViewModel | null;
  selectedShopId: string | null;
  loading: boolean;
  lastError: string | null;
  /** UI-local command-in-flight guard. Main remains the correctness authority. */
  pendingCommand: "set_mode" | "manual_send" | "no_save_send" | "cancel" | null;
  /** Presentation-only platform projection (M7). */
  platform: PlatformViewState;
  /** Presentation-only M10 panels projection (background jobs + domains). */
  m10?: M10PanelViewModel;
  /** Presentation-only M11 legacy import projection. */
  legacyImport?: LegacyImportPanelViewModel;
  /** SHEEP-060: Queue work-entry surface state. */
  queueScope: QueueScope;
  queueItems: QueueItemView[];
  queueLoading: boolean;
  queueError: string | null;
  /** SHEEP-060: active conversation navigation identity (DP-69: navigation state, not business mutation). */
  activeConversationId: string | null;
}

export const EMPTY_UI_STATE: UiState = {
  viewModel: null,
  selectedShopId: null,
  loading: false,
  lastError: null,
  pendingCommand: null,
  platform: EMPTY_PLATFORM_VIEW_STATE,
  m10: EMPTY_M10_VIEW_MODEL,
  legacyImport: EMPTY_LEGACY_IMPORT_VIEW_MODEL,
  queueScope: { kind: "all_stores" },
  queueItems: [],
  queueLoading: false,
  queueError: null,
  activeConversationId: null,
};

export function revisionOf(vm: WorkbenchViewModel | null): number {
  return vm?.revision ?? 0;
}

/** Pure UI-local shop selection. Does NOT alter canonical business state. */
export function selectShop(state: UiState, shopId: string): UiState {
  if (state.selectedShopId === shopId) return state;
  return { ...state, selectedShopId: shopId, lastError: null };
}

/** SHEEP-060: set Queue Scope (scope change re-queries queue; does NOT touch active conversation, DP-59/5). */
export function setQueueScope(state: UiState, scope: QueueScope): UiState {
  if (state.queueScope.kind === scope.kind && (scope.kind === "all_stores" || state.queueScope.kind === "specific_store" && state.queueScope.storeId === (scope as { storeId: string }).storeId)) return state;
  return { ...state, queueScope: scope, queueLoading: true, queueError: null };
}

/** SHEEP-060: set queue items (from Main typed projection). */
export function setQueueItems(state: UiState, items: QueueItemView[], scope: QueueScope): UiState {
  return { ...state, queueItems: items, queueScope: scope, queueLoading: false, queueError: null };
}

export function setQueueError(state: UiState, message: string): UiState {
  return { ...state, queueLoading: false, queueError: message };
}

/** SHEEP-060: activate conversation (DP-69 navigation state only; no business mutation / no IPC). */
export function setActiveConversation(state: UiState, conversationId: string | null): UiState {
  return { ...state, activeConversationId: conversationId };
}

export function setPendingCommand(state: UiState, command: UiState["pendingCommand"]): UiState {
  return { ...state, pendingCommand: command };
}

export function clearPendingCommand(state: UiState): UiState {
  return { ...state, pendingCommand: null };
}

/**
 * Pure keyboard mapping for suggestion actions (renderer UI convention).
 * Enter => manual send; Alt+Enter => no-save send. Any other key => null.
 * This maps a key event to a UI intent only; Main remains the authority and
 * still validates the request.
 */
export function resolveSuggestionKey(e: { key: string; altKey: boolean }): "manual_send" | "no_save_send" | null {
  if (e.key !== "Enter") return null;
  return e.altKey ? "no_save_send" : "manual_send";
}

/**
 * Pure stale-event predicate (renderer side, non-authoritative).
 * Main's monotonic projection revision is the source of truth.
 */
export function isStaleEvent(state: UiState, event: OrchestratorEventPayload): boolean {
  const current = revisionOf(state.viewModel);
  if (event.revision < current) return true;
  if (event.shop_id && state.selectedShopId && event.shop_id !== state.selectedShopId) return true;
  return false;
}
