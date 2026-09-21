// M6/M7 composition root (offline). Builds Main-side services; Electron window wiring is in index.ts.
// Reuses @fastwork/orchestrator, @fastwork/persistence, @fastwork/contracts,
// @fastwork/desktop-ipc, @fastwork/platform-pdd. No live platform/worker process.
import {
  ConversationOrchestrator,
  ReviewModePolicy,
  CountdownPolicy,
  TakeoverBreakerPolicy,
  PreSendRevalidationPolicy,
  SegmentedSendPolicy,
  FeedbackIntentPolicy,
  WorkerAiEngineClient,
  type AiEngineClient,
  type EventBus,
  type PlatformAdapter,
  type TransferDecision,
} from "@fastwork/orchestrator";
import { InMemorySettingsRepository, type NormalizedConversationRepository, type NormalizedConversationRecord, type StoreRepository, type StoreRecord, type PlatformAccountRepository, type PlatformAccountRecord, type MessageRepository, type MessageRecord, type DeliveryAttemptRepository, type DeliveryAttemptRecord } from "@fastwork/persistence";
import { VirtualClock, FakeAiEngineClient, FakePlatformAdapter, CapturingEventBus, FakeFeedbackSink, InMemoryConversationRepositoryPort } from "@fastwork/test-kit";
import { OrchestratorFeedbackSink, type FeedbackService } from "@fastwork/feedback";
import type { PlatformStatusChangedEvent, PlatformSessionStatus } from "@fastwork/desktop-ipc";
import type { WorkerJobClientPort } from "@fastwork/background-jobs";
import type { OptimizationWorkerClientPort, ProductRepositoryPort, ProductRow } from "@fastwork/product-optimization";
import type { JobRepository, JobRecord, ProductRecord } from "@fastwork/persistence";
import { PddPlatformService } from "./platforms/pdd/pdd-platform-service.js";
import type { PddCanonicalIngressMode, PddMainAdmissionProvider } from "./platforms/pdd/pdd-main-admission.js";
import type { PddInboundIngressInput } from "./platforms/pdd/pdd-inbound-ingress.js";
import { PDD_PRODUCTION_CHAT_URL, PDD_TOP_LEVEL_HOST } from "./platforms/pdd/pdd-navigation-policy.js";
import { createWorkspaceMerchantContext, type WorkspaceMerchantContext } from "./services/workspace-merchant-context.js";
import { createCanonicalInboundPersistence, type CanonicalInboundPersistenceResult } from "./services/canonical-inbound-persistence.js";
import { createInboundTurnBuilder, type InboundTurn, type InboundTurnBuilder, type TurnExpiryScheduler } from "./services/inbound-turn-builder.js";
import type { InboundEnvelope } from "@fastwork/domain";
import { GenericPlatformService } from "./platforms/shared/generic-platform-service.js";
import { PlatformSessionCoordinator } from "./platforms/platform-session-coordinator.js";
import { createDoudianPlatformService } from "./platforms/doudian/doudian-platform-service.js";
import { createJDPlatformService } from "./platforms/jd/jd-platform-service.js";
import { createKuaishouPlatformService } from "./platforms/kuaishou/kuaishou-platform-service.js";
import { createQianniuPlatformService } from "./platforms/qianniu/qianniu-platform-service.js";
import { createXianyuPlatformService } from "./platforms/xianyu/xianyu-platform-service.js";
import { OrchestratorHost } from "./services/orchestrator-host.js";
import { ShopService, type ShopRow } from "./services/shop-service.js";
import { WorkerStatusService, type WorkerStatusSource } from "./services/worker-status-service.js";
import { WorkbenchProjectionService, type ProjectionSource } from "./services/workbench-projection-service.js";
import { SettingsService, type SettingsSource } from "./services/settings-service.js";
import { BackgroundJobService } from "./services/background-job-service.js";
import {
  ImportOrchestrator, PersistenceMainImportWriter, SecretStoreAdapter,
  type ImportSessionStorePort, type MainImportWriterPort, type WorkerImportClientPort,
  type DatabaseBackupPort, type VerificationDeps,
} from "@fastwork/legacy-import";
import { LegacyImportSelectionService } from "./services/legacy-import-selection-service.js";
import { LegacyImportStatusService } from "./services/legacy-import-status-service.js";
import { LegacyImportService } from "./services/legacy-import-service.js";
import type { ImportDialogPort } from "./import/legacy-import-dialog.js";
import { LearningService } from "./services/learning-service.js";
import { ReviewService } from "./services/review-service.js";
import { AuditService } from "./services/audit-service.js";
import { DesktopProductOptimizationService } from "./services/product-optimization-service.js";
import { syntheticShops, isTestMode, platformForShop as platformForSyntheticShop } from "./test-mode.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PDD_FIXTURES = join(HERE, "..", "..", "..", "..", "packages", "platform-pdd", "tests", "fixtures");

