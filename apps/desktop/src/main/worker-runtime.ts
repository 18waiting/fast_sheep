// PACK-003: production packaged-worker runtime path integration (clean-room).
// Resolves and launches the PACK-002 packaged AI Worker from Electron Main in
// packaged mode (<process.resourcesPath>\worker\fastwork-ai-worker.exe) through
// the existing @fastwork/worker-rpc stdio JSONL abstraction.
//
// Packaged mode never falls back to system Python, PYTHONPATH, the dev worker
// (py -3.12 -m fastwork_ai_worker) or the source tree: missing runtime artifacts
// fail loudly with the exact expected path.
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { AIWorkerClient } from "@fastwork/worker-rpc";
import { resolveDataRoot, openDatabase, SqliteFeedbackRepository, SqliteJobRepository, SqliteProductRepository, SqliteNormalizedConversationRepository, SqliteMessageRepository, SqliteDeliveryAttemptRepository, SqliteStoreRepository, SqlitePlatformAccountRepository, SqliteWorkspaceIdentityBootstrap, resolveOrBootstrapWorkspaceMerchantId } from "@fastwork/persistence";
import { WorkerAiEngineClient, type WorkerGenerateReplyResponse } from "@fastwork/orchestrator";
import { FeedbackService, PersistenceFeedbackRepository, WorkerKnowledgeFeedbackClient } from "@fastwork/feedback";
import { WorkerJobClient } from "@fastwork/background-jobs";
import { WorkerOptimizationClient, type ProductRepositoryPort } from "@fastwork/product-optimization";
import { createMainContext, type BootstrapOptions } from "./bootstrap.js";
import { createWorkspaceMerchantContext } from "./services/workspace-merchant-context.js";

/** Packaged worker executable file name (PACK-002 onedir runtime). */
export const PACKAGED_WORKER_EXE = "fastwork-ai-worker.exe";
/** Relative runtime directory under <process.resourcesPath>. */
export const PACKAGED_WORKER_REL_DIR = join("worker");
/** Relative contracts schemas directory under <process.resourcesPath>. */
export const PACKAGED_CONTRACTS_SCHEMAS_REL_DIR = join("contracts", "schemas");

export interface PackagedWorkerPaths {
  resourcesPath: string;
  executable: string;
  workerDir: string;
  schemasDir: string;
}

/**
 * Resolve the packaged-mode runtime contract for a given resources path.
 * Pure and injectable: Electron Main passes process.resourcesPath in a real
 * packaged app; the PACK-003 integration smoke passes a simulated <temp>\resources.
 * Missing artifacts throw with the exact expected path (fail loudly; no fallback).
 */
export function resolvePackagedWorkerPaths(resourcesPath: string): PackagedWorkerPaths {
  const executable = join(resourcesPath, PACKAGED_WORKER_REL_DIR, PACKAGED_WORKER_EXE);
  const schemasDir = join(resourcesPath, PACKAGED_CONTRACTS_SCHEMAS_REL_DIR);
  if (!existsSync(executable) || !statSync(executable).isFile()) {
    throw new Error(
      `Packaged AI Worker executable not found: ${executable}. ` +
      `Stage resources\\worker\\${PACKAGED_WORKER_EXE} into the release package; ` +
      `packaged mode never falls back to system Python or the dev worker.`,
    );
  }
  if (!existsSync(schemasDir) || !statSync(schemasDir).isDirectory()) {
    throw new Error(
      `Packaged contract schemas directory not found: ${schemasDir}. ` +
      `Stage resources\\contracts\\schemas into the release package; ` +
      `packaged mode never falls back to the source tree schema path.`,
    );
  }
  return { resourcesPath, executable, workerDir: dirname(executable), schemasDir };
}

/**
 * Create the production AIWorkerClient for a packaged Worker runtime.
 * Reuses the existing @fastwork/worker-rpc AIWorkerClient / WorkerProcess (stdio
 * JSONL v1, windowsHide, cancellation + restart semantics). The packaged EXE is
 * self-contained: args=[], cwd=<worker runtime dir>, no PYTHONPATH/PYTHONHOME.
 * FASTWORK_DATA_DIR + FASTWORK_CONTRACTS_SCHEMAS_DIR are both allowlisted by
 * WorkerProcess (WORKER_ENV_ALLOWLIST) and point to packaged/user paths.
 */
export function createPackagedWorkerClient(resourcesPath: string, dataRoot: string): AIWorkerClient {
  const paths = resolvePackagedWorkerPaths(resourcesPath);
  return new AIWorkerClient({
    spawn: {
      executable: paths.executable,
      args: [],
      cwd: paths.workerDir,
    },
    env: {
      FASTWORK_DATA_DIR: dataRoot,
      FASTWORK_CONTRACTS_SCHEMAS_DIR: paths.schemasDir,
    },
    startupTimeoutMs: 20000,
    requestTimeoutMs: 60000,
  });
}

