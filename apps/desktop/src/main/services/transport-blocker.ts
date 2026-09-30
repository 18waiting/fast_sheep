/**
 * Transport Blocker Implementation (SHEEP-309).
 *
 * Purpose: Block transport calls in SHADOW mode and verify zero sends.
 * Ensures that no messages are sent during SHADOW pipeline execution.
 *
 * Governance basis:
 * - Master §5: AI output must be structured and governed.
 * - REPLY_AND_ACTION_SAFETY: SHADOW mode must not call transport.
 * - SHEEP-309: TRANSPORT SEND CALLS = 0 is a critical safety metric.
 *
 * Key invariants:
 * - SHADOW mode: all transport calls blocked (returns false).
 * - OFF mode: all transport calls blocked (returns false).
 * - HUMAN_CONFIRM mode: transport calls blocked until human confirms (MVP: returns false).
 * - AUTO mode: transport calls allowed (returns true), but MVP does not authorize AUTO.
 * - Every transport attempt is recorded for audit trail.
 * - Verification confirms zero successful sends in SHADOW mode.
 * - Counter resets at the start of each new run.
 *
 * Owner SHEEP-309 decisions:
 * D1: Blocker is a separate service (not part of PolicyEngine) for clear separation of concerns.
 * D2: Blocker tracks all attempts, even blocked ones, for audit trail.
 * D3: Blocker provides verification API to confirm zero sends.
 */

import type { RolloutMode } from "@fastwork/domain";
import type {
  TransportBlockerPort,
  TransportAttempt,
  TransportVerification,
} from "../ports/transport-blocker-port.js";

/**
 * TransportBlocker: Blocks transport calls in SHADOW mode and verifies zero sends.
 *
 * Usage:
 * ```typescript
 * const blocker = new TransportBlocker();
 * 
 * // At the start of a new run
 * blocker.reset();
 * 
 * // Check if transport is allowed
 * const mode: RolloutMode = "SHADOW";
 * if (!blocker.isTransportAllowed(mode)) {
 *   // Record the blocked attempt
 *   blocker.recordTransportAttempt({
 *     id: randomUUID(),
 *     runId: "run-123",
 *     timestamp: new Date().toISOString(),
 *     method: "sendText",
 *     blocked: true,
 *     reason: "SHADOW mode does not allow transport calls",
 *   });
 *   // Throw or return early
 *   throw new Error("Transport calls are not allowed in SHADOW mode");
 * }
 * 
 * // At the end of the run, verify zero sends
 * const verification = blocker.verifyZeroSends();
 * if (!verification.allowed) {
 *   throw new Error(`Transport safety violation: ${verification.successfulSends} sends detected`);
 * }
 * ```
 */
export class TransportBlocker implements TransportBlockerPort {
  private attempts: TransportAttempt[] = [];

  constructor() {
    this.attempts = [];
  }

  /**
   * Check if transport calls are allowed for the given RolloutMode.
   *
   * Rules:
   * - OFF: blocked (no AI execution at all)
   * - SHADOW: blocked (generate but don't send)
   * - HUMAN_CONFIRM: blocked (MVP: requires human confirmation before send)
   * - AUTO: allowed (but MVP does not authorize AUTO mode)
   *
   * @param mode - RolloutMode (OFF, SHADOW, HUMAN_CONFIRM, AUTO)
   * @returns true if transport is allowed, false if blocked
   */
  isTransportAllowed(mode: RolloutMode): boolean {
    // MVP: Only AUTO mode allows transport (but AUTO is not authorized in MVP)
    // All other modes (OFF, SHADOW, HUMAN_CONFIRM) block transport
    return mode === "AUTO";
  }

  /**
   * Record a transport call attempt (for audit trail).
   *
   * This method tracks all transport attempts, whether blocked or allowed.
   * The audit trail is critical for verifying SHADOW mode safety.
   *
   * @param attempt - Transport attempt record
   */
  recordTransportAttempt(attempt: TransportAttempt): void {
    this.attempts.push(attempt);
  }

  /**
   * Get the total number of transport call attempts.
   *
   * This includes both blocked and allowed attempts.
   * In SHADOW mode, this should be > 0 if the pipeline tried to send,
   * but all should be blocked.
   *
   * @returns Total attempt count
   */
  getTransportCallCount(): number {
    return this.attempts.length;
  }

  /**
   * Verify that zero transport calls were successful (SHADOW mode requirement).
   *
   * This is the critical safety check for SHADOW mode.
   * It verifies that:
   * - All transport attempts were blocked (blockedAttempts === totalAttempts)
   * - Zero transport calls succeeded (successfulSends === 0)
   *
   * @returns TransportVerification result
   */
  verifyZeroSends(): TransportVerification {
    const totalAttempts = this.attempts.length;
    const blockedAttempts = this.attempts.filter((a) => a.blocked).length;
    const successfulSends = totalAttempts - blockedAttempts;

    const allowed = successfulSends === 0;
    const message = allowed
      ? `✅ TRANSPORT SEND CALLS = 0 (SHADOW mode verified: ${totalAttempts} attempts, all blocked)`
      : `❌ TRANSPORT SEND CALLS = ${successfulSends} (SAFETY VIOLATION: ${successfulSends} sends detected)`;

    return {
      allowed,
      totalAttempts,
      blockedAttempts,
      successfulSends,
      message,
    };
  }

  /**
   * Reset the transport call counter (called at the start of a new run).
   *
   * This clears all recorded attempts, preparing for a new SHADOW pipeline run.
   */
  reset(): void {
    this.attempts = [];
  }
}