export interface MainContext {
  orchestratorHost: OrchestratorHost;
  shops: ShopService;
  worker: WorkerStatusService;
  projection: WorkbenchProjectionService;
  settings: SettingsService;
  revision(): number;
  /** EventBus adapter used by the event bridges (EventBus-compatible). */
  eventBus: EventBus;
  /** Raw capturing event bus for test observability. */
  rawEvents: CapturingEventBus;
  /** M7 PDD platform service (composition root). */
  platform: PddPlatformService;
  /** M8 multi-platform session coordinator. */
  coordinator: PlatformSessionCoordinator;
  /** M8: resolve platform id for a shop. */
  platformForShop(shopId: string): string | null;
  /** Routing PlatformAdapter used by the orchestrator (PDD route + fallback). */
  routingAdapter: PlatformAdapter;
  /** Fallback fake platform adapter (non-PDD / unactivated shops; M6 tests). */
  platformFallback: FakePlatformAdapter;
  /** Status-change sink holder set by main/index.ts to broadcast to the renderer. */
  platformStatusSink: { current: ((ev: PlatformStatusChangedEvent) => void) | null };
  /** M9 real Main FeedbackService (null in isolated test mode). */
  feedbackService: FeedbackService | null;
  clock: VirtualClock;
  orchestrator: ConversationOrchestrator;
  /** PR1: Conversation normalized repository port (production = SQLite via worker-backed composition). */
  conversations: NormalizedConversationRepository;
  /** SHEEP-063-PR2: Main-owned workspace merchant authorization anchor (production = bootstrapped; test mode = synthetic; null = not established). */
  workspaceMerchant: WorkspaceMerchantContext | null;
  /** SHEEP-302 (bounded offline slice): canonical inbound receipt counters (ingested/duplicates/rejected). */
  inboundReceipt: { ingested: number; duplicates: number; rejected: number; lastReason: string | null };
  /** SHEEP-303 in-memory turn aggregation (DEFAULT OFF; inert unless Main enabled it). */
  inboundTurns: InboundTurnBuilder;
  /**
   * SHEEP-303 aggregation failures contained by Main: the aggregation step can never change the
   * canonical receipt, so its failures are counted SEPARATELY from `inboundReceipt.rejected`.
   */
  inboundTurnFailures: { failures: number; lastReason: string | null };
  /** SHEEP-063-PR1: Message normalized repository port (production = SQLite via worker-backed composition). */
  messages: MessageRepository;
  /** SHEEP-066-PR1: durable Text Delivery Attempt journal port (production = SQLite via worker-backed composition). */
  deliveryAttempts: DeliveryAttemptRepository;
  /** SHEEP-060: Store repository port (merchant boundary resolution for queue scope). */
  stores: StoreRepository;
  /** SHEEP-061: PlatformAccount repository port (canonical platform fact source for queue platform filter). */
  platformAccounts: PlatformAccountRepository;
  /** M10 Main-owned BackgroundJobService (single writer for background_jobs). */
  jobs: BackgroundJobService;
  /** M10 learning service (Worker executes offline QA lifecycle). */
  learning: LearningService;
  /** M10 review service (Worker proposes/applies/restores). */
  review: ReviewService;
  /** M10 audit service (Worker decides). */
  audit: AuditService;
  /** M10 optimization service (Worker proposes, Main applies). */
  optimization: DesktopProductOptimizationService;
  /** M11 legacy import selection service (Main dialog -> selection_token). */
  legacyImportSelection: LegacyImportSelectionService;
  /** M11 legacy import service (scan/plan/dry-run/apply/status/cancel). */
  legacyImport: LegacyImportService;
  /** M11 legacy import status projection. */
  legacyImportStatus: LegacyImportStatusService;
}

