// M6/M10 command handlers: orchestrator.set_mode / manual_send / no_save_send / cancel / focus,
// platform.activate_shop / set_view_bounds / reload, jobs.cancel, learning.start,
// review.propose / apply / restore, audit.decide, optimization.propose / apply.
import { IPC, type AuditActionRequest, type DesktopResult, type LearningStartRequest, type OptimizationActionRequest, type ReviewActionRequest } from "@fastwork/desktop-ipc";
import type { PlatformSessionCoordinator } from "../platforms/platform-session-coordinator.js";
import type { PlatformId } from "../platforms/platform-host-registry.js";
import type { OrchestratorHost } from "../services/orchestrator-host.js";
import type { BackgroundJobService } from "../services/background-job-service.js";
import type { LearningService } from "../services/learning-service.js";
import type { ReviewService } from "../services/review-service.js";
import type { AuditService } from "../services/audit-service.js";
import type { DesktopProductOptimizationService } from "../services/product-optimization-service.js";
import type { LegacyImportService } from "../services/legacy-import-service.js";
import type { LegacyImportSelectRequest, LegacyImportPlanRequest, LegacyImportApplyAction } from "@fastwork/desktop-ipc";
import { ok, err } from "./ipc-guard.js";
import { DesktopError, DESKTOP_ERROR_CODES } from "@fastwork/desktop-ipc";

export interface CommandDeps {
  orchestrator: OrchestratorHost;
  coordinator: PlatformSessionCoordinator;
  platformForShop(shopId: string): string | null;
  contentBounds?: () => { x: number; y: number; width: number; height: number; visible: boolean };
  jobs: BackgroundJobService;
  learning: LearningService;
  review: ReviewService;
  audit: AuditService;
  optimization: DesktopProductOptimizationService;
  legacyImport: LegacyImportService;
}

