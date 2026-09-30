/**
 * Transport Blocker Port (SHEEP-309).
 *
 * Purpose: Define the interface for blocking transport calls in SHADOW mode.
 * Ensures that no messages are sent during SHADOW pipeline execution.
 *
 * Governance basis:
 * - Master §5: AI output must be structured and governed.
 * - REPLY_AND_ACTION_SAFETY: SHADOW mode must not call transport.
 * - SHEEP-309: TRANSPORT SEND CALLS = 0 is a critical safety metric.
 *
 * Key invariants:
 * - SHADOW mode: all transport calls must be blocked.
 * - OFF mode: all transport calls must be blocked.
 * - HUMAN_CONFIRM mode: transport calls blocked until human confirms (MVP).
 * - AUTO mode: transport calls allowed (but MVP does not authorize AUTO).
 * - Every transport attempt must be recorded for audit.
 * - Verification must confirm zero successful sends in SHADOW mode.
 *
 * Owner SHEEP-309 decisions:
 * D1: Blocker is a separate service (not part of PolicyEngine) for clear separation of concerns.
 * D2: Blocker tracks all attempts, even blocked ones, for audit trail.
 * D3: Blocker provides verification API to confirm zero sends.
 */

import type { RolloutMode } from "@fastwork/domain";

/**
 * Transport attempt record (for audit trail).
 */
export interface TransportAttempt {
  readonly id: string;
  readonly runId: string;
  readonly timestamp: string;
  readonly method: string;
  readonly blocked: boolean;
  readonly reason: string;
}

/**
 * Transport verification result.
 */
export interface TransportVerification {
  readonly allowed: boolean;
  readonly totalAttempts: number;
  readonly blockedAttempts: number;
  readonly successfulSends: number;
  readonly message: string;
}

/**
 * TransportBlockerPort: Interface for blocking transport calls in SHADOW mode.
 *
 * Usage:
 * ```typescript
 * const blocker = new TransportBlocker();
 * 
 * // Check if transport is allowed
 * if (!blocker.isTransportAllowed("SHADOW")) {
 *   blocker.recordTransportAttempt({
 *     id: randomUUID(),
 *     runId: "run-123",
 *     timestamp: new Date().toISOString(),
 *     method: "sendText",
 *     blocked: true,
 *     reason: "SHADOW mode does not allow transport calls",
 *   });
 * }
 * 
 * // Verify zero sends
 * const verification = blocker.verifyZeroSends();
 * if (!verification.allowed) {
 *   throw new Error("Transport calls detected in SHADOW mode!");
 * }
 * ```
 */
export interface TransportBlockerPort {
  /**
   * Check if transport calls are allowed for the given RolloutMode.
   *
   * @param mode - RolloutMode (OFF, SHADOW, HUMAN_CONFIRM, AUTO)
   * @returns true if transport is allowed, false if blocked
   */
  isTransportAllowed(mode: RolloutMode): boolean;

  /**
   * Record a transport call attempt (for audit trail).
   *
   * @param attempt - Transport attempt record
   */
  recordTransportAttempt(attempt: TransportAttempt): void;

  /**
   * Get the total number of transport call attempts.
   *
   * @returns Total attempt count
   */
  getTransportCallCount(): number;

  /**
   * Verify that zero transport calls were successful (SHADOW mode requirement).
   *
   * @returns TransportVerification result
   */
  verifyZeroSends(): TransportVerification;

  /**
   * Reset the transport call counter (called at the start of a new run).
   */
  reset(): void;
}
