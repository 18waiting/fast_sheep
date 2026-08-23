// M11 legacy import service (clean-room). Wraps @fastwork/legacy-import
// ImportOrchestrator with the real Worker + persistence adapters. The desktop
// service holds the selection by token and passes it at apply time so source
// checksums are recomputed and changed sources are rejected.
import {
  ImportOrchestrator,
  type ImportPlan, type ImportSession, type ImportSessionStorePort,
  type LegacySourceSelection, type LegacyImportOptions,
} from "@fastwork/legacy-import";
import type { WorkerImportClientPort } from "@fastwork/legacy-import";
import type { MainImportWriterPort } from "@fastwork/legacy-import";
import type { DatabaseBackupPort } from "@fastwork/legacy-import";
import type { VerificationDeps } from "@fastwork/legacy-import";
import { LegacyImportSelectionService } from "./legacy-import-selection-service.js";
import { LegacyImportStatusService } from "./legacy-import-status-service.js";

export interface LegacyImportServiceOptions {
  selectionService: LegacyImportSelectionService;
  statusService: LegacyImportStatusService;
  sessionStore: ImportSessionStorePort;
  mainWriter: MainImportWriterPort;
  workerClient: WorkerImportClientPort;
  backup: DatabaseBackupPort;
  verificationDeps: VerificationDeps;
  ragRebuild: () => Promise<boolean>;
  eventSink?: (channel: string, payload: unknown) => void;
}

export class LegacyImportService {
  private readonly orchestrator: ImportOrchestrator;
  private readonly selectionService: LegacyImportSelectionService;
  private readonly statusService: LegacyImportStatusService;
  private readonly eventSink: (channel: string, payload: unknown) => void;

  constructor(options: LegacyImportServiceOptions) {
    this.selectionService = options.selectionService;
    this.statusService = options.statusService;
    this.eventSink = options.eventSink ?? (() => {});
    this.orchestrator = new ImportOrchestrator({
      sessionStore: options.sessionStore,
      mainWriter: options.mainWriter,
      workerClient: options.workerClient,
      backup: options.backup,
      secretStore: { store: () => null },
      verificationDeps: options.verificationDeps,
      ragRebuild: options.ragRebuild,
      eventBus: { emit: (event, payload) => this.eventSink("legacy_import.changed", { event, payload }) },
    });
  }

  async select(): Promise<{ selection_token: string; item_count: number }> {
    return this.selectionService.select();
  }

  async scan(token: string): Promise<{ item_count: number }> {
    const selection = this.selectionService.peek(token);
    if (!selection) throw new Error("unknown selection token");
    return { item_count: selection.items.length };
  }

  async dryRun(token: string, options: LegacyImportOptions = {}): Promise<{ plan: ImportPlan; selection: LegacySourceSelection }> {
    const selection = this.selectionService.peek(token);
    if (!selection) throw new Error("unknown selection token");
    const plan = await this.orchestrator.dryRun(selection, options);
    return { plan, selection };
  }

  async apply(token: string, planSha256: string, sessionId?: string, options: LegacyImportOptions = {}): Promise<{ session: ImportSession; state: string }> {
    const selection = this.selectionService.take(token);
    const plans = await this.orchestrator.dryRun(selection, options);
    const plan = plans;
    if (planSha256 && plan.plan_sha256 !== planSha256) {
      throw new Error("plan checksum mismatch");
    }
    const result = await this.orchestrator.apply(plan, selection, sessionId);
    this.eventSink("legacy_import.changed", { event: "completed", session_id: result.session.session_id });
    return { session: result.session, state: result.session.state };
  }

  async status(sessionId: string): Promise<ReturnType<LegacyImportStatusService["project"]>> {
    const session = await this.orchestrator.status(sessionId);
    return this.statusService.project(session);
  }

  async cancel(sessionId: string): Promise<{ ok: boolean }> {
    await this.orchestrator.cancel(sessionId);
    return { ok: true };
  }
}