export interface BootstrapOptions {
  testMode?: boolean;
  workerSource?: WorkerStatusSource;
  /** M7 vertical mode: inject a worker-backed AiEngineClient (real M2 worker). */
  aiEngineClient?: AiEngineClient;
  /** M9: real Main FeedbackService; when provided the orchestrator uses the real OrchestratorFeedbackSink. */
  feedbackService?: FeedbackService;
  /** M10: Main-owned persistence JobRepository (defaults to in-memory in test mode). */
  jobRepository?: JobRepository;
  /** M10: Worker RPC client for job work (defaults to an offline fake). */
  workerJobClient?: WorkerJobClientPort;
  /** M10: optimization worker client (worker proposes only; defaults to offline fake). */
  optimizationWorkerClient?: OptimizationWorkerClientPort;
  /** M10: Main-owned product repository (single writer for products). */
  productRepository?: ProductRepositoryPort;
  /** M10: typed event sink for jobs/learning/review/audit/optimization changes. */
  m10EventSink?: (channel: string, payload: unknown) => void;
  /** M11: Electron import dialog port (defaults to a no-file fake in test mode). */
  importDialog?: ImportDialogPort;
  /** M11: durable import session store (defaults to in-memory in test mode). */
  importSessionStore?: ImportSessionStorePort;
  /** M11: Main import writer (defaults to an in-memory no-op in test mode). */
  importMainWriter?: MainImportWriterPort;
  /** M11: Worker import client (defaults to an offline fake). */
  importWorkerClient?: WorkerImportClientPort;
  /** M11: verification deps (defaults to all-ok in test mode). */
  importVerificationDeps?: VerificationDeps;
  /** M11: clean-room RAG rebuild hook (defaults to true in test mode). */
  importRagRebuild?: () => Promise<boolean>;
  /** M11: database backup port (defaults to no-op in test mode). */
  importBackup?: DatabaseBackupPort;
  /** PR1: Conversation normalized repository (defaults to in-memory test double in test mode; production composition binds SQLite). */
  conversationRepository?: NormalizedConversationRepository;
  /** SHEEP-063-PR2: workspace merchant context (production worker-backed composition builds it from the trusted bootstrap; test mode may inject an explicit synthetic context). */
  workspaceMerchant?: WorkspaceMerchantContext | null;
  /** SHEEP-063-PR1: Message repository (defaults to in-memory test double in test mode; production composition binds SQLite). */
  messageRepository?: MessageRepository;
  /** SHEEP-066-PR1: Delivery Attempt repository (defaults to in-memory test double in test mode; production composition binds SQLite). */
  deliveryAttemptRepository?: DeliveryAttemptRepository;
  /** SHEEP-060: Store repository (defaults to in-memory test double in test mode; production composition binds SQLite). */
  storeRepository?: StoreRepository;
  /** SHEEP-061: PlatformAccount repository (defaults to in-memory test double in test mode; production composition binds SQLite). */
  platformAccountRepository?: PlatformAccountRepository;
  /** Controlled production-only PDD shop selected by exact local Shop.id. */
  controlledProductionPddShop?: ShopRow | null;
  /** Main-only controlled PDD ingress mode. Production default is DISABLED. */
  canonicalIngressMode?: PddCanonicalIngressMode;
  /** Main-owned admission provider. Default is DENY_ALL. */
  mainAdmissionProvider?: PddMainAdmissionProvider;
  /**
  /**
   * SHEEP-303 controlled inbound turn aggregation (DEFAULT OFF). Main owns this switch; the page
   * payload can never enable it. Aggregation is in-memory only: no AI, no send, no persistence.
   */
  inboundTurnAggregation?: {
    readonly enabled: boolean;
    readonly quietWindowMs?: number;
    readonly clock?: { now(): number };
    readonly onTurn?: (turn: InboundTurn) => void;
    /** Main-owned expiry driver (default: bounded interval scheduler). Never started when disabled. */
    readonly scheduler?: TurnExpiryScheduler;
  };
  /** Controlled loopback/fixture frame decoder. */
  decodeInboundFrame?: (payloadData: string) => PddInboundIngressInput | null;
  /** Local-only WebSocket allowlist for the controlled observer. */
  allowedInboundWebSocketUrl?: (url: string) => boolean;
  /** Trusted-request-start allowlist for HTTP inbound observation (separate from WS). */
  allowedInboundHttpRequest?: (method: string, url: string) => boolean;
  /** Decoder for a fully-read HTTP response body; inputs still pass admission. */
  decodeInboundHttpBody?: (body: string, binding: import("./platforms/pdd/pdd-inbound-observer.js").PddHttpRequestBinding) => readonly PddInboundIngressInput[] | null;
  /** Trusted Main scope binding for the observed document (required by the controlled path). */
  resolveInboundScope?: (document: import("./platforms/pdd/pdd-session-host.js").PddInboundDocumentBinding) => import("@fastwork/platform-pdd").PddCanonicalScopeBinding | null;
  /** Trusted Main identity binding for an observed message (required by the controlled path). */
  resolveInboundIdentity?: (message: import("@fastwork/platform-pdd").PddCanonicalInboundMessage, document: import("./platforms/pdd/pdd-session-host.js").PddInboundDocumentBinding) => import("@fastwork/platform-pdd").PddCanonicalIdentityBinding | null;
  /** Canonical envelope validator override; null forces unavailable (fail closed). */
  canonicalEnvelopeValidator?: ((value: unknown) => boolean) | null;
  /** Diagnostic-only WebSocket frame sink; never affects canonical admission. */
  onDiagnosticWsFrame?: (frame: { readonly origin: string; readonly requestId: string; readonly direction: "IN" | "OUT"; readonly opcode: number; readonly payloadData: string; readonly bound: boolean }) => void;
  /** Test seam: supply the inbound observer (default is the real PddInboundObserver). */
  createInboundObserver?: import("./platforms/pdd/pdd-inbound-observer.js").PddInboundObserverOptions extends never ? never : (options: import("./platforms/pdd/pdd-inbound-observer.js").PddInboundObserverOptions) => import("./platforms/pdd/pdd-inbound-observer.js").PddInboundObserver;
  /** Test seam: supply the per-shop view host (default builds a real WebContentsView). */
  makeView?: (shopId: string, navigationMode: "FIXTURE" | "PRODUCTION_READ_ONLY") => import("./platforms/pdd/pdd-view-host.js").PddViewHost;
}

/** Minimal in-memory JobRepository for isolated test mode (M10). */
/** PR1: minimal in-memory NormalizedConversationRepository test double (isolated test mode only). */
/** SHEEP-060: minimal in-memory StoreRepository test double (isolated test mode only). */
/** SHEEP-061: minimal in-memory PlatformAccountRepository test double (isolated test mode only). */
class InMemoryPlatformAccountRepositoryImpl implements PlatformAccountRepository {
  private readonly map = new Map<string, PlatformAccountRecord>();
  save(p: PlatformAccountRecord): void { this.map.set(p.id, { ...p, externalRef: p.externalRef ?? null }); }
  findById(id: string): PlatformAccountRecord | null { const r = this.map.get(id); return r ? { ...r, externalRef: r.externalRef ?? null } : null; }
  listByMerchant(merchantId: string): PlatformAccountRecord[] { return [...this.map.values()].filter((p) => p.merchantId === merchantId).map((p) => ({ ...p, externalRef: p.externalRef ?? null })); }
}

