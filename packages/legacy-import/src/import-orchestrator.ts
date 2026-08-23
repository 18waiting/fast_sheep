// M11 import orchestrator (clean-room). Phases:
// PLAN -> DRY_RUN -> APPLY_REQUEST -> BACKUP -> MAIN_WRITE -> WORKER_WRITE ->
// DERIVED_REBUILD -> VERIFY -> COMPLETE. Cancellation before mutation is zero-
// mutation; failure after Main is recoverable via idempotent resume.
import { readFileSync } from "node:fs";
import type {
  ImportPlan, ImportSession, LegacyImportOptions, LegacySourceSelection,
  KnowledgeImportRequest, KnowledgeImportResult, SourceItemRef,
} from "./types.js";
import type { ImportSessionStorePort } from "./import-session.js";
import { createSession } from "./import-session.js";
import { planImport } from "./import-planner.js";
import { fingerprintFile } from "./source-fingerprint.js";
import { verifyImport, type VerificationDeps } from "./import-verifier.js";
import { LegacyImportError, IMPORT_ERROR_CODES } from "./errors.js";
import type { MainImportWriterPort } from "./ports/main-import-writer.js";
import type { WorkerImportClientPort } from "./ports/worker-import-client.js";
import type { DatabaseBackupPort } from "./ports/database-backup-port.js";
import type { SecretStorePort } from "./ports/secret-store-port.js";
import type { Clock } from "./ports/clock.js";
import type { ImportEventBus } from "./ports/event-bus.js";
import { parseShopsJson } from "./parsers/shops-parser.js";
import { parseSettingsJson } from "./parsers/settings-parser.js";
import { parseFastkeyConfig } from "./parsers/fastkey-config-parser.js";
import { parseProductsCsv } from "./parsers/products-parser.js";
import { parsePromptsJson } from "./parsers/prompts-parser.js";
import { parseSkillMd } from "./parsers/skills-parser.js";
import { parseTransferRulesCsv } from "./parsers/transfer-rules-parser.js";
import { parseForbiddenWordsJson } from "./parsers/forbidden-words-parser.js";
import { parseMessagesCsv } from "./parsers/messages-parser.js";
import { parseCsv } from "./parsers/csv-utils.js";

export interface ImportOrchestratorOptions {
  sessionStore: ImportSessionStorePort;
  mainWriter: MainImportWriterPort;
  workerClient: WorkerImportClientPort;
  backup: DatabaseBackupPort;
  secretStore: SecretStorePort;
  clock?: Clock;
  eventBus?: ImportEventBus;
  verificationDeps: VerificationDeps;
  ragRebuild: () => Promise<boolean>;
}

export interface ImportApplyEffect { main_inserted: number; worker_inserted: number; duplicates: number }

export class ImportOrchestrator {
  private readonly sessionStore: ImportSessionStorePort;
  private readonly mainWriter: MainImportWriterPort;
  private readonly workerClient: WorkerImportClientPort;
  private readonly backup: DatabaseBackupPort;
  private readonly secretStore: SecretStorePort;
  private readonly clock: Clock;
  private readonly bus: ImportEventBus;
  private readonly verificationDeps: VerificationDeps;
  private readonly ragRebuild: () => Promise<boolean>;

  constructor(options: ImportOrchestratorOptions) {
    this.sessionStore = options.sessionStore;
    this.mainWriter = options.mainWriter;
    this.workerClient = options.workerClient;
    this.backup = options.backup;
    this.secretStore = options.secretStore;
    this.clock = options.clock ?? { now: () => Date.now() };
    this.bus = options.eventBus ?? { emit: () => {} };
    this.verificationDeps = options.verificationDeps;
    this.ragRebuild = options.ragRebuild;
  }

  /** PLAN + DRY_RUN: scan/parse/validate/map/conflict/secret detection, zero mutation. */
  async dryRun(selection: LegacySourceSelection, options: LegacyImportOptions = {}): Promise<ImportPlan> {
    this.bus.emit("legacy_import.dry_run", { selection_id: selection.selection_id });
    return planImport(selection, options);
  }

