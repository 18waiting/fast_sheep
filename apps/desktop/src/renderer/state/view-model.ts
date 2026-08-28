// M6 renderer view-model helpers (clean-room, DESIGN_CONFORMANCE).
// The renderer holds ONLY an ephemeral projection of the WorkbenchViewModel
// produced by Main. It never decides business rules (staleness, takeover
// breaker, countdown send eligibility, feedback class, serialization, provider
// route, handoff decision).
import type { WorkbenchViewModel, OrchestratorEventPayload, QueueScope, QueueItemView, QueuePlatformFilter, QueueStoreOption, TimelineMessageView } from "@fastwork/desktop-ipc";
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
  queuePlatform?: QueuePlatformFilter;
  availableStores: QueueStoreOption[];
  availablePlatforms: QueuePlatformFilter[];
  /** DP-76: active conversation may remain outside current queue scope; calm neutral cue. */
  queueOutOfScopeCue: boolean;
  /** SHEEP-060: active conversation navigation identity (DP-69: navigation state, not business mutation). */
  activeConversationId: string | null;
  /** SHEEP-063: Message Timeline state — bound to the active conversation only (DP-85).
   *  timelineConversationId is the conversation whose facts are displayed; when it
   *  differs from activeConversationId the UI must not show old facts (I-7/I-14). */
  timelineConversationId: string | null;
  timelineMessages: TimelineMessageView[];
  timelineLoading: boolean;
  timelineError: string | null;
  /** SHEEP-064: ephemeral composer drafts keyed by conversationId (DP-108/109).
   *  In-memory only; persist to SHEEP-075. Survive conversation switches within the
   *  Main context lifetime (DP-109). */
  composerDrafts: Record<string, string>;
  /** SHEEP-064: whether a production Send pipeline is wired (false until SHEEP-066);
   *  Send control must honestly express unavailable and never fake success. */
  composerSendAvailable: boolean;
  /** SHEEP-064: transient composer cue (e.g. non-destructive apply blocked / send unavailable). */
  composerNote: string | null;
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
  queuePlatform: undefined,
  availableStores: [],
  availablePlatforms: [],
  queueOutOfScopeCue: false,
  activeConversationId: null,
  timelineConversationId: null,
  timelineMessages: [],
  timelineLoading: false,
  timelineError: null,
  composerDrafts: {},
  composerSendAvailable: false,
  composerNote: null,
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

export function setQueuePlatform(state: UiState, platform: QueuePlatformFilter | undefined): UiState {
  if (state.queuePlatform === platform) return state;
  return { ...state, queuePlatform: platform, queueLoading: true, queueError: null };
}

export function setQueueOptions(state: UiState, stores: QueueStoreOption[], platforms: QueuePlatformFilter[]): UiState {
  return { ...state, availableStores: stores, availablePlatforms: platforms };
}

export function setQueueError(state: UiState, message: string): UiState {
  return { ...state, queueLoading: false, queueError: message };
}

/** SHEEP-060: activate conversation (DP-69 navigation state only; no business mutation / no IPC). */
export function setActiveConversation(state: UiState, conversationId: string | null): UiState {
  return { ...state, activeConversationId: conversationId };
}

/** SHEEP-063: set timeline loading for a conversation (DP-45/89: same-conversation
 *  refresh keeps last-known useful content; switching identity clears first). */
export function setTimelineLoading(state: UiState, conversationId: string): UiState {
  const keep = state.timelineConversationId === conversationId ? state.timelineMessages : [];
  return { ...state, timelineConversationId: conversationId, timelineMessages: keep, timelineLoading: true, timelineError: null };
}

/** SHEEP-063: set timeline items for the bound conversation (authorized 0 rows -> no-work empty). */
export function setTimelineItems(state: UiState, conversationId: string, messages: TimelineMessageView[]): UiState {
  return { ...state, timelineConversationId: conversationId, timelineMessages: messages, timelineLoading: false, timelineError: null };
}

/** SHEEP-063: set timeline error (I-25/DP-47: failure contained to Timeline scope). */
export function setTimelineError(state: UiState, conversationId: string, message: string): UiState {
  return { ...state, timelineConversationId: conversationId, timelineLoading: false, timelineError: message };
}

/** SHEEP-063: clear timeline (active identity switch must not keep old conversation facts, DP-89/I-7). */
export function clearTimeline(state: UiState): UiState {
  return { ...state, timelineConversationId: null, timelineMessages: [], timelineLoading: false, timelineError: null };
}

// ---- SHEEP-063 REPAIR (I-7 concretization / I-26): Active Conversation presentation ----

