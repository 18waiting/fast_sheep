/**
 * ReplyPlan Verification Integration (SHEEP-306, P2-8e).
 *
 * Purpose: Integrate ReplyPlanVerifier with ContextEnvelopeBuilder in shadow mode.
 * Allows verification to run alongside existing AI reply flow without blocking.
 *
 * Governance basis:
 * - DEC-SHEEP-306: ReplyPlan verification is structural, not optional.
 * - Evolution path: Format A → Format C (parallel existence during transition).
 * - MVP: Verifier runs in shadow mode for diagnostics and validation.
 *
 * Key invariants:
 * - Integration is optional (Verifier not injected = no verification).
 * - Shadow mode never blocks the main AI reply flow.
 * - Verification failures are logged but do not affect AI reply generation.
 * - Integration emits events for diagnostics and monitoring.
 * - Uses Mock ReplyPlan (Worker does not yet generate ReplyPlan).
 *
 * Owner SHEEP-306 decisions:
 * D1: Verification integration is separate from Builder integration (P1-6f).
 * D2: MVP uses Mock ReplyPlan (future: Worker generates ReplyPlan).
 * D3: Verification events are emitted for future monitoring.
 */

import { randomUUID } from "node:crypto";
import type { ContextEnvelope, ReplyPlan, AuthoritativeFacts } from "@fastwork/domain";
import type { ContextEnvelopeBuilder, ContextEnvelopeBuildInput } from "./context-envelope-builder.js";
import type { ReplyPlanVerifierPort } from "../ports/reply-plan-verifier-port.js";

/**
 * Integration options for ReplyPlan verification shadow mode.
 */
export interface ReplyPlanVerificationIntegrationOptions {
  /** Optional Builder instance. If not provided, verification is disabled. */
  readonly builder?: ContextEnvelopeBuilder;
  
  /** Optional Verifier instance. If not provided, verification is disabled. */
  readonly verifier?: ReplyPlanVerifierPort;
  
  /** Event emitter for diagnostics (optional). */
  readonly eventSink?: (event: string, payload: Record<string, unknown>) => void;
  
  /** Logger for errors (optional). */
  readonly errorLogger?: (error: unknown, context: string) => void;
}

/**
 * ReplyPlan Verification Integration Manager.
 *
 * Manages shadow-mode execution of ContextEnvelopeBuilder + ReplyPlanVerifier.
 * This is a transitional component for the Format A → C migration.
 *
 * Usage in Main process:
 * ```typescript
 * const integration = new ReplyPlanVerificationIntegration({
 *   builder: contextEnvelopeBuilder,
 *   verifier: replyPlanVerifier,
 *   eventSink: (event, payload) => eventBus.emit(event, payload),
 *   errorLogger: (error, context) => console.error(`[ReplyPlan] ${context}:`, error),
 * });
 *
 * // In onBuyerMessage or similar handler:
 * integration.runShadowMode({
 *   turn: inboundTurn,
 *   messageFacts: sceneMessageFacts,
 *   productId: extractedProductId,
 * });
 * ```
 */
export class ReplyPlanVerificationIntegration {
  private readonly builder?: ContextEnvelopeBuilder;
  private readonly verifier?: ReplyPlanVerifierPort;
  private readonly eventSink?: (event: string, payload: Record<string, unknown>) => void;
  private readonly errorLogger?: (error: unknown, context: string) => void;
  
  /** Cache of AuthoritativeFacts by envelope_ref (for Verifier). */
  private readonly factsCache = new Map<string, AuthoritativeFacts>();

  constructor(options: ReplyPlanVerificationIntegrationOptions) {
    this.builder = options.builder;
    this.verifier = options.verifier;
    this.eventSink = options.eventSink;
    this.errorLogger = options.errorLogger;
  }

  /**
   * Run Builder + Verifier in shadow mode (fire-and-forget).
   *
   * This method:
   * - Returns immediately (no await, no blocking).
   * - Runs Builder + Verifier in background.
   * - Emits events on success/failure.
   * - Never throws (errors are logged).
   *
   * @param input - Builder input (turn, messageFacts, productId)
   */
  runShadowMode(input: ContextEnvelopeBuildInput): void {
    // If no Builder or Verifier is injected, verification is disabled
    if (!this.builder || !this.verifier) {
      return;
    }

    // Fire-and-forget: do not await, do not block
    this.buildAndVerifyAsync(input).catch((error) => {
      // Log error but do not propagate
      if (this.errorLogger) {
        this.errorLogger(error, "shadow_mode_build_and_verify");
      } else {
        console.error("[ReplyPlan] Shadow mode build+verify failed:", error);
      }
    });
  }

