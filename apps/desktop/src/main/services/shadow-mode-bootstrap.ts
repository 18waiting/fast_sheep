/**
 * SHADOW Mode Bootstrap (SHEEP-309).
 *
 * Purpose: Initialize the ShadowPipelineOrchestrator with all dependencies.
 * Provides a single entry point for SHADOW mode setup in worker-runtime.
 *
 * Governance basis:
 * - Master §5: AI output must be structured and governed.
 * - REPLY_AND_ACTION_SAFETY: SHADOW mode must not call transport.
 * - SHEEP-309: Complete audit trail with zero-send verification.
 *
 * Key invariants:
 * - Bootstrap creates all SHADOW-specific components.
 * - All dependencies are injected from existing worker-runtime context.
 * - SHADOW mode is additive — existing inbound flow is not modified.
 * - Bootstrap is idempotent (can be called multiple times safely).
 *
 * Owner SHEEP-309 decisions:
 * D1: Bootstrap is a separate module to keep worker-runtime clean.
 * D2: Uses existing m10Sqlite.conn for AuditLogger (shared lifecycle).
 * D3: PolicyConfig defaults to SHADOW mode.
 */

import type { AIWorkerClient } from "@fastwork/worker-rpc";
import type { SqliteConnection } from "@fastwork/persistence";
import {
  WorkerJobClient,
  type WorkerJobClientPort,
} from "@fastwork/background-jobs";
import { createSimplePolicyConfig } from "@fastwork/domain";
import type {
  NormalizedConversationRepository,
  MessageRepository,
} from "@fastwork/persistence";

import { AuditLogger } from "./audit-logger.js";
import { TransportBlocker } from "./transport-blocker.js";
import { AuditReportGenerator } from "./audit-report-generator.js";
import {
  ShadowPipelineOrchestrator,
  type ShadowPipelineOrchestratorDeps,
} from "./shadow-pipeline-orchestrator.js";
import {
  createCanonicalInboundPersistence,
  type CanonicalInboundPersistence,
} from "./canonical-inbound-persistence.js";
import {
  createInboundTurnBuilder,
  type InboundTurnBuilder,
} from "./inbound-turn-builder.js";
import {
  createMinimalSceneClassifier,
  type MinimalSceneClassifier,
} from "./minimal-scene-classifier.js";
import {
  createContextEnvelopeBuilder,
  type ContextEnvelopeBuilder,
} from "./context-envelope-builder.js";
import { createPolicyEngine, type PolicyEngine } from "./policy-engine.js";
import { createRpcStoreKnowledgeRetrievalAdapter } from "../adapters/rpc-store-knowledge-retrieval.js";
import type { StoreKnowledgeRetrievalPort } from "../ports/store-knowledge-retrieval-port.js";
import { createStubAuthoritativeFactsProvider } from "../adapters/stub-authoritative-facts.js";
import type { AuthoritativeFactsPort } from "../ports/authoritative-facts-port.js";

/**
 * SHADOW mode bootstrap dependencies.
 * These come from the existing worker-runtime context.
 */
export interface ShadowBootstrapDeps {
  /** Shared SQLite connection (m10Sqlite.conn lifecycle). */
  readonly conn: SqliteConnection;
  /** Worker RPC client for AI calls. */
  readonly workerClient: AIWorkerClient;
  /** Normalized conversation repository. */
  readonly conversationRepository: NormalizedConversationRepository;
  /** Message repository. */
  readonly messageRepository: MessageRepository;
}

/**
 * SHADOW mode components created by bootstrap.
 */
export interface ShadowModeComponents {
  readonly orchestrator: ShadowPipelineOrchestrator;
  readonly auditLogger: AuditLogger;
  readonly transportBlocker: TransportBlocker;
  readonly reportGenerator: AuditReportGenerator;
  readonly turnBuilder: InboundTurnBuilder;
  readonly sceneClassifier: MinimalSceneClassifier;
  readonly knowledgePort: StoreKnowledgeRetrievalPort;
  readonly factsPort: AuthoritativeFactsPort;
  readonly envelopeBuilder: ContextEnvelopeBuilder;
  readonly policyEngine: PolicyEngine;
  readonly persistence: CanonicalInboundPersistence;
  readonly workerJobClient: WorkerJobClientPort;
}

/**
 * Bootstrap SHADOW mode components.
 *
 * Creates and wires all SHADOW-specific components using existing
 * worker-runtime dependencies. The orchestrator is ready to execute
 * the full SHADOW pipeline on InboundEnvelope.
 *
 * @param deps - Existing worker-runtime dependencies
 * @returns ShadowModeComponents with orchestrator and all sub-components
 *
 * Usage:
 * ```typescript
 * const shadow = bootstrapShadowMode({
 *   conn: m10Sqlite.conn,
 *   workerClient: deps.workerClient,
 *   conversationRepository,
 *   messageRepository,
 * });
 *
 * // Execute SHADOW pipeline on an inbound envelope
 * const result = await shadow.orchestrator.execute(envelope, shopId, merchantId);
 *
 * // Generate audit report
 * const report = await shadow.reportGenerator.generateMarkdownReport(result.runId);
 * ```
 */
export function bootstrapShadowMode(deps: ShadowBootstrapDeps): ShadowModeComponents {
  // Core SHADOW components
  const auditLogger = new AuditLogger(deps.conn);
  const transportBlocker = new TransportBlocker();
  const reportGenerator = new AuditReportGenerator(auditLogger);

  // Worker job client (wraps AIWorkerClient for WorkerJobClientPort)
  const workerJobClient: WorkerJobClientPort = new WorkerJobClient(deps.workerClient);

  // Persistence (SHEEP-300)
  const persistence = createCanonicalInboundPersistence({
    conversations: deps.conversationRepository,
    messages: deps.messageRepository,
  });

  // Turn builder (SHEEP-301)
  const turnBuilder = createInboundTurnBuilder({
    enabled: true,
    quietWindowMs: 500, // 500ms quiet window for turn aggregation
  });

  // Scene classifier (SHEEP-304)
  const sceneClassifier = createMinimalSceneClassifier();

  // Knowledge retrieval (SHEEP-305)
  const knowledgePort = createRpcStoreKnowledgeRetrievalAdapter(deps.workerClient);

  // Authoritative facts (SHEEP-306)
  const factsPort = createStubAuthoritativeFactsProvider();

  // Policy engine (SHEEP-308)
  const policyEngine = createPolicyEngine();

  // Context envelope builder (SHEEP-306)
  const envelopeBuilder = createContextEnvelopeBuilder({
    sceneClassifier,
    factsPort,
    knowledgePort,
    policyEngine,
    policyConfig: createSimplePolicyConfig("SHADOW"),
  });

  // Policy config for SHADOW mode
  const policyConfig = createSimplePolicyConfig("SHADOW");

  // Orchestrator dependencies
  const orchestratorDeps: ShadowPipelineOrchestratorDeps = {
    persistence,
    turnBuilder,
    sceneClassifier,
    knowledgePort,
    factsPort,
    envelopeBuilder,
    workerClient: workerJobClient,
    policyEngine,
    policyConfig,
    auditLogger,
    transportBlocker,
  };

  // Create orchestrator
  const orchestrator = new ShadowPipelineOrchestrator(orchestratorDeps);

  return {
    orchestrator,
    auditLogger,
    transportBlocker,
    reportGenerator,
    turnBuilder,
    sceneClassifier,
    knowledgePort,
    factsPort,
    envelopeBuilder,
    policyEngine,
    persistence,
    workerJobClient,
  };
}