/**
 * Resolve the data root for packaged mode using the project's existing strategy:
 * FASTWORK_DATA_DIR override, else %LOCALAPPDATA%\fast_sheep\data.
 * Never resources, Program Files, or the packaged Electron application archive.
 */
export function resolvePackagedDataRoot(): string {
  return resolveDataRoot();
}

export interface WorkerBackedMainDeps {
  /** Started worker RPC client (packaged EXE or dev/test source worker). */
  workerClient: AIWorkerClient;
  /** Shared data root used by Main persistence + worker (FASTWORK_DATA_DIR). */
  dataRoot: string;
}

/**
 * Compose the worker-backed Main context (shared by the production packaged
 * branch and the dev/test vertical branch). Mirrors the M7/M10 vertical
 * composition: WorkerAiEngineClient + FeedbackService + Sqlite job/product
 * repositories + WorkerJobClient + WorkerOptimizationClient.
 */
export function createWorkerBackedMainContext(deps: WorkerBackedMainDeps, options: BootstrapOptions = {}): ReturnType<typeof createMainContext> {
  const workerLike = {
    generateReply: (request: Record<string, unknown>) => {
      const message = typeof request.message === "string" ? request.message : (request.content as string | undefined) ?? "";
      return deps.workerClient.request("conversation.generate", {
        question: message,
        shop_id: typeof request.shopId === "string" ? request.shopId : undefined,
        correlation_id: typeof request.conversationId === "string" ? request.conversationId : undefined,
      }) as Promise<WorkerGenerateReplyResponse>;
    },
  };
  const feedbackService = new FeedbackService({
    repository: new PersistenceFeedbackRepository(new SqliteFeedbackRepository(openDatabase(deps.dataRoot).conn)),
    knowledgeClient: new WorkerKnowledgeFeedbackClient(deps.workerClient),
  });
  const m10Sqlite = openDatabase(deps.dataRoot);
  const jobRepository = new SqliteJobRepository(m10Sqlite.conn);
  // PR1: Conversation repository SHARES the production DB connection/lifecycle (DP-65);
  // no second openDatabase / second connection ownership for conversations.
  const conversationRepository = new SqliteNormalizedConversationRepository(m10Sqlite.conn);
  // SHEEP-063-PR1 (DP-90): Message repository SHARES the SAME production DB
  // connection/lifecycle (m10Sqlite.conn); no second openDatabase / second connection
  // ownership, and production persistence failure never falls back to memory (DP-66).
  const messageRepository = new SqliteMessageRepository(m10Sqlite.conn);
  // SHEEP-066-PR1 (DP-90-style shared lifecycle): durable Delivery Attempt journal SHARES
  // the production DB connection/lifecycle (m10Sqlite.conn). No second connection
  // ownership; NO delivery port is bound here (DP-129: production Send stays disabled
  // until a real platform delivery adapter satisfies the ack contract).
  const deliveryAttemptRepository = new SqliteDeliveryAttemptRepository(m10Sqlite.conn);
  const storeRepository = new SqliteStoreRepository(m10Sqlite.conn);
  const platformAccountRepository = new SqlitePlatformAccountRepository(m10Sqlite.conn);
  // SHEEP-063-PR2-PR1: resolve-or-bootstrap the trusted local workspace merchant
  // identity AFTER migrations complete and BEFORE Main services/IPC are ready
  // (never lazy-created on first Timeline query). Fails closed on dangling
  // pointer / ambiguous existing identity; never infers from ambient data.
  const workspaceMerchant = createWorkspaceMerchantContext(resolveOrBootstrapWorkspaceMerchantId(new SqliteWorkspaceIdentityBootstrap(m10Sqlite.conn)));
  const productSqlite = new SqliteProductRepository(m10Sqlite.conn);
  const productRepository: ProductRepositoryPort = {
    get: (id) => {
      const p = productSqlite.get(id);
      return p ? { product_id: p.product_id, title: p.title, detail: p.detail, shop: p.shop, note: p.note, last_optimized_at: p.last_optimized_at ?? null } : null;
    },
    updateDetail: (id, detail, meta) => productSqlite.updateDetail(id, detail, meta ? { lastOptimizedAt: meta.lastOptimizedAt } : undefined),
  };
  return createMainContext({
    ...options,
    // Worker-backed services always win over any BootstrapOptions overrides.
    aiEngineClient: new WorkerAiEngineClient(workerLike),
    feedbackService,
    jobRepository,
    workerJobClient: new WorkerJobClient(deps.workerClient),
    optimizationWorkerClient: new WorkerOptimizationClient(deps.workerClient),
    productRepository,
    conversationRepository,
    messageRepository,
    deliveryAttemptRepository,
    workspaceMerchant,
    storeRepository,
    platformAccountRepository,
  });
}



