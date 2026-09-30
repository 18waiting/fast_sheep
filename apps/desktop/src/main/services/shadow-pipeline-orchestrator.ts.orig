/**
 * Shadow Pipeline Orchestrator (SHEEP-309).
 *
 * Purpose: Orchestrate the complete SHADOW pipeline execution from InboundEnvelope
 * to ReplyPlan generation, with full audit trail and zero-send verification.
 *
 * Governance basis:
 * - Master §5: AI output must be structured and governed.
 * - REPLY_AND_ACTION_SAFETY: Deterministic policy evaluation before execution.
 * - SHEEP-309: SHADOW mode generates ReplyPlan but does not send.
 *
 * Key invariants:
 * - Orchestrator executes 11 steps in sequence.
 * - Each step is recorded in AuditLogger.
 * - TransportBlocker verifies zero sends at the end.
 * - Errors in any step are caught and recorded, but pipeline continues.
 * - Final result includes complete audit trail.
 *
 * Owner SHEEP-309 decisions:
 * D1: Orchestrator is a service class with injected dependencies.
 * D2: Each step is wrapped in try-catch to ensure pipeline continues on error.
 * D3: Step results are stored in memory for the duration of the run.
 * D4: Transport verification happens at the end, after all steps complete.
 */

import { randomUUID } from "node:crypto";
import type {
  InboundEnvelope,
  ContextEnvelope,
  ReplyPlan,
  PolicyDecision,
  PolicyConfig,
  IdentityResolution,
} from "@fastwork/domain";
import type { CanonicalInboundPersistence } from "./canonical-inbound-persistence.js";
import type {
  InboundTurnBuilder,
  InboundTurnIngestRequest,
  InboundTurn,
} from "./inbound-turn-builder.js";
import type {
  MinimalSceneClassifier,
  SceneClassification,
  SceneMessageFact,
} from "./minimal-scene-classifier.js";
import type {
  StoreKnowledgeRetrievalPort,
  StoreKnowledgeQueryParams,
} from "../ports/store-knowledge-retrieval-port.js";
import type { AuthoritativeFactsPort } from "../ports/authoritative-facts-port.js";
import type { ContextEnvelopeBuilder } from "./context-envelope-builder.js";
import type { WorkerJobClientPort } from "@fastwork/background-jobs";
import type { PolicyEngine } from "./policy-engine.js";
import type { AuditLogger } from "./audit-logger.js";
import type { TransportBlocker } from "./transport-blocker.js";

/**
 * Resolve an IdentityResolution<T> to its string value or null.
 * Works with branded string types (MerchantId, StoreId, etc.) and
 * object types with .value (RuntimeShopRef, CustomerExternalRef).
 */
function resolveId(resolution: IdentityResolution<unknown>): string | null {
  if (resolution.status === "RESOLVED") {
    const v = resolution.value;
    if (typeof v === "string") return v;
    if (v !== null && typeof v === "object" && "value" in v) {
      return String((v as { value: unknown }).value);
    }
    return String(v);
  }
  return null;
}

/**
 * Step execution result.
 */
export interface StepResult {
  readonly stepOrder: number;
  readonly stepName: string;
  readonly status: "SUCCESS" | "FAILED" | "SKIPPED";
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly inputSummary?: Record<string, unknown>;
  readonly outputSummary?: Record<string, unknown>;
  readonly errorDetail?: Record<string, unknown>;
}

/**
 * Shadow pipeline execution result.
 */
export interface ShadowPipelineResult {
  readonly runId: string;
  readonly status: "COMPLETED" | "FAILED";
  readonly steps: readonly StepResult[];
  readonly envelope?: ContextEnvelope;
  readonly replyPlan?: ReplyPlan;
  readonly policyDecision?: PolicyDecision;
  readonly transportVerification: {
    readonly allowed: boolean;
    readonly totalAttempts: number;
    readonly blockedAttempts: number;
    readonly successfulSends: number;
    readonly message: string;
  };
  readonly error?: Error;
}

/**
 * Shadow pipeline orchestrator dependencies.
 */