  /** Apply an existing plan against the same selection. */
  async apply(plan: ImportPlan, selection: LegacySourceSelection, sessionId?: string): Promise<{ session: ImportSession; verification: Awaited<ReturnType<typeof verifyImport>>; effect: ImportApplyEffect }> {
    const session = sessionId ? this.resumeSession(sessionId, plan) : createSession(plan.selection_id, plan.plan_sha256);
    this.sessionStore.create(session);
    this.sessionStore.updateState(session.session_id, "MAIN_PREPARED", "APPLY_REQUEST");

    const refs = new Map(selection.items.map((i) => [i.item_id, i]));

    // Apply recomputes source fingerprints; changed source is rejected.
    await this.assertSourcesUnchanged(plan, refs);

    this.bus.emit("legacy_import.apply_start", { session_id: session.session_id });

    // BACKUP before first mutation (reuse the durable backup_id on resume).
    if (!session.backup_id) {
      const b = this.backup.backup("legacy-import-" + session.session_id);
      session.backup_id = b.backup_id;
      this.sessionStore.create(session);
    }
    this.sessionStore.appendPhase(session.session_id, "BACKUP");

    // MAIN_WRITE (Main-owned aggregates only).
    let mainInserted = 0;
    try {
      for (const item of plan.items) {
        if (item.target_writer !== "main") continue;
        const ref = refs.get(item.item_id);
        if (!ref) throw new LegacyImportError(IMPORT_ERROR_CODES.NOT_SELECTED, "missing source for " + item.item_id);
        const parsed = this.parseForWrite(ref);
        const result = await this.mainWriter.write(ref, parsed, item, plan.options);
        mainInserted += result.inserted;
        this.bus.emit("legacy_import.main_written", { item_id: item.item_id, inserted: result.inserted, skipped: result.skipped });
      }
      this.sessionStore.updateState(session.session_id, "MAIN_APPLIED", "MAIN_WRITE");
    } catch (e) {
      this.sessionStore.updateState(session.session_id, "FAILED_RECOVERABLE", "FAILED", e instanceof Error ? e.message : String(e));
      throw e;
    }

    // WORKER_WRITE (knowledge/candidates only).
    let workerInserted = 0;
    let duplicates = 0;
    try {
      for (const item of plan.items) {
        if (item.target_writer !== "worker") continue;
        const ref = refs.get(item.item_id);
        if (!ref) throw new LegacyImportError(IMPORT_ERROR_CODES.NOT_SELECTED, "missing source for " + item.item_id);
        const request = this.buildKnowledgeRequest(ref, plan.selection_id);
        const result: KnowledgeImportResult = await this.workerClient.applyKnowledge(request);
        workerInserted += result.inserted;
        duplicates += result.skipped_duplicates;
        this.bus.emit("legacy_import.worker_written", { item_id: item.item_id, inserted: result.inserted, duplicates: result.skipped_duplicates });
      }
      this.sessionStore.updateState(session.session_id, "WORKER_APPLIED", "WORKER_WRITE");
    } catch (e) {
      this.sessionStore.updateState(session.session_id, "FAILED_RECOVERABLE", "FAILED", e instanceof Error ? e.message : String(e));
      throw e;
    }

    // DERIVED_REBUILD: clean-room FAISS rebuild (legacy FAISS never canonical).
    const ragOk = await this.ragRebuild();
    if (!ragOk) {
      this.sessionStore.updateState(session.session_id, "FAILED_RECOVERABLE", "FAILED", "rag rebuild failed");
      throw new LegacyImportError(IMPORT_ERROR_CODES.VERIFY_FAILED, "rag rebuild failed");
    }
    this.sessionStore.updateState(session.session_id, "DERIVED_REBUILT", "DERIVED_REBUILD");

    // VERIFY (reload the durable session state so resume reflects WORKER_APPLIED/DERIVED_REBUILT).
    const verifySession = this.sessionStore.get(session.session_id) ?? session;
    const verification = await verifyImport(verifySession, this.verificationDeps);
    if (!verification.all_ok) {
      this.sessionStore.updateState(session.session_id, "FAILED_RECOVERABLE", "FAILED", "verification failed");
      throw new LegacyImportError(IMPORT_ERROR_CODES.VERIFY_FAILED, "verification failed");
    }
    this.sessionStore.updateState(session.session_id, "VERIFIED", "VERIFY");

    this.sessionStore.updateState(session.session_id, "COMPLETED", "COMPLETE");
    this.bus.emit("legacy_import.completed", { session_id: session.session_id });
    return { session: this.sessionStore.get(session.session_id)!, verification, effect: { main_inserted: mainInserted, worker_inserted: workerInserted, duplicates } };
  }