/** Authoritative active-conversation presentation facts (I-7/I-26). Only
 *  conversation-bound trusted facts: the active conversation identity (navigation
 *  anchor, DP-69), store_id from the ACTIVE queue item (Main-projected conversation
 *  fact), and viewModel.conversation facts ONLY when they match the active identity.
 *  Never falls back to selectedShop / Queue Scope / other ambient state. */
export interface ActiveConversationPresentation {
  conversationId: string;
  storeId: string | null;
  state: string | null;
  buyer: string | null;
}

/** I-26 WORKSPACE_ACTIVE_CONVERSATION_PRESENTATION_MUST_NOT_FALL_BACK_TO_AMBIENT_SCOPE_FACTS:
 *  returns the active-conversation presentation, or null when there is NO active
 *  conversation (activeConversationId == null). A non-null result always reflects
 *  the active conversation identity — never a queue/selected-shop ambient fact. */
export function activeConversationPresentation(state: UiState): ActiveConversationPresentation | null {
  if (state.activeConversationId === null) return null;
  const item = state.queueItems.find((i) => i.conversation_id === state.activeConversationId);
  const conv = state.viewModel?.conversation;
  const trustedConv = conv && conv.conversation_id === state.activeConversationId ? conv : null;
  return {
    conversationId: state.activeConversationId,
    storeId: item?.store_id ?? null,
    state: trustedConv?.state ?? null,
    buyer: trustedConv?.buyer ?? null,
  };
}

// ---- SHEEP-064 Composer: ephemeral drafts + submit-intent contract ----

/** DP-108/DP-109: set the ephemeral draft for a conversation (keyed by
 *  conversationId, not Queue row / Store Scope). In-memory only (SHEEP-075). */
export function setComposerDraft(state: UiState, conversationId: string, text: string): UiState {
  return { ...state, composerDrafts: { ...state.composerDrafts, [conversationId]: text }, composerNote: null };
}

/** DP-106: AI suggestion application is EXPLICIT and NON-DESTRUCTIVE. A suggestion
 *  is never applied asynchronously; an explicit apply fills the draft ONLY when the
 *  current draft is empty or identical. A non-empty differing draft is preserved and
 *  a calm note is set (never silently replaced). */
export function applySuggestionToComposer(state: UiState, conversationId: string, suggestion: string): UiState {
  const current = state.composerDrafts[conversationId] ?? "";
  if (current === "" || current === suggestion) {
    return { ...state, composerDrafts: { ...state.composerDrafts, [conversationId]: suggestion }, composerNote: null };
  }
  return { ...state, composerNote: "草稿非空，未覆盖 AI 建议" };
}

/** #11: production Send capability availability (wired by SHEEP-066). */
export function setComposerSendAvailable(state: UiState, available: boolean): UiState {
  return { ...state, composerSendAvailable: available };
}

// ---- DP-107 / I-27 / DP-110 / I-28: submit-intent contract (SHEEP-066 consumes) ----

/** A composer submit intent: conversation identity + draft captured ATOMICALLY at
 *  intent time (DP-110). Later active-conversation switches never change the target. */
export interface ComposerSubmitIntent {
  conversationId: string;
  draft: string;
}

/** Atomic capture of conversationId + draft at intent time (DP-110). 064 only
 *  defines/captures the intent; it never persists it as a delivered message fact
 *  (I-27) and never executes delivery (DP-107) — SHEEP-066 owns execution. */
export function captureComposerSubmitIntent(conversationId: string, draft: string): ComposerSubmitIntent {
  return { conversationId, draft };
}

/** I-28: a send result may mutate ONLY the draft for ITS captured conversation.
 *  "sent" clears that conversation's draft; "failed" preserves it (never clears);
 *  a c1 result never clears c2's draft. This is the SHEEP-066 hard constraint. */
export function applyComposerSendResult(state: UiState, intent: ComposerSubmitIntent, outcome: "sent" | "failed"): UiState {
  if (outcome === "failed") return state;
  const drafts = { ...state.composerDrafts };
  delete drafts[intent.conversationId];
  return { ...state, composerDrafts: drafts, composerNote: null };
}

/** I-29: Enter-to-submit only when NOT in IME composition and Shift is not held.
 *  IME composition must never trigger submit; Shift+Enter inserts a newline. */
export function shouldSubmitComposerOnEnter(e: { isComposing: boolean; shiftKey: boolean }): boolean {
  return !e.isComposing && !e.shiftKey;
}

export function setPendingCommand(state: UiState, command: UiState["pendingCommand"]): UiState {
  return { ...state, pendingCommand: command };
}

export function clearPendingCommand(state: UiState): UiState {
  return { ...state, pendingCommand: null };
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
