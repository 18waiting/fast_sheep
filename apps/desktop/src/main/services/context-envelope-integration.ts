/**
 * ContextEnvelope Integration Point (SHEEP-306, P1-6f).
 *
 * Purpose: Provide a shadow-mode integration point for ContextEnvelopeBuilder
 * in the Main process. This allows the Builder to run alongside the existing
 * AI reply flow without blocking or replacing it.
 *
 * Governance basis:
 * - DEC-SHEEP-306: ContextEnvelope is the future AI input format (Format C).
 * - Evolution path: Format A → Format C (parallel existence during transition).
 * - MVP: Builder runs in shadow mode for diagnostics and validation.
 *
 * Key invariants:
 * - Integration is optional (Builder not injected = no shadow call).
 * - Shadow mode never blocks the main AI reply flow.
 * - Builder failures are logged but do not affect AI reply generation.
 * - Integration emits events for diagnostics and monitoring.
 *
 * Owner SHEEP-306 decisions:
 * D1: Integration is in Main process (not Orchestrator package) to avoid circular deps.
 * D2: Shadow mode is fire-and-forget (no await, no blocking).
 * D3: Integration emits events for future monitoring and debugging.
 *
 * Architecture note:
 * The Orchestrator package (packages/orchestrator) cannot depend on apps/desktop.
 * Therefore, the Builder integration happens in the Main process, where both
 * the Orchestrator and the Builder are available.
 *
 * Future work (Phase 3):
 * - Worker accepts ContextEnvelope as input (Format C).
 * - Builder output is sent to Worker instead of Format A.
 * - Verifier validates ReplyPlan before send.
 */

import type { ContextEnvelopeBuilder, ContextEnvelopeBuildInput } from "./context-envelope-builder.js";
import type { InboundTurn } from "./inbound-turn-builder.js";
import type { SceneMessageFact } from "./minimal-scene-classifier.js";

/**
 * Integration options for ContextEnvelope shadow mode.
 */
export interface ContextEnvelopeIntegrationOptions {
  /** Optional Builder instance. If not provided, shadow mode is disabled. */
  readonly builder?: ContextEnvelopeBuilder;
  
  /** Event emitter for diagnostics (optional). */
  readonly eventSink?: (event: string, payload: Record<string, unknown>) => void;
  
  /** Logger for errors (optional). */
  readonly errorLogger?: (error: unknown, context: string) => void;
}

/**
 * ContextEnvelope Integration Manager.
 *
 * Manages shadow-mode execution of ContextEnvelopeBuilder alongside the existing
 * AI reply flow. This is a transitional component for the Format A → C migration.
 *
 * Usage in Main process (e.g., in orchestrator-host.ts or bootstrap.ts):
 * ```typescript
 * const integration = new ContextEnvelopeIntegration({
 *   builder: contextEnvelopeBuilder,
 *   eventSink: (event, payload) => eventBus.emit(event, payload),
 *   errorLogger: (error, context) => console.error(`[ContextEnvelope] ${context}:`, error),
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
export class ContextEnvelopeIntegration {
  private readonly builder?: ContextEnvelopeBuilder;
  private readonly eventSink?: (event: string, payload: Record<string, unknown>) => void;
  private readonly errorLogger?: (error: unknown, context: string) => void;

  constructor(options: ContextEnvelopeIntegrationOptions) {
    this.builder = options.builder;
    this.eventSink = options.eventSink;
    this.errorLogger = options.errorLogger;
  }

  /**
   * Run Builder in shadow mode (fire-and-forget).
   *
   * This method:
   * - Returns immediately (no await).
   * - Runs Builder in background.
   * - Emits events on success/failure.
   * - Never throws (errors are logged).
   *
   * @param input - Builder input (turn, messageFacts, productId)
   */
  runShadowMode(input: ContextEnvelopeBuildInput): void {
    // If no Builder is injected, shadow mode is disabled
    if (!this.builder) {
      return;
    }

    // Fire-and-forget: do not await, do not block
    this.buildAsync(input).catch((error) => {
      // Log error but do not propagate
      if (this.errorLogger) {
        this.errorLogger(error, "shadow_mode_build");
      } else {
        console.error("[ContextEnvelope] Shadow mode build failed:", error);
      }
    });
  }

  /**
   * Internal async build method.
   */
  private async buildAsync(input: ContextEnvelopeBuildInput): Promise<void> {
    if (!this.builder) {
      return;
    }

    try {
      const envelope = await this.builder.build(input);

      // Emit success event
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
    } catch (error) {
      // Emit failure event
      if (this.eventSink) {
        this.eventSink("ContextEnvelopeBuildFailed", {
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
   * Check if shadow mode is enabled (Builder is injected).
   */
  isEnabled(): boolean {
    return this.builder !== undefined;
  }
}

/**
 * Factory function for creating a ContextEnvelopeIntegration.
 *
 * @param options - Integration options
 * @returns A new ContextEnvelopeIntegration instance
 */
export function createContextEnvelopeIntegration(
  options: ContextEnvelopeIntegrationOptions,
): ContextEnvelopeIntegration {
  return new ContextEnvelopeIntegration(options);
}
