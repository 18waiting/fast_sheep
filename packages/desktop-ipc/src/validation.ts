// IPC schema validation via @fastwork/contracts (M6). No duplicated schema definitions.
import { validatorFor } from "@fastwork/contracts";

const cache = new Map<string, ReturnType<typeof validatorFor>>();
function v(id: string): ReturnType<typeof validatorFor> {
  let fn = cache.get(id);
  if (!fn) { fn = validatorFor(id); cache.set(id, fn); }
  return fn;
}

export interface ValidationResult { ok: boolean; errors: string[] }

function check(id: string, instance: unknown): ValidationResult {
  const fn = v(id);
  const ok = fn(instance);
  return ok ? { ok: true, errors: [] } : { ok: false, errors: (fn.errors ?? []).map((e) => e.message ?? String(e)) };
}

export function validateSetModeRequest(req: unknown): ValidationResult { return check("fastwork:desktop:set-mode-request", req); }
export function validateShopListResult(res: unknown): ValidationResult { return check("fastwork:desktop:shop-list-result", res); }
export function validateShopsChangedEvent(ev: unknown): ValidationResult { return check("fastwork:desktop:shops-changed-event", ev); }
export function validatePlatformStatusView(view: unknown): ValidationResult { return check("fastwork:desktop:platform-status-view", view); }
export function validatePlatformActivateShopRequest(req: unknown): ValidationResult { return check("fastwork:desktop:platform-activate-shop-request", req); }
export function validatePlatformSetViewBoundsRequest(req: unknown): ValidationResult { return check("fastwork:desktop:platform-set-view-bounds-request", req); }
export function validatePlatformReloadRequest(req: unknown): ValidationResult { return check("fastwork:desktop:platform-reload-request", req); }
export function validatePlatformStatusChangedEvent(ev: unknown): ValidationResult { return check("fastwork:desktop:platform-status-changed-event", ev); }
export function validateManualSendRequest(req: unknown): ValidationResult { return check("fastwork:desktop:manual-send-request", req); }
export function validateNoSaveSendRequest(req: unknown): ValidationResult { return check("fastwork:desktop:no-save-send-request", req); }
export function validateCancelRequest(req: unknown): ValidationResult { return check("fastwork:desktop:cancel-request", req); }
export function validateFocusRequest(req: unknown): ValidationResult { return check("fastwork:desktop:focus-request", req); }
export function validateBootstrapState(state: unknown): ValidationResult { return check("fastwork:desktop:bootstrap-state", state); }
export function validateWorkerStatus(status: unknown): ValidationResult { return check("fastwork:desktop:worker-status", status); }
export function validateWorkbenchViewModel(vm: unknown): ValidationResult { return check("fastwork:desktop:workbench-view-model", vm); }
export function validateActionResult(result: unknown): ValidationResult { return check("fastwork:desktop:action-result", result); }
export function validateOrchestratorEvent(ev: unknown): ValidationResult { return check("fastwork:desktop:orchestrator-event", ev); }

// ---- M10 helpers ----
export function validateJobListResult(res: unknown): ValidationResult { return check("fastwork:desktop:job-list-result", res); }
export function validateJobGetRequest(req: unknown): ValidationResult { return check("fastwork:desktop:job-get-request", req); }
export function validateJobCancelRequest(req: unknown): ValidationResult { return check("fastwork:desktop:job-cancel-request", req); }
export function validateLearningStartRequest(req: unknown): ValidationResult { return check("fastwork:desktop:learning-start-request", req); }
export function validateReviewActionRequest(req: unknown): ValidationResult { return check("fastwork:desktop:review-action-request", req); }
export function validateAuditActionRequest(req: unknown): ValidationResult { return check("fastwork:desktop:audit-action-request", req); }
export function validateOptimizationActionRequest(req: unknown): ValidationResult { return check("fastwork:desktop:optimization-action-request", req); }
export function validateBackgroundJobEvent(ev: unknown): ValidationResult { return check("fastwork:desktop:background-job-event", ev); }
export function validateBackgroundJobStatus(status: unknown): ValidationResult { return check("fastwork:jobs:background-job-status", status); }
export function validateLearningRunRequest(req: unknown): ValidationResult { return check("fastwork:learning:learning-run-request", req); }
export function validateLearningRunResult(res: unknown): ValidationResult { return check("fastwork:learning:learning-run-result", res); }
export function validateLearningCandidate(c: unknown): ValidationResult { return check("fastwork:learning:learning-candidate", c); }
export function validateCandidateStatus(s: unknown): ValidationResult { return check("fastwork:learning:candidate-status", s); }
export function validateReviewProposalRequest(req: unknown): ValidationResult { return check("fastwork:review:review-proposal-request", req); }
export function validateReviewProposalResult(res: unknown): ValidationResult { return check("fastwork:review:review-proposal-result", res); }
export function validateReviewApplyRequest(req: unknown): ValidationResult { return check("fastwork:review:review-apply-request", req); }
export function validateReviewApplyResult(res: unknown): ValidationResult { return check("fastwork:review:review-apply-result", res); }
export function validateReviewRestoreRequest(req: unknown): ValidationResult { return check("fastwork:review:review-restore-request", req); }
export function validateReviewRestoreResult(res: unknown): ValidationResult { return check("fastwork:review:review-restore-result", res); }
export function validateAuditDecisionRequest(req: unknown): ValidationResult { return check("fastwork:audit:audit-decision-request", req); }
export function validateAuditDecisionResult(res: unknown): ValidationResult { return check("fastwork:audit:audit-decision-result", res); }
export function validateProductOptimizationRequest(req: unknown): ValidationResult { return check("fastwork:optimization:product-optimization-request", req); }
export function validateProductOptimizationProposal(p: unknown): ValidationResult { return check("fastwork:optimization:product-optimization-proposal", p); }
export function validateProductOptimizationApplyRequest(req: unknown): ValidationResult { return check("fastwork:optimization:product-optimization-apply-request", req); }
export function validateProductOptimizationResult(res: unknown): ValidationResult { return check("fastwork:optimization:product-optimization-result", res); }
export function validateLegacyImportSelectRequest(req: unknown): ValidationResult { return check("fastwork:desktop:legacy-import-select-request", req); }
export function validateLegacyImportSelectResult(res: unknown): ValidationResult { return check("fastwork:desktop:legacy-import-select-result", res); }
export function validateLegacyImportPlanRequest(req: unknown): ValidationResult { return check("fastwork:desktop:legacy-import-plan-request", req); }
export function validateLegacyImportApplyAction(req: unknown): ValidationResult { return check("fastwork:desktop:legacy-import-apply-action", req); }
export function validateLegacyImportEvent(ev: unknown): ValidationResult { return check("fastwork:desktop:legacy-import-event", ev); }
export function validateLegacySourceSelection(sel: unknown): ValidationResult { return check("fastwork:import:legacy-source-selection", sel); }
export function validateLegacyImportPlan(plan: unknown): ValidationResult { return check("fastwork:import:legacy-import-plan", plan); }
export function validateKnowledgeImportRequest(req: unknown): ValidationResult { return check("fastwork:import:knowledge-import-request", req); }