export interface ShadowPipelineOrchestratorDeps {
  readonly persistence: CanonicalInboundPersistence;
  readonly turnBuilder: InboundTurnBuilder;
  readonly sceneClassifier: MinimalSceneClassifier;
  readonly knowledgePort: StoreKnowledgeRetrievalPort;
  readonly factsPort: AuthoritativeFactsPort;
  readonly envelopeBuilder: ContextEnvelopeBuilder;
  readonly workerClient: WorkerJobClientPort;
  readonly policyEngine: PolicyEngine;
  readonly policyConfig: PolicyConfig;
  readonly auditLogger: AuditLogger;
  readonly transportBlocker: TransportBlocker;
}

/**
 * Shadow Pipeline Orchestrator.
 *
 * Orchestrates the complete SHADOW pipeline execution from InboundEnvelope
 * to ReplyPlan generation, with full audit trail and zero-send verification.
 *
 * Usage:
 * ```typescript
 * const orchestrator = new ShadowPipelineOrchestrator(deps);
 * const result = await orchestrator.execute(inboundEnvelope, "shop-1", "merchant-1");
 *
 * if (result.status === "COMPLETED") {
 *   console.log("Pipeline completed successfully");
 *   console.log("ReplyPlan:", result.replyPlan);
 *   console.log("Transport verification:", result.transportVerification);
 * } else {
 *   console.error("Pipeline failed:", result.error);
 * }
 * ```
 */
export class ShadowPipelineOrchestrator {
  constructor(private readonly deps: ShadowPipelineOrchestratorDeps) {}