class InMemoryStoreRepositoryImpl implements StoreRepository {
  private readonly map = new Map<string, StoreRecord>();
  save(s: StoreRecord): void { this.map.set(s.id, { ...s }); }
  findById(id: string): StoreRecord | null { const r = this.map.get(id); return r ? { ...r } : null; }
  listByMerchant(merchantId: string): StoreRecord[] { return [...this.map.values()].filter((s) => s.merchantId === merchantId).map((s) => ({ ...s })); }
}

class InMemoryNormalizedConversationRepositoryImpl implements NormalizedConversationRepository {
  private readonly map = new Map<string, NormalizedConversationRecord>();
  save(c: NormalizedConversationRecord): void { this.map.set(c.id, { ...c, externalRef: c.externalRef ?? null }); }
  findById(id: string): NormalizedConversationRecord | null { const r = this.map.get(id); return r ? { ...r, externalRef: r.externalRef ?? null } : null; }
  listByMerchant(merchantId: string): NormalizedConversationRecord[] {
    return [...this.map.values()].filter((c) => c.merchantId === merchantId).map((c) => ({ ...c, externalRef: c.externalRef ?? null })).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  listByStore(storeId: string): NormalizedConversationRecord[] {
    return [...this.map.values()].filter((c) => c.storeId === storeId).map((c) => ({ ...c, externalRef: c.externalRef ?? null })).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
}

/** SHEEP-063-PR1: minimal in-memory MessageRepository test double (isolated test mode only). */
/** SHEEP-066-PR1: minimal in-memory DeliveryAttemptRepository test double (isolated test mode only). */
class InMemoryDeliveryAttemptRepositoryImpl implements DeliveryAttemptRepository {
  private readonly map = new Map<string, DeliveryAttemptRecord>();
  create(a: DeliveryAttemptRecord): void { this.map.set(a.id, { ...a }); }
  findById(id: string): DeliveryAttemptRecord | null { const r = this.map.get(id); return r ? { ...r } : null; }
  markInFlight(id: string, dispatchedAt: string): DeliveryAttemptRecord | null {
    const r = this.map.get(id);
    if (!r || r.status !== "PENDING") return null;
    const next = { ...r, status: "IN_FLIGHT" as const, dispatchedAt };
    this.map.set(id, next); return { ...next };
  }
  resolve(id: string, status: "REJECTED" | "UNKNOWN", resolvedAt: string): DeliveryAttemptRecord | null {
    const r = this.map.get(id);
    if (!r || (r.status !== "PENDING" && r.status !== "IN_FLIGHT")) return null;
    const next = { ...r, status, resolvedAt };
    this.map.set(id, next); return { ...next };
  }
  listInFlight(): DeliveryAttemptRecord[] { return [...this.map.values()].filter((a) => a.status === "IN_FLIGHT").map((a) => ({ ...a })); }
  recoverInFlight(resolvedAt: string): number {
    const inFlight = [...this.map.values()].filter((a) => a.status === "IN_FLIGHT");
    for (const a of inFlight) this.map.set(a.id, { ...a, status: "UNKNOWN", resolvedAt });
    return inFlight.length;
  }
  updateAcknowledged(id: string, f: { resolvedAt: string; deliveredMessageId: string; ackSourceRef: string | null; ackOccurredAt: string | null }): DeliveryAttemptRecord | null {
    const r = this.map.get(id);
    if (!r || r.status !== "IN_FLIGHT") return null;
    const next = { ...r, status: "ACKNOWLEDGED" as const, resolvedAt: f.resolvedAt, deliveredMessageId: f.deliveredMessageId, ackSourceRef: f.ackSourceRef, ackOccurredAt: f.ackOccurredAt };
    this.map.set(id, next); return { ...next };
  }
}

class InMemoryMessageRepositoryImpl implements MessageRepository {
  private readonly map = new Map<string, MessageRecord>();
  save(m: MessageRecord): void { this.map.set(m.id, { ...m, externalRef: m.externalRef ?? null, actor: m.actor ?? null, contentKind: m.contentKind ?? null, contentText: m.contentText ?? null, occurredAt: m.occurredAt ?? null, observedAt: m.observedAt ?? null }); }
  findById(id: string): MessageRecord | null { const r = this.map.get(id); return r ? { ...r, externalRef: r.externalRef ?? null, actor: r.actor ?? null, contentKind: r.contentKind ?? null, contentText: r.contentText ?? null, occurredAt: r.occurredAt ?? null, observedAt: r.observedAt ?? null } : null; }
  listByConversation(conversationId: string): MessageRecord[] {
    return [...this.map.values()]
      .filter((m) => m.conversationId === conversationId)
      .map((m) => ({ ...m, externalRef: m.externalRef ?? null, actor: m.actor ?? null, contentKind: m.contentKind ?? null, contentText: m.contentText ?? null, occurredAt: m.occurredAt ?? null, observedAt: m.observedAt ?? null }))
      .sort((a, b) => {
        const ao = a.occurredAt ?? ""; const bo = b.occurredAt ?? "";
        if ((a.occurredAt == null) !== (b.occurredAt == null)) return a.occurredAt == null ? 1 : -1;
        if (ao !== bo) return ao < bo ? -1 : 1;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
  }
}

class InMemoryJobRepositoryImpl implements JobRepository {
  private readonly map = new Map<string, JobRecord>();
  create(j: JobRecord): void { this.map.set(j.job_id, { ...j }); }
  update(j: JobRecord): void { this.map.set(j.job_id, { ...j }); }
  get(id: string): JobRecord | undefined { const j = this.map.get(id); return j ? { ...j } : undefined; }
  list(state?: string): JobRecord[] { return [...this.map.values()].filter((j) => !state || j.state === state); }
}

export function createMainContext(options: BootstrapOptions = {}): MainContext {
  const testMode = options.testMode ?? isTestMode();
  const clock = new VirtualClock();
  const platformFallback = new FakePlatformAdapter(clock);
  const rawEvents = new CapturingEventBus();
  const feedback = options.feedbackService ? new OrchestratorFeedbackSink(options.feedbackService) : new FakeFeedbackSink();
  const repo = new InMemoryConversationRepositoryPort();
  const conversationRepository = options.conversationRepository ?? new InMemoryNormalizedConversationRepositoryImpl();
  const messageRepository = options.messageRepository ?? new InMemoryMessageRepositoryImpl();
  const deliveryAttemptRepository = options.deliveryAttemptRepository ?? new InMemoryDeliveryAttemptRepositoryImpl();
  // SHEEP-063-PR2-PR1: workspace merchant identity is Main-owned and explicit.
  // Production worker-backed composition bootstraps/resolves a trusted identity;
  // isolated test mode uses an explicit synthetic id (never persisted here).
  const workspaceMerchant = options.workspaceMerchant ?? (testMode ? createWorkspaceMerchantContext("merchant-test-1") : null);
  const storeRepository = options.storeRepository ?? new InMemoryStoreRepositoryImpl();
  const platformAccountRepository = options.platformAccountRepository ?? new InMemoryPlatformAccountRepositoryImpl();
  const aiRaw = new FakeAiEngineClient([{ reply: "亲,有的哦~" }]);

  // Default: offline fake AI (M6). M7 vertical smoke injects a real worker client.
  const ai: AiEngineClient = options.aiEngineClient ?? {
    generateReply: async (input) => {
      const r = await aiRaw.generateReply(input);
      return { reply: r.reply, fast_return: r.fast_return, error: r.error, decision: r.decision as TransferDecision | undefined };
    },
  };

  const eventBus: EventBus = {
    emit: (event, payload) => rawEvents.emit(event, payload as Record<string, unknown> | undefined),
    on: (handler) => rawEvents.on((captured) => handler(captured.event, captured.payload)),
  };

  const orchestrator = new ConversationOrchestrator({
    aiEngineClient: ai,
    platformAdapter: platformFallback, // replaced by routing adapter below
    clock,
    eventBus,
    feedbackSink: feedback,
    repository: repo,
    segmentIntervalMs: 800,
    policies: {
      reviewModePolicy: new ReviewModePolicy(),
      countdownPolicy: new CountdownPolicy(1000),
      takeoverBreakerPolicy: new TakeoverBreakerPolicy(2, 60000, clock),
      preSendRevalidationPolicy: new PreSendRevalidationPolicy(),
      segmentedSendPolicy: new SegmentedSendPolicy(),
      feedbackIntentPolicy: new FeedbackIntentPolicy(),
    },
  });

  let revision = 0;
  const bumpRevision = () => { revision += 1; return revision; };

  // Test mode keeps all synthetic shops; production exposes only the explicitly selected local shop.
  const configuredProductionPddShop = options.controlledProductionPddShop ?? null;
  const controlledProductionPddShop = !testMode && configuredProductionPddShop?.enabled && configuredProductionPddShop.type === "pdd"
    ? configuredProductionPddShop
    : null;
  const shopRows = testMode ? syntheticShops() : controlledProductionPddShop ? [controlledProductionPddShop] : [];
  const shops = new ShopService({ list: async () => shopRows });

  const workerSource: WorkerStatusSource = options.workerSource ?? {
    state: () => "ready", version: () => "0.0.0", protocolVersion: () => 1, lastError: () => null,
  };
  const worker = new WorkerStatusService(workerSource);

  const settingsRepo = new InMemorySettingsRepository();
  settingsRepo.setGroup("CollaborationConfig", {
    mode: "human_review", countdown_seconds: 5, send_interval_ms: 800,
    send_precheck: true, single_thread_listener: true, breaker_threshold: 2, breaker_window_ms: 60000,
  });
  const desktopConfig = () => (settingsRepo.getGroup("CollaborationConfig") ?? {}) as Record<string, unknown>;
  const settings = new SettingsService({
    reviewModeDefault: () => (desktopConfig().mode === "full_auto" ? "full_auto" : "human_review"),
    countdownTickMs: () => (typeof desktopConfig().countdown_seconds === "number" ? (desktopConfig().countdown_seconds as number) * 1000 : 1000),
    segmentIntervalMs: () => (typeof desktopConfig().send_interval_ms === "number" ? (desktopConfig().send_interval_ms as number) : 800),
  } satisfies SettingsSource);

  const selectedShop = { id: testMode ? "shop-test-1" : (controlledProductionPddShop?.shop_id ?? "") };
  const projectionSource: ProjectionSource = {
    revision: () => revision,
    shops: () => shopRows.map((s) => ({ shop_id: s.shop_id, name: s.name, type: s.type, enabled: s.enabled })),
    selectedShopId: () => selectedShop.id || null,
    conversation: () => (testMode ? { conversation_id: "c1", shop_id: selectedShop.id || "shop-test-1", state: "suggestion_pending", buyer: "测试买家" } : null),
    suggestion: () => (testMode ? { reply: "亲,有的哦~", generation: 1, status: "pending" } : null),
    mode: () => "human_review",
    countdown: () => (testMode ? { enabled: true, remaining_ticks: 5, tick_ms: 1000 } : null),
    sendStatus: () => null,
    takeoverStatus: () => null,
    workerStatus: () => worker.status(),
    lastError: () => null,
    platformCapability: () => (testMode || controlledProductionPddShop ? "pdd" : "none"),
  };
  const projection = new WorkbenchProjectionService(projectionSource);

  // M7 PDD platform service (composition root). Test mode loads local synthetic
  // fixtures; production entry URL is config-provided (CR-PDD-URL-001).
  const platformStatusSink: { current: ((ev: PlatformStatusChangedEvent) => void) | null } = { current: null };
  const feedbackService = options.feedbackService ?? null;
  // SHEEP-302 (bounded offline slice): canonical inbound -> normalized persistence.
  // Inert unless canonicalIngressMode === "CANONICAL_CONTROLLED" (production default
  // is DISABLED), so production inbound behavior is unchanged by this wiring.
  const canonicalInboundPersistence = createCanonicalInboundPersistence({
    conversations: conversationRepository,
    messages: messageRepository,
  });
  const inboundReceipt = { ingested: 0, duplicates: 0, rejected: 0, lastReason: null as string | null };
  // SHEEP-303: in-memory turn aggregation, DEFAULT OFF. Only the canonical `INGESTED` receipt can
  // feed it; the durable row supplies the Main ingestion time used for window timing and ordering.
  const inboundTurns = createInboundTurnBuilder(
    options.inboundTurnAggregation
      ? {
        enabled: options.inboundTurnAggregation.enabled === true,
        ...(options.inboundTurnAggregation.quietWindowMs === undefined ? {} : { quietWindowMs: options.inboundTurnAggregation.quietWindowMs }),
        ...(options.inboundTurnAggregation.clock === undefined ? {} : { clock: options.inboundTurnAggregation.clock }),
        ...(options.inboundTurnAggregation.onTurn === undefined ? {} : { onTurn: options.inboundTurnAggregation.onTurn }),
        ...(options.inboundTurnAggregation.scheduler === undefined ? {} : { scheduler: options.inboundTurnAggregation.scheduler }),
      }
      : { enabled: false },
  );
  const inboundTurnFailures = { failures: 0, lastReason: null as string | null };
  const onCanonicalInbound = (envelope: InboundEnvelope): CanonicalInboundPersistenceResult => {
    let outcome: CanonicalInboundPersistenceResult;
    try {
      // 1. canonical persistence FIRST; its INGESTED/DUPLICATE result is the durable fact.
      outcome = canonicalInboundPersistence.ingest(envelope);
    } catch (error) {
      inboundReceipt.rejected += 1;
      inboundReceipt.lastReason = String((error as { reason?: unknown }).reason ?? "UNKNOWN");
      throw error;
    }
    if (outcome.status === "INGESTED") inboundReceipt.ingested += 1;
    else inboundReceipt.duplicates += 1;
    // 2. aggregation is a SEPARATE step: a failure here is counted on its own and never rewrites the
    // canonical receipt (a stored message must never be reported as canonical-rejected).
    if (inboundTurns.enabled) {
      // The aggregation layer sees BOTH statuses: INGESTED aggregates, DUPLICATE is dropped and
      // counted there (so "duplicates never create a turn" is provable end to end).
      try {
        const lock = envelope.identityLock;
        const resolved = (resolution: { status: string; value?: unknown }): string | null =>
          resolution.status === "RESOLVED" ? String(resolution.value) : null;
        inboundTurns.ingest({
          receipt: { status: outcome.status, conversationId: outcome.conversationId, messageId: outcome.messageId },
          platform: lock.platform,
          scope: {
            merchantId: resolved(lock.merchantId),
            storeId: resolved(lock.storeId),
            platformAccountId: resolved(lock.platformAccountId),
          },
          customerId: lock.platformCustomerId.status === "RESOLVED"
            ? String((lock.platformCustomerId.value as { value?: unknown }).value ?? "")
            : null,
          observedAt: messageRepository.findById(outcome.messageId)?.observedAt ?? null,
          actor: "customer",
          contentKind: envelope.sourceContent.kind,
          contentText: envelope.sourceContent.text,
        });
      } catch (error) {
        inboundTurnFailures.failures += 1;
        inboundTurnFailures.lastReason = String((error as { message?: unknown })?.message ?? error ?? "UNKNOWN");
      }
    }
    return outcome;
  };

  const platform = new PddPlatformService({
    navigationMode: testMode ? "FIXTURE" : "PRODUCTION_READ_ONLY",
    orchestrator,
    allowedProductionHosts: testMode ? [] : [PDD_TOP_LEVEL_HOST],
    productionEntryUrl: testMode ? undefined : PDD_PRODUCTION_CHAT_URL,
    canonicalIngressMode: options.canonicalIngressMode ?? "DISABLED",
    mainAdmissionProvider: options.mainAdmissionProvider,
    decodeInboundFrame: options.decodeInboundFrame,
    allowedInboundWebSocketUrl: options.allowedInboundWebSocketUrl,
    allowedInboundHttpRequest: options.allowedInboundHttpRequest,
    decodeInboundHttpBody: options.decodeInboundHttpBody,
    makeView: options.makeView,
    createInboundObserver: options.createInboundObserver,
    onDiagnosticWsFrame: options.onDiagnosticWsFrame,
    resolveInboundScope: options.resolveInboundScope,
    resolveInboundIdentity: options.resolveInboundIdentity,
    canonicalEnvelopeValidator: options.canonicalEnvelopeValidator,
    onCanonicalInbound,
    fixturePathFor: testMode
      ? (shopId) => join(PDD_FIXTURES, shopId === "shop-test-2" ? "conversation-switch.html" : "chat-basic.html")
      : undefined,
    onStatusChanged: (ev) => {
      bumpRevision();
      platformStatusSink.current?.(ev);
    },
    revision: () => revision,
  });

  // Routing adapter: PDD-activated shops -> PddPlatformAdapter; otherwise fallback.
  const isControlledProductionPddShop = (shopId: string): boolean =>
    !testMode && controlledProductionPddShop?.shop_id === shopId;
  const routingAdapter: PlatformAdapter = {
    sendText: async (shopId, conversationId, segments) => {
      const pdd = platform.adapterFor(shopId);
      if (pdd) return pdd.sendText(shopId, conversationId, segments);
      if (platform.status(shopId) || isControlledProductionPddShop(shopId)) return { ok: false, error: "platform.command_disabled_navigation_only" };
      return platformFallback.sendText(shopId, conversationId, segments);
    },
    getCurrentConversationState: async (shopId, conversationId) => {
      const pdd = platform.adapterFor(shopId);
      if (pdd) return pdd.getCurrentConversationState(shopId, conversationId);
      if (platform.status(shopId) || isControlledProductionPddShop(shopId)) return { hasNewMessage: false };
      return platformFallback.getCurrentConversationState(shopId, conversationId);
    },
    onTransfer: (decision: TransferDecision) => {
      const shopId = (decision as { shop_id?: string }).shop_id;
      const pdd = shopId ? platform.adapterFor(shopId) : null;
      if (pdd) pdd.onTransfer(decision);
      else if (shopId && (platform.status(shopId) || isControlledProductionPddShop(shopId))) return;
      else platformFallback.onTransfer(decision);
    },
  };
  // Replace the fallback adapter on the orchestrator with the routing adapter.
  (orchestrator as unknown as { platformAdapter: PlatformAdapter }).platformAdapter = routingAdapter;

  const orchestratorHost = new OrchestratorHost(orchestrator);
  const platformForShop = testMode
    ? platformForSyntheticShop
    : (shopId: string) => controlledProductionPddShop?.shop_id === shopId ? controlledProductionPddShop.type : null;

  if (testMode) {
    orchestrator.seedConversation("shop-test-1", "c1", {
      mode: "human_review",
      suggestion: { reply: "亲,有的哦~", generation: 1 },
      countdown: { enabled: true, remaining_ticks: 5, tick_ms: 1000 },
    });
  }

  // M8: register the five remaining platforms on the coordinator (test mode uses
  // local synthetic fixtures from each platform package).
  const coordinator = new PlatformSessionCoordinator();
  coordinator.register("pdd", platform);
  const PLATFORM_IDS = ["doudian", "jd", "kuaishou", "qianniu", "xianyu"] as const;
  const platformServices = new Map<string, GenericPlatformService>();
  const fixturesRoot = join(HERE, "..", "..", "..", "..", "packages");
  type StatusHook = (ev: { shop_id: string; session_status: string; revision: number; last_error?: string }) => void;
  const statusHook: StatusHook = (ev) => {
    bumpRevision();
    platformStatusSink.current?.({ shop_id: ev.shop_id, session_status: ev.session_status as PlatformSessionStatus, revision: ev.revision, last_error: ev.last_error });
  };
  const serviceFactories: Record<(typeof PLATFORM_IDS)[number], (opts: { testMode: boolean; orchestrator: ConversationOrchestrator; fixturePathFor?: (shopId: string) => string; onStatusChanged: StatusHook; revision: () => number }) => GenericPlatformService> = {
    doudian: (o) => createDoudianPlatformService(o),
    jd: (o) => createJDPlatformService(o),
    kuaishou: (o) => createKuaishouPlatformService(o),
    qianniu: (o) => createQianniuPlatformService(o),
    xianyu: (o) => createXianyuPlatformService(o),
  };
  for (const pid of PLATFORM_IDS) {
    const service = serviceFactories[pid]({
      testMode,
      orchestrator,
      fixturePathFor: testMode
        ? () => join(fixturesRoot, "platform-" + pid, "tests", "fixtures", "chat-basic.html")
        : undefined,
      onStatusChanged: statusHook,
      revision: () => revision,
    });
    platformServices.set(pid, service);
    coordinator.register(pid as never, service);
  }

  // ---- M10 composition (Main-owned background jobs + domain services) ----
  const m10Sink = options.m10EventSink ?? (() => {});
  const jobRepository = options.jobRepository ?? new InMemoryJobRepositoryImpl();
  const jobs = new BackgroundJobService({
    jobRepository,
    eventSink: (channel, payload) => {
      bumpRevision();
      m10Sink(channel, payload);
    },
  });
  const workerJobClient: WorkerJobClientPort = options.workerJobClient ?? {
    run: async (type: string) => ({ type, ok: true }),
  };
  const learning = new LearningService({ jobs, worker: workerJobClient, eventSink: m10Sink });
  const review = new ReviewService({ jobs, worker: workerJobClient, eventSink: m10Sink });
  const audit = new AuditService({ jobs, worker: workerJobClient, eventSink: m10Sink });

  // Main-owned product repository (single writer for products). Defaults to an
  // in-memory ProductRepositoryPort in isolated test mode; vertical smoke injects
  // a Sqlite-backed adapter.
  const productRows = new Map<string, ProductRecord>();
  const defaultProductRepository: ProductRepositoryPort = {
    get: (productId: string): ProductRow | null => {
      const p = productRows.get(productId);
      return p ? { product_id: p.product_id, title: p.title, detail: p.detail, shop: p.shop, note: p.note, last_optimized_at: p.last_optimized_at ?? null } : null;
    },
    updateDetail: (productId: string, detail: string, meta?: { lastOptimizedAt?: string }): boolean => {
      const p = productRows.get(productId);
      if (!p) return false;
      p.detail = detail;
      if (meta?.lastOptimizedAt) p.last_optimized_at = meta.lastOptimizedAt;
      return true;
    },
  };
  const optimizationWorkerClient: OptimizationWorkerClientPort = options.optimizationWorkerClient ?? {
    propose: async (request: Record<string, unknown>) => ({ decisions: { applied_candidate: true, proposal: { product_id: request.product_id ?? "", detail: "<优化后详情>" } } }),
  };
  const optimization = new DesktopProductOptimizationService({
    jobs,
    workerJobClient,
    optimizationWorker: options.optimizationWorkerClient ?? optimizationWorkerClient,
    productRepository: options.productRepository ?? defaultProductRepository,
    eventSink: m10Sink,
  });

  // ---- M11 composition (legacy import) ----
  const importDialog: ImportDialogPort = options.importDialog ?? {
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
  };
  const importSessionStore = options.importSessionStore ?? new InMemoryImportSessionStore();
  const importMainWriter = options.importMainWriter ?? new InMemoryMainImportWriter();
  const importWorkerClient = options.importWorkerClient ?? {
    validateKnowledge: async () => ({ ok: true, errors: [], rows: 0 }),
    applyKnowledge: async () => ({ inserted: 0, skipped_duplicates: 0, candidates: 0, trust_map: {} }),
    verifyKnowledge: async () => ({ ok: true, counts: { knowledge: 0, candidates: 0 } }),
  };
  const importVerificationDeps: VerificationDeps = options.importVerificationDeps ?? {
    quickCheckOk: () => true,
    countRows: () => 0,
    countKnowledge: () => 0,
    countCandidates: () => 0,
    ragReady: async () => true,
    noPlaintextSecrets: () => true,
    noDanglingMounts: () => true,
  };
  const importBackup: DatabaseBackupPort = options.importBackup ?? { backup: () => ({ backup_id: "bk-fake", path: "" }) };
  const importRagRebuild = options.importRagRebuild ?? (async () => true);
  const legacyImportSelection = new LegacyImportSelectionService(importDialog);
  const legacyImportStatus = new LegacyImportStatusService();
  const legacyImport = new LegacyImportService({
    selectionService: legacyImportSelection,
    statusService: legacyImportStatus,
    sessionStore: importSessionStore,
    mainWriter: importMainWriter,
    workerClient: importWorkerClient,
    backup: importBackup,
    verificationDeps: importVerificationDeps,
    ragRebuild: importRagRebuild,
    eventSink: m10Sink,
  });

  void bumpRevision;
  return { orchestratorHost, shops, worker, projection, settings, revision: () => revision, eventBus, rawEvents, platform, coordinator, platformForShop, routingAdapter, platformFallback, platformStatusSink, clock, orchestrator, conversations: conversationRepository, messages: messageRepository, inboundReceipt, inboundTurns, inboundTurnFailures, deliveryAttempts: deliveryAttemptRepository, workspaceMerchant, stores: storeRepository, platformAccounts: platformAccountRepository, feedbackService, jobs, learning, review, audit, optimization, legacyImportSelection, legacyImport, legacyImportStatus };
}

/** Minimal in-memory import session store (isolated test mode). */
class InMemoryImportSessionStore implements ImportSessionStorePort {
  private readonly sessions = new Map<string, import("@fastwork/legacy-import").ImportSession>();
  create(session: import("@fastwork/legacy-import").ImportSession): void { this.sessions.set(session.session_id, { ...session, phases: [...session.phases] }); }
  get(sessionId: string): import("@fastwork/legacy-import").ImportSession | null { const s = this.sessions.get(sessionId); return s ? { ...s, phases: [...s.phases] } : null; }
  updateState(sessionId: string, state: string, phase?: string, error?: string | null): void {
    const s = this.sessions.get(sessionId); if (!s) return;
    s.state = state as never; if (phase && !s.phases.includes(phase as never)) s.phases.push(phase as never);
    if (error !== undefined) s.error = error;
    if (state === "COMPLETED") s.completed_at = new Date().toISOString();
  }
  appendPhase(sessionId: string, phase: string): void {
    const s = this.sessions.get(sessionId); if (!s) return;
    if (!s.phases.includes(phase as never)) s.phases.push(phase as never);
  }
  listRecent(): import("@fastwork/legacy-import").ImportSession[] { return [...this.sessions.values()]; }
}

/** Minimal in-memory Main import writer (isolated test mode). */
class InMemoryMainImportWriter implements MainImportWriterPort {
  async write(): Promise<import("@fastwork/legacy-import").MainWriteResult> { return { aggregate: "shops", inserted: 0, skipped: 0, replaced: 0 }; }
  hasIdentity(): boolean { return false; }
  foreignRefsValid(): boolean { return true; }
}