  /**
   * Internal async build+verify method.
   */
  private async buildAndVerifyAsync(input: ContextEnvelopeBuildInput): Promise<void> {
    if (!this.builder || !this.verifier) {
      return;
    }

    try {
      // Step 1: Build ContextEnvelope
      const envelope = await this.builder.build(input);

      // Cache facts for Verifier
      if (envelope.authoritative_facts) {
        this.factsCache.set(envelope.envelope_id, envelope.authoritative_facts);
      }

      // Emit Builder success event
      if (this.eventSink) {
        this.eventSink("ContextEnvelopeBuilt", {
          envelope_id: envelope.envelope_id,
          conversation_id: envelope.conversation_id,
          scene: envelope.scene,
          has_blocking_unknowns: envelope.explicit_unknowns?.some((u) => u.blocking) ?? false,
          knowledge_count: envelope.retrieved_knowledge?.length ?? 0,
          created_at: envelope.created_at,
        });
      }

      // Step 2: Create Mock ReplyPlan (future: from Worker)
      const mockPlan = this.createMockReplyPlan(envelope);

      // Step 3: Verify ReplyPlan
      const result = await this.verifier.verify(mockPlan);

      // Step 4: Emit verification events
      if (result.ok) {
        if (this.eventSink) {
          this.eventSink("ReplyPlanVerified", {
            plan_id: result.plan_id,
            envelope_ref: envelope.envelope_id,
            verified_at: result.verified_at,
            warning_count: result.warnings.length,
          });
        }
      } else {
        if (this.eventSink) {
          this.eventSink("ReplyPlanVerificationFailed", {
            plan_id: result.plan_id,
            envelope_ref: envelope.envelope_id,
            error_count: result.errors.length,
            errors: result.errors.map((e) => ({
              error_id: e.error_id,
              category: e.category,
              message: e.message,
            })),
            verified_at: result.verified_at,
          });
        }
      }

      // Clean up facts cache (optional, could keep for debugging)
      // this.factsCache.delete(envelope.envelope_id);
    } catch (error) {
      // Emit failure event
      if (this.eventSink) {
        this.eventSink("ReplyPlanBuildOrVerifyFailed", {
          conversation_id: input.turn.identity_lock.conversationId,
          turn_id: input.turn.turn_id,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Re-throw for the outer catch to log
      throw error;
    }
  }

  /**
   * Create a Mock ReplyPlan from ContextEnvelope.
   *
   * MVP: Worker does not yet generate ReplyPlan, so we create a mock for testing.
   * Future: Worker will generate ReplyPlan, and this method will be removed.
   *
   * @param envelope - The ContextEnvelope to create a ReplyPlan for
   * @returns Mock ReplyPlan
   */
  private createMockReplyPlan(envelope: ContextEnvelope): ReplyPlan {
    return {
      plan_id: randomUUID(),
      envelope_ref: envelope.envelope_id,
      identity_lock: envelope.identity_lock,
      scene: envelope.scene,
      trigger_message: envelope.trigger_message,
      reply_content: {
        text: "[Mock ReplyPlan] This is a test reply.",
        language: "zh-CN",
      },
      fact_references: [], // MVP: no fact references
      knowledge_references: envelope.retrieved_knowledge?.map((k) => ({
        knowledge_id: k.knowledge_id,
        knowledge_type: k.knowledge_type,
        store_knowledge_type: k.store_knowledge_type,
        title: k.title,
        content_snapshot: k.content.substring(0, 100), // First 100 chars
        relevance_score: k.relevance_score,
      })) ?? [],
      verification_requirements: {
        identity_lock_valid: true,
        facts_validated: true,
      },
      unknowns: envelope.explicit_unknowns?.map((u) => ({
        unknown_id: u.unknown_id,
        category: "missing_fact" as const, // Simplified mapping
        description: u.description,
        blocking: u.blocking,
      })),
      created_at: envelope.created_at,
    };
  }

  /**
   * Check if verification shadow mode is enabled.
   */
  isEnabled(): boolean {
    return this.builder !== undefined && this.verifier !== undefined;
  }
}

/**
 * Factory function for creating a ReplyPlanVerificationIntegration.
 *
 * @param options - Integration options
 * @returns A new ReplyPlanVerificationIntegration instance
 */
export function createReplyPlanVerificationIntegration(
  options: ReplyPlanVerificationIntegrationOptions,
): ReplyPlanVerificationIntegration {
  return new ReplyPlanVerificationIntegration(options);
}