  /**
   * Execute the complete SHADOW pipeline.
   *
   * Steps:
   * 1. IDENTITY_LOCK - Validate IdentityLock
   * 2. PERSISTENCE - Persist normalized inbound message
   * 3. TURN_BUILD - Aggregate messages into AI Turn
   * 4. SCENE_CLASSIFY - Classify scene
   * 5. KNOWLEDGE_RETRIEVAL - Retrieve knowledge
   * 6. ENVELOPE_BUILD - Build ContextEnvelope
   * 7. REPLY_PLAN - Generate ReplyPlan via RPC
   * 8. POLICY_EVAL - Evaluate policy
   * 9. AUDIT_PERSIST - Confirm audit persistence
   * 10. TRANSPORT_VERIFY - Verify zero transport calls
   * 11. RUN_COMPLETE - Mark run completed
   *
   * @param envelope - InboundEnvelope from platform adapter
   * @param shopId - Controlled shop ID
   * @param merchantId - Merchant ID
   * @returns ShadowPipelineResult with complete audit trail
   */
  async execute(
    envelope: InboundEnvelope,
    shopId: string,
    merchantId: string
  ): Promise<ShadowPipelineResult> {
    const runId = randomUUID();
    const steps: StepResult[] = [];
    let pipelineError: Error | undefined;
    let contextEnvelope: ContextEnvelope | undefined;
    let replyPlan: ReplyPlan | undefined;
    let policyDecision: PolicyDecision | undefined;
    let sceneClassification: SceneClassification | undefined;

    // Reset transport blocker at start of run
    this.deps.transportBlocker.reset();

    // Start audit run
    await this.deps.auditLogger.startRun(shopId, merchantId);

    try {
      // Step 1: IDENTITY_LOCK — Validate IdentityLock
      const lock = envelope.identityLock;
      const merchantResolved = resolveId(lock.merchantId);
      const storeResolved = resolveId(lock.storeId);
      const platformAccountResolved = resolveId(lock.platformAccountId);
      const conversationResolved = resolveId(lock.internalConversationId);

      const step1 = await this.executeStep(
        runId,
        1,
        "IDENTITY_LOCK",
        async () => {
          const identityValid =
            merchantResolved !== null &&
            storeResolved !== null &&
            platformAccountResolved !== null;

          if (!identityValid) {
            return {
              valid: false,
              reason: "Identity lock incomplete: merchant/store/platformAccount required",
              platform: lock.platform,
              merchantId: merchantResolved,
              storeId: storeResolved,
              platformAccountId: platformAccountResolved,
              conversationId: conversationResolved,
            };
          }

          return {
            valid: true,
            platform: lock.platform,
            merchantId: merchantResolved,
            storeId: storeResolved,
            platformAccountId: platformAccountResolved,
            conversationId: conversationResolved,
          };
        },
        { envelope_source: "InboundEnvelope" }
      );
      steps.push(step1);

      // Step 2: PERSISTENCE — Persist normalized inbound message
      const step2 = await this.executeStep(
        runId,
        2,
        "PERSISTENCE",
        async () => {
          const result = this.deps.persistence.ingest(envelope);
          return {
            status: result.status,
            conversationId: result.conversationId,
            messageId: result.messageId,
          };
        },
        { envelope_source: "InboundEnvelope" }
      );
      steps.push(step2);

      // Extract persistence receipt for turn building
      const persistenceOutput = step2.outputSummary;
      const receiptStatus = (persistenceOutput?.["status"] as string) ?? "INGESTED";
      const conversationId = (persistenceOutput?.["conversationId"] as string) ?? "";
      const messageId = (persistenceOutput?.["messageId"] as string) ?? "";

      if (receiptStatus === "DUPLICATE") {
        // Duplicate message — skip remaining pipeline
        await this.deps.auditLogger.completeRun(runId, {
          totalMessages: 0,
          transportSendCalls: 0,
        });
        return {
          runId,
          status: "COMPLETED",
          steps,
          transportVerification: this.deps.transportBlocker.verifyZeroSends(),
        };
      }

      // Step 3: TURN_BUILD — Aggregate messages into AI Turn
      const merchantStr = merchantResolved ?? "";
      const storeStr = storeResolved ?? "";
      const platformAccountStr = platformAccountResolved ?? "";
      const customerStr = resolveId(lock.platformCustomerId);

      const ingestRequest: InboundTurnIngestRequest = {
        receipt: {
          status: "INGESTED",
          conversationId,
          messageId,
        },
        platform: lock.platform,
        scope: {
          merchantId: merchantStr,
          storeId: storeStr,
          platformAccountId: platformAccountStr,
        },
        customerId: customerStr,
        observedAt: envelope.sourceOccurredAt,
        actor: null, // InboundEnvelope does not carry actor directly
        contentKind: envelope.sourceContent.kind,
        contentText: envelope.sourceContent.text,
      };

      const step3 = await this.executeStep(
        runId,
        3,
        "TURN_BUILD",
        async () => {
          const outcome = this.deps.turnBuilder.ingest(ingestRequest);
          // Poll for expired turns
          const emittedTurns = this.deps.turnBuilder.poll();
          const turn = emittedTurns.length > 0 ? emittedTurns[emittedTurns.length - 1] : null;

          return {
            outcome_status: outcome.status,
            outcome_reason: outcome.reason,
            windowSize: outcome.windowSize,
            turn_emitted: turn !== null,
            turn_id: turn?.turn_id ?? null,
            source_message_ids: turn?.source_message_ids ?? [],
          };
        },
        { message_id: messageId, conversation_id: conversationId }
      );
      steps.push(step3);

      // Get the turn for subsequent steps
      const turnOutput = step3.outputSummary;
      const turnId = (turnOutput?.["turn_id"] as string | null) ?? null;
      const emittedTurns = this.deps.turnBuilder.turns();
      const currentTurn: InboundTurn | null = turnId
        ? emittedTurns.find((t) => t.turn_id === turnId) ?? emittedTurns[emittedTurns.length - 1] ?? null
        : emittedTurns.length > 0
          ? emittedTurns[emittedTurns.length - 1]
          : null;

      if (!currentTurn) {
        // No turn available — cannot continue
        await this.deps.auditLogger.completeRun(runId, {
          totalMessages: 0,
          transportSendCalls: 0,
        });
        return {
          runId,
          status: "COMPLETED",
          steps,
          transportVerification: this.deps.transportBlocker.verifyZeroSends(),
        };
      }

      // Build message facts for scene classification
      const messageFacts: SceneMessageFact[] = currentTurn.source_message_ids.map((id) => ({
        messageId: id,
        contentText: id === messageId ? envelope.sourceContent.text : null,
      }));

      // Step 4: SCENE_CLASSIFY — Classify scene
      const step4 = await this.executeStep(
        runId,
        4,
        "SCENE_CLASSIFY",
        async () => {
          sceneClassification = this.deps.sceneClassifier.classify({
            turn: currentTurn,
            messages: messageFacts,
          });
          return {
            contract: sceneClassification.contract,
            scene: sceneClassification.scene,
            turn_id: sceneClassification.turn_id,
            ruleId: sceneClassification.ruleId,
            reason: sceneClassification.reason,
            decidedBy: sceneClassification.decidedBy,
            automaticProcessingEligible: sceneClassification.automaticProcessingEligible,
            diagnostics: sceneClassification.diagnostics,
          };
        },
        { turn_id: currentTurn.turn_id, message_count: messageFacts.length }
      );
      steps.push(step4);

      // Step 5: KNOWLEDGE_RETRIEVAL — Retrieve knowledge
      const step5 = await this.executeStep(
        runId,
        5,
        "KNOWLEDGE_RETRIEVAL",
        async () => {
          const queryParams: StoreKnowledgeQueryParams = {
            merchant_id: currentTurn.identity_lock.merchantId,
            store_id: currentTurn.identity_lock.storeId,
            keywords: this.extractKeywords(envelope.sourceContent.text),
            status: "ACTIVE",
            limit: 20,
          };
          const result = await this.deps.knowledgePort.query(queryParams);
          return {
            ok: result.ok,
            entry_count: result.ok ? result.entries.length : 0,
            query_keywords: queryParams.keywords,
          };
        },
        {
          merchant_id: currentTurn.identity_lock.merchantId,
          store_id: currentTurn.identity_lock.storeId,
          scene: sceneClassification?.scene ?? "UNKNOWN",
        }
      );
      steps.push(step5);

      // Step 6: ENVELOPE_BUILD — Build ContextEnvelope
      const step6 = await this.executeStep(
        runId,
        6,
        "ENVELOPE_BUILD",
        async () => {
          contextEnvelope = await this.deps.envelopeBuilder.build({
            turn: currentTurn,
            messageFacts,
          });
          return {
            envelope_id: contextEnvelope.envelope_id,
            conversation_id: contextEnvelope.conversation_id,
            scene: contextEnvelope.scene,
            identity_lock_merchant_id: contextEnvelope.identity_lock.merchant_id,
            identity_lock_store_id: contextEnvelope.identity_lock.store_id,
            has_authoritative_facts: contextEnvelope.authoritative_facts !== undefined,
            has_retrieved_knowledge:
              contextEnvelope.retrieved_knowledge !== undefined &&
              contextEnvelope.retrieved_knowledge.length > 0,
            explicit_unknowns_count: contextEnvelope.explicit_unknowns?.length ?? 0,
          };
        },
        { turn_id: currentTurn.turn_id }
      );
      steps.push(step6);

      if (!contextEnvelope) {
        throw new Error("ContextEnvelope was not built in step 6");
      }

      // Step 7: REPLY_PLAN — Generate ReplyPlan via RPC
      const step7 = await this.executeStep(
        runId,
        7,
        "REPLY_PLAN",
        async () => {
          const rpcResult = await this.deps.workerClient.run(
            "conversation.generate_v2",
            {
              envelope: contextEnvelope,
              mode: "SHADOW",
            }
          );
          // The RPC result should contain a ReplyPlan
          replyPlan = rpcResult as unknown as ReplyPlan;
          return {
            plan_id: replyPlan?.plan_id ?? null,
            envelope_ref: replyPlan?.envelope_ref ?? null,
            scene: replyPlan?.scene ?? null,
            has_reply_content: replyPlan?.reply_content !== undefined,
            fact_references_count: replyPlan?.fact_references?.length ?? 0,
          };
        },
        { envelope_id: contextEnvelope.envelope_id }
      );
      steps.push(step7);

      // Step 8: POLICY_EVAL — Evaluate policy
      const step8 = await this.executeStep(
        runId,
        8,
        "POLICY_EVAL",
        async () => {
          if (!replyPlan) {
            return {
              evaluated: false,
              reason: "No ReplyPlan available for policy evaluation",
            };
          }
          policyDecision = await this.deps.policyEngine.evaluate(
            contextEnvelope!,
            replyPlan,
            this.deps.policyConfig
          );
          return {
            evaluated: true,
            allowed: policyDecision.allowed,
            rollout_mode: policyDecision.rollout_mode,
            requires_confirmation: policyDecision.requires_confirmation,
            reasons_count: policyDecision.reasons.length,
            warnings_count: policyDecision.warnings.length,
            blocking_issues_count: policyDecision.blocking_issues.length,
          };
        },
        { envelope_id: contextEnvelope.envelope_id, plan_id: replyPlan?.plan_id ?? null }
      );
      steps.push(step8);

      // Step 9: AUDIT_PERSIST — Confirm audit persistence completeness
      const step9 = await this.executeStep(
        runId,
        9,
        "AUDIT_PERSIST",
        async () => {
          const run = await this.deps.auditLogger.getRun(runId);
          const stepsRecorded = await this.deps.auditLogger.getSteps(runId);
          return {
            run_exists: run !== null,
            steps_recorded: stepsRecorded.length,
          };
        },
        { run_id: runId }
      );
      steps.push(step9);

      // Step 10: TRANSPORT_VERIFY — Verify zero transport calls
      const step10 = await this.executeStep(
        runId,
        10,
        "TRANSPORT_VERIFY",
        async () => {
          const verification = this.deps.transportBlocker.verifyZeroSends();
          if (verification.successfulSends !== 0) {
            throw new Error(`Transport safety violation: ${verification.message}`);
          }
          return {
            allowed: verification.allowed,
            totalAttempts: verification.totalAttempts,
            blockedAttempts: verification.blockedAttempts,
            successfulSends: verification.successfulSends,
            message: verification.message,
          };
        },
        { run_id: runId }
      );
      steps.push(step10);

      // Step 11: RUN_COMPLETE — Mark run completed
      const step11 = await this.executeStep(
        runId,
        11,
        "RUN_COMPLETE",
        async () => {
          await this.deps.auditLogger.completeRun(runId, {
            totalMessages: 1,
            transportSendCalls: 0,
          });
          return {
            run_completed: true,
            total_messages: 1,
            transport_send_calls: 0,
          };
        },
        { run_id: runId }
      );
      steps.push(step11);

      return {
        runId,
        status: "COMPLETED",
        steps,
        envelope: contextEnvelope,
        replyPlan,
        policyDecision,
        transportVerification: this.deps.transportBlocker.verifyZeroSends(),
      };
    } catch (error) {
      pipelineError = error instanceof Error ? error : new Error(String(error));

      // Fail audit run
      await this.deps.auditLogger.failRun(runId, pipelineError);

      return {
        runId,
        status: "FAILED",
        steps,
        envelope: contextEnvelope,
        replyPlan,
        policyDecision,
        transportVerification: this.deps.transportBlocker.verifyZeroSends(),
        error: pipelineError,
      };
    }
  }