  async status(sessionId: string): Promise<ImportSession> {
    const session = this.sessionStore.get(sessionId);
    if (!session) throw new LegacyImportError(IMPORT_ERROR_CODES.NOT_SELECTED, "unknown session");
    return session;
  }

  /** Cancel before mutation -> CANCELLED (zero mutation); after mutation -> FAILED_RECOVERABLE. */
  async cancel(sessionId: string): Promise<ImportSession> {
    const session = this.sessionStore.get(sessionId);
    if (!session) throw new LegacyImportError(IMPORT_ERROR_CODES.NOT_SELECTED, "unknown session");
    if (session.phases.length <= 1) {
      session.phases = [...session.phases, "CANCELLED"];
      this.sessionStore.create(session);
      return session;
    }
    this.sessionStore.updateState(sessionId, "FAILED_RECOVERABLE", "FAILED", "cancelled after mutation");
    return this.sessionStore.get(sessionId)!;
  }

  private resumeSession(sessionId: string, plan: ImportPlan): ImportSession {
    const existing = this.sessionStore.get(sessionId);
    if (!existing) throw new LegacyImportError(IMPORT_ERROR_CODES.NO_PLAN, "unknown session");
    if (existing.plan_sha256 !== plan.plan_sha256) {
      throw new LegacyImportError(IMPORT_ERROR_CODES.PLAN_MISMATCH, "plan fingerprint mismatch");
    }
    return existing;
  }

  private async assertSourcesUnchanged(plan: ImportPlan, refs: Map<string, SourceItemRef>): Promise<void> {
    for (const item of plan.items) {
      const ref = refs.get(item.item_id);
      if (!ref) continue;
      const current = await fingerprintFile(ref.path);
      if (current.sha256 !== item.source_fingerprint.sha256 || current.size !== item.source_fingerprint.size) {
        throw new LegacyImportError(IMPORT_ERROR_CODES.SOURCE_CHANGED, "source changed after plan: " + item.display_name);
      }
    }
  }

  private parseForWrite(ref: SourceItemRef): unknown {
    switch (ref.source_type) {
      case "shops": return { shops: parseShopsJson(ref) };
      case "settings": return parseSettingsJson(ref);
      case "ai_settings": return parseSettingsJson(ref);
      case "fastkey": return parseFastkeyConfig(ref);
      case "products": return { products: parseProductsCsv(ref) };
      case "prompts": return parsePromptsJson(ref);
      case "skills": return { skill: parseSkillMd(ref) };
      case "transfer_rules": return parseTransferRulesCsv(ref);
      case "forbidden_words": return { words: parseForbiddenWordsJson(ref) };
      case "messages": return parseMessagesCsv(ref);
      default: return {};
    }
  }

  private buildKnowledgeRequest(ref: SourceItemRef, selectionId: string): KnowledgeImportRequest {
    const table = parseCsv(readFileSync(ref.path, "utf-8"));
    const library = libraryForPath(ref.path);
    const rows = table.rows.map((r) => ({
      question: String(r["问题"] ?? ""),
      answer: String(r["答案"] ?? ""),
      product_id: String(r["商品ID"] ?? r["商品Id"] ?? ""),
      tags: String(r["标签"] ?? "").split(/[,，]/).map((t) => t.trim()).filter(Boolean),
      library,
    }));
    return { selection_id: selectionId, item_id: ref.item_id, rows };
  }

  private providerSecretDecision(): void {
    // Provider secrets are handled by secret-policy + SecretStore at the writer;
    // this orchestrator never touches plaintext secrets.
  }
}

function libraryForPath(path: string): string {
  if (path.includes("人工确认")) return "B库";
  if (path.includes("待审核")) return "待审核";
  if (path.includes("全自动收录") || path.includes("A库")) return "A库";
  return "A库";
}