export const COMMAND_HANDLERS = {
  [IPC.setMode]: (deps: CommandDeps) => async (req: { shop_id: string; conversation_id?: string; mode: "human_review" | "full_auto" }): Promise<DesktopResult<{ ok: boolean }>> => {
    await deps.orchestrator.setMode(req.shop_id, req.conversation_id ?? req.shop_id, req.mode);
    return ok({ ok: true });
  },
  [IPC.manualSend]: (deps: CommandDeps) => async (req: { shop_id: string; conversation_id: string }): Promise<DesktopResult<{ ok: boolean }>> => {
    await deps.orchestrator.manualSend(req.shop_id, req.conversation_id);
    return ok({ ok: true });
  },
  [IPC.noSaveSend]: (deps: CommandDeps) => async (req: { shop_id: string; conversation_id: string }): Promise<DesktopResult<{ ok: boolean }>> => {
    await deps.orchestrator.noSaveSend(req.shop_id, req.conversation_id);
    return ok({ ok: true });
  },
  [IPC.cancel]: (deps: CommandDeps) => async (req: { shop_id: string; conversation_id: string }): Promise<DesktopResult<{ ok: boolean }>> => {
    await deps.orchestrator.cancel(req.shop_id, req.conversation_id);
    return ok({ ok: true });
  },
  [IPC.focus]: (deps: CommandDeps) => async (req: { shop_id: string }): Promise<DesktopResult<{ ok: boolean }>> => {
    deps.orchestrator.focus(req.shop_id);
    return ok({ ok: true });
  },
  [IPC.platformActivateShop]: (deps: CommandDeps) => async (req: { shop_id: string }): Promise<DesktopResult<{ ok: boolean }>> => {
    const platform = deps.platformForShop(req.shop_id) as PlatformId | null;
    if (!platform) return ok({ ok: false });
    await deps.coordinator.activateShop(platform, req.shop_id);
    return ok({ ok: true });
  },
  [IPC.platformSetViewBounds]: (deps: CommandDeps) => async (req: { shop_id: string; x: number; y: number; width: number; height: number; visible: boolean }): Promise<DesktopResult<{ ok: boolean }>> => {
    const platform = deps.platformForShop(req.shop_id) as PlatformId | null;
    if (!platform) return ok({ ok: false });
    const contentBounds = deps.contentBounds?.() ?? { x: 0, y: 0, width: 1200, height: 800, visible: true };
    deps.coordinator.setViewBounds(platform, req.shop_id, { x: req.x, y: req.y, width: req.width, height: req.height, visible: req.visible }, contentBounds);
    return ok({ ok: true });
  },
  [IPC.platformReload]: (deps: CommandDeps) => async (req: { shop_id: string }): Promise<DesktopResult<{ ok: boolean }>> => {
    const platform = deps.platformForShop(req.shop_id) as PlatformId | null;
    if (!platform) return ok({ ok: false });
    await deps.coordinator.reload(platform, req.shop_id);
    return ok({ ok: true });
  },
  [IPC.jobsCancel]: (deps: CommandDeps) => async (req: { job_id: string }): Promise<DesktopResult<{ ok: boolean }>> => {
    deps.jobs.cancel(req.job_id);
    return ok({ ok: true });
  },
  [IPC.learningStart]: (deps: CommandDeps) => async (req: LearningStartRequest): Promise<DesktopResult<{ job_id: string; ok: boolean }>> => {
    const r = deps.learning.start(req);
    return ok({ job_id: r.job_id, ok: true });
  },
  [IPC.reviewPropose]: (deps: CommandDeps) => async (req: ReviewActionRequest): Promise<DesktopResult<{ job_id: string; ok: boolean }>> => {
    const r = deps.review.action({ action: "propose", request: req.request ?? {} });
    return ok({ job_id: r.job_id, ok: true });
  },
  [IPC.reviewApply]: (deps: CommandDeps) => async (req: ReviewActionRequest): Promise<DesktopResult<{ job_id: string; ok: boolean }>> => {
    const r = deps.review.action({ action: "apply", request: req.request ?? {} });
    return ok({ job_id: r.job_id, ok: true });
  },
  [IPC.reviewRestore]: (deps: CommandDeps) => async (req: ReviewActionRequest): Promise<DesktopResult<{ job_id: string; ok: boolean }>> => {
    const r = deps.review.action({ action: "restore", request: req.request ?? {} });
    return ok({ job_id: r.job_id, ok: true });
  },
  [IPC.auditDecide]: (deps: CommandDeps) => async (req: AuditActionRequest): Promise<DesktopResult<{ job_id: string; ok: boolean }>> => {
    const r = deps.audit.decide(req);
    return ok({ job_id: r.job_id, ok: true });
  },
  [IPC.optimizationPropose]: (deps: CommandDeps) => async (req: OptimizationActionRequest): Promise<DesktopResult<{ job_id: string; ok: boolean }>> => {
    const r = deps.optimization.action({ action: "propose", request: req.request ?? {} });
    return ok({ job_id: r.job_id, ok: true });
  },
  [IPC.optimizationApply]: (deps: CommandDeps) => async (req: OptimizationActionRequest): Promise<DesktopResult<{ job_id: string; ok: boolean }>> => {
    const r = deps.optimization.action({ action: "apply", request: req.request ?? {} });
    return ok({ job_id: r.job_id, ok: true });
  },
  [IPC.legacyImportSelect]: (deps: CommandDeps) => async (_req: LegacyImportSelectRequest): Promise<DesktopResult<{ selection_token: string; item_count: number }>> => {
    const r = await deps.legacyImport.select();
    return ok(r);
  },
  [IPC.legacyImportScan]: (deps: CommandDeps) => async (req: LegacyImportPlanRequest): Promise<DesktopResult<{ item_count: number }>> => {
    try {
      const r = await deps.legacyImport.scan(req.selection_token ?? "");
      return ok(r);
    } catch (e) {
      return err(new DesktopError(DESKTOP_ERROR_CODES.INVALID_REQUEST, e instanceof Error ? e.message : "scan failed"));
    }
  },
  [IPC.legacyImportPlan]: (deps: CommandDeps) => async (req: LegacyImportPlanRequest): Promise<DesktopResult<{ plan_sha256: string }>> => {
    try {
      const { plan } = await deps.legacyImport.dryRun(req.selection_token, (req.options ?? {}) as never);
      return ok({ plan_sha256: plan.plan_sha256 });
    } catch (e) {
      return err(new DesktopError(DESKTOP_ERROR_CODES.INVALID_REQUEST, e instanceof Error ? e.message : "plan failed"));
    }
  },
  [IPC.legacyImportDryRun]: (deps: CommandDeps) => async (req: LegacyImportPlanRequest): Promise<DesktopResult<{ plan: unknown }>> => {
    try {
      const { plan } = await deps.legacyImport.dryRun(req.selection_token, (req.options ?? {}) as never);
      return ok({ plan });
    } catch (e) {
      return err(new DesktopError(DESKTOP_ERROR_CODES.INVALID_REQUEST, e instanceof Error ? e.message : "dry-run failed"));
    }
  },
  [IPC.legacyImportApply]: (deps: CommandDeps) => async (req: LegacyImportApplyAction): Promise<DesktopResult<{ session_id: string; state: string }>> => {
    try {
      const options = {
        conflict_policy: undefined,
        legacy_timezone: req.legacy_timezone,
        import_provider_secret: req.import_provider_secret,
        rebuild_rag: true,
      };
      const r = await deps.legacyImport.apply(req.selection_token, req.plan_sha256 ?? "", req.session_id, options);
      return ok({ session_id: r.session.session_id, state: r.state });
    } catch (e) {
      return err(new DesktopError(DESKTOP_ERROR_CODES.INVALID_REQUEST, e instanceof Error ? e.message : "apply failed"));
    }
  },
  [IPC.legacyImportCancel]: (deps: CommandDeps) => async (req: { session_id: string }): Promise<DesktopResult<{ ok: boolean }>> => {
    try {
      return ok(await deps.legacyImport.cancel(req.session_id));
    } catch (e) {
      return err(new DesktopError(DESKTOP_ERROR_CODES.INVALID_REQUEST, e instanceof Error ? e.message : "cancel failed"));
    }
  },
} as const;