  /**
   * Execute a single pipeline step with audit recording.
   *
   * @param runId - Audit run ID
   * @param stepOrder - Step sequence number (1-11)
   * @param stepName - Step identifier
   * @param fn - Step execution function
   * @param inputSummary - Input summary for audit
   * @returns StepResult with execution details
   */
  private async executeStep(
    runId: string,
    stepOrder: number,
    stepName: string,
    fn: () => Promise<Record<string, unknown>>,
    inputSummary?: Record<string, unknown>
  ): Promise<StepResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    try {
      const output = await fn();
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;

      // Record successful step (AuditLogger.recordStep takes runId + Omit<AuditStep, "id" | "runId">)
      await this.deps.auditLogger.recordStep(runId, {
        stepOrder,
        stepName,
        status: "SUCCESS",
        startedAt,
        completedAt,
        inputSummary,
        outputSummary: output,
        durationMs,
      });

      return {
        stepOrder,
        stepName,
        status: "SUCCESS",
        startedAt,
        completedAt,
        durationMs,
        inputSummary,
        outputSummary: output,
      };
    } catch (error) {
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;
      const errorDetail = {
        name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };

      // Record failed step
      await this.deps.auditLogger.recordStep(runId, {
        stepOrder,
        stepName,
        status: "FAILED",
        startedAt,
        completedAt,
        inputSummary,
        errorDetail,
        durationMs,
      });

      return {
        stepOrder,
        stepName,
        status: "FAILED",
        startedAt,
        completedAt,
        durationMs,
        inputSummary,
        errorDetail,
      };
    }
  }

  /**
   * Extract keywords from text for knowledge retrieval.
   *
   * Simple implementation: split by whitespace and filter short words.
   * Future: Use NLP-based keyword extraction.
   *
   * @param text - Input text
   * @returns Array of keywords
   */
  private extractKeywords(text: string): string[] {
    return text
      .split(/\s+/)
      .filter((word) => word.length >= 2)
      .slice(0, 10); // Limit to 10 keywords
  }
}
