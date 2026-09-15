// M6 app shell (clean-room): composes the workbench from components.
// SHEEP-026: shell topology aligned to the owner-authorized reference IA —
// app-navbar (top region, placeholder for SHEEP-028) + app-body (app-sidebar + app-main).
// Reference is used only for region structure/IA; no reference code, embedded assets,
// geometry values, or bridge/auth/network behavior are ported.
// Integration points stay minimal: plain container boundaries only; no slotting,
// dynamic-mount, or navigation framework/contract is introduced.
import type { UiState } from "../state/view-model.js";
import type { WorkbenchActions } from "./actions.js";
import type { M10PanelActions } from "./m10-panel-types.js";
import { EMPTY_M10_VIEW_MODEL } from "./m10-panel-types.js";
import type { LegacyImportActions } from "./legacy-import-types.js";
import type { QueueActions } from "./conversation-list.js";
import { EMPTY_LEGACY_IMPORT_VIEW_MODEL } from "./legacy-import-types.js";
import { renderLegacyImportPanel } from "./legacy-import-panel.js";
import { renderConversationList } from "./conversation-list.js";
import { renderShopSidebar } from "./shop-sidebar.js";
import { clear, el } from "./dom.js";
import { renderAppNavbar } from "./app-navbar.js";
import { renderWorkbenchHeader } from "./workbench-header.js";
import { renderConversationRegion } from "./conversation-region.js";
import { renderSuggestionPanel } from "./suggestion-panel.js";
import { renderModeToggle } from "./mode-toggle.js";
import { renderCountdownView } from "./countdown-view.js";
import { renderWorkerStatusBadge } from "./worker-status-badge.js";
import { renderEmptyPlatformPanel } from "./empty-platform-panel.js";
import { renderPlatformSurface } from "./platform-surface.js";
import { renderErrorBanner } from "./error-banner.js";
import { renderBackgroundJobsPanel } from "./background-jobs-panel.js";
import { renderLearningPanel } from "./learning-panel.js";
import { renderReviewPanel } from "./review-panel.js";
import { renderAuditPanel } from "./audit-panel.js";
import { renderProductOptimizationPanel } from "./product-optimization-panel.js";

export function renderAppShell(root: HTMLElement, state: UiState, actions: WorkbenchActions, m10Actions?: M10PanelActions, legacyImportActions?: LegacyImportActions, queueActions?: QueueActions): void {
  clear(root);
  const shell = el("div", "app-shell");

  const errorHost = el("div", "error-host");
  renderErrorBanner(errorHost, state);
  shell.appendChild(errorHost);

  // Top navigation region (reference navbar shell region). SHEEP-028 fills the
  // structural sub-regions; content/geometry remain UNKNOWN/NOT_EVIDENCED.
  const navbar = el("nav", "app-navbar");
  renderAppNavbar(navbar);
  shell.appendChild(navbar);


  const body = el("div", "app-body");
  const appSidebarHost = el("div", "app-sidebar");
  renderShopSidebar(appSidebarHost, state, actions);
  body.appendChild(appSidebarHost);

  // SHEEP-060 Queue work-entry surface (Phase 4 incremental topology; provisional
  // left-rail placement; not final Conversation-centered Workspace layout).
  const queueHost = el("div", "queue-host");
  if (queueActions) renderConversationList(queueHost, state, queueActions);
  body.appendChild(queueHost);


  const main = el("main", "app-main");
  const headerHost = el("div", "header-host");
  renderWorkbenchHeader(headerHost, state);
  main.appendChild(headerHost);

  const statusRow = el("div", "status-row");
  renderWorkerStatusBadge(statusRow, state);
  renderModeToggle(statusRow, state, actions);
  main.appendChild(statusRow);

  const countdownHost = el("div", "countdown-host");
  renderCountdownView(countdownHost, state);
  main.appendChild(countdownHost);

  // Stable, non-scrolling PDD platform viewport. The same host exists for both
  // empty and active runtime states; only its child content changes.
  const platformHost = el("div", "platform-host");
  const activePlatformSurface = state.selectedShopId !== null
    && state.platform.activeShopId === state.selectedShopId
    && state.platform.platformType !== null;
  if (activePlatformSurface) {
    renderPlatformSurface(platformHost, state, { onBoundsChange: actions.onPlatformBoundsChange });
  } else {
    renderEmptyPlatformPanel(platformHost);
  }
  main.appendChild(platformHost);

  // Local details scroll independently from the stable native platform viewport.
  const localDetailsScroll = el("div", "local-details-scroll");

  const panels = el("div", "panels");
  const conversationHost = el("div", "conversation-host");
  // SHEEP-063/064: Conversation Main region = panel + Timeline (primary content) +
  // Composer below (reply surface). Each surface renders into its own sub-container
  // so components never clobber one another (REPAIR #2).
  renderConversationRegion(conversationHost, state, actions);
  panels.appendChild(conversationHost);
  const suggestionHost = el("div", "suggestion-host");
  renderSuggestionPanel(suggestionHost, state, actions);
  panels.appendChild(suggestionHost);
  localDetailsScroll.appendChild(panels);

  // M10 panels: projection/control only (no-op when actions are not wired).
  const m10 = state.m10 ?? EMPTY_M10_VIEW_MODEL;
  const m10a: M10PanelActions = m10Actions ?? noopM10Actions();
  const m10Row = el("div", "m10-row");
  const jobsHost = el("div", "m10-jobs-host");
  renderBackgroundJobsPanel(jobsHost, m10, m10a);
  m10Row.appendChild(jobsHost);
  const learningHost = el("div", "m10-learning-host");
  renderLearningPanel(learningHost, m10, m10a);
  m10Row.appendChild(learningHost);
  const reviewHost = el("div", "m10-review-host");
  renderReviewPanel(reviewHost, m10, m10a);
  m10Row.appendChild(reviewHost);
  const auditHost = el("div", "m10-audit-host");
  renderAuditPanel(auditHost, m10, m10a);
  m10Row.appendChild(auditHost);
  const optHost = el("div", "m10-opt-host");
  renderProductOptimizationPanel(optHost, m10, m10a);
  m10Row.appendChild(optHost);
  localDetailsScroll.appendChild(m10Row);

  // M11 legacy import panel (projection/control only).
  const liHost = el("div", "m11-legacy-import-host");
  renderLegacyImportPanel(liHost, state.legacyImport ?? EMPTY_LEGACY_IMPORT_VIEW_MODEL, legacyImportActions ?? noopLegacyImportActions());
  localDetailsScroll.appendChild(liHost);
  main.appendChild(localDetailsScroll);

  body.appendChild(main);
  shell.appendChild(body);
  root.appendChild(shell);
}

function noopLegacyImportActions(): LegacyImportActions {
  return {
    onSelect: () => {}, onScan: () => {}, onPlan: () => {}, onDryRun: () => {},
    onApply: () => {}, onCancel: () => {}, onRefreshStatus: () => {},
  };
}

function noopM10Actions(): M10PanelActions {
  return {
    onRefreshJobs: () => {},
    onStartLearning: () => {},
    onReviewPropose: () => {},
    onReviewApply: () => {},
    onReviewRestore: () => {},
    onAudit: () => {},
    onOptimizationPropose: () => {},
    onOptimizationApply: () => {},
    onCancelJob: () => {},
  };
}



