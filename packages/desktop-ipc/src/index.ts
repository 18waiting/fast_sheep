export { IPC, QUERY_CHANNELS, COMMAND_CHANNELS, EVENT_CHANNELS, ALL_CHANNELS, isAllowedChannel, type IpcChannel } from "./channels.js";
export { DESKTOP_ERROR_CODES, DesktopError, desktopError, type DesktopErrorCode, type DesktopErrorShape } from "./errors.js";
export {
  validateSetModeRequest, validateManualSendRequest, validateNoSaveSendRequest, validateCancelRequest, validateFocusRequest,
  validateBootstrapState, validateWorkerStatus, validateWorkbenchViewModel, validateActionResult, validateOrchestratorEvent,
  validateShopListResult, validateShopsChangedEvent, validatePlatformStatusView, validatePlatformActivateShopRequest,
  validatePlatformSetViewBoundsRequest, validatePlatformReloadRequest, validatePlatformStatusChangedEvent,
  validateJobListResult, validateJobGetRequest, validateJobCancelRequest, validateLearningStartRequest,
  validateReviewActionRequest, validateAuditActionRequest, validateOptimizationActionRequest, validateBackgroundJobEvent,
  validateBackgroundJobStatus, validateLearningRunRequest, validateLearningRunResult, validateLearningCandidate,
  validateCandidateStatus, validateReviewProposalRequest, validateReviewProposalResult, validateReviewApplyRequest,
  validateReviewApplyResult, validateReviewRestoreRequest, validateReviewRestoreResult, validateAuditDecisionRequest,
  validateAuditDecisionResult, validateProductOptimizationRequest, validateProductOptimizationProposal,
  validateProductOptimizationApplyRequest, validateProductOptimizationResult,
  validateLegacyImportSelectRequest, validateLegacyImportSelectResult,
  validateLegacyImportPlanRequest, validateLegacyImportApplyAction,
  validateLegacyImportEvent, validateLegacySourceSelection, validateLegacyImportPlan,
  validateKnowledgeImportRequest,
} from "./validation.js";
export type { FastWorkDesktopAPI, Unsubscribe } from "./preload-api.js";
export type {
  DesktopResult, WorkbenchViewModel, WorkerStatusView, ShopSummary, SuggestionView, ConversationView, BootstrapState,
  OrchestratorEventPayload, SetModeRequest, ManualSendRequest, NoSaveSendRequest, CancelRequest, FocusRequest,
  PlatformSessionStatus, PlatformStatusView, PlatformActivateShopRequest, PlatformSetViewBoundsRequest,
  PlatformReloadRequest, PlatformStatusChangedEvent,
  JobState, JobType, JobRecordView, JobListResult, JobGetRequest, JobCancelRequest, BackgroundJobEvent,
  LearningStartRequest, ReviewActionRequest, AuditActionRequest, OptimizationActionRequest,
  LearningChangedEvent, ReviewChangedEvent, AuditChangedEvent, OptimizationChangedEvent,
  LegacyImportSelectRequest, LegacyImportSelectResult, LegacyImportPlanRequest,
  LegacyImportApplyAction, LegacyImportStatusView, LegacyImportEvent,
} from "./types.js";
