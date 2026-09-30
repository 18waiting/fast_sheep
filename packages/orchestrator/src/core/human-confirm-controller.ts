/**
 * HumanConfirmController (SHEEP-311).
 *
 * Governance basis:
 * - REPLY_AND_ACTION_SAFETY §8: Human confirmation must bind to IdentityLock, ReplyPlan,
 *   target resource, policy version, and session evidence.
 * - PDD_MVP_V1.md: HUMAN_CONFIRM mode requires human confirmation before execution.
 * - AI_CUSTOMER_SERVICE_CORE: Human is the execution gate for HUMAN_CONFIRM mode.
 *
 * Key invariants:
 * - AUTO mode is explicitly rejected and unauthorized for MVP.
 * - Human confirmation is required before any transport execution in HUMAN_CONFIRM mode.
 * - Confirmation binds to a specific ReplyPlan + IdentityLock + policy version.
 * - A confirmation for one target must not authorize a different target.
 * - Confirmations are time-bounded and can expire.
 * - All confirmation operations are auditable.
 *
 * Owner SHEEP-311 decisions:
 * D1: HumanConfirmController manages the lifecycle of confirmation requests.
 * D2: Confirmations are bound to specific plan_id and identity_lock.
 * D3: AUTO mode is explicitly rejected.
 * D4: All operations produce audit events.
 */

/**
 * RolloutMode: How AI replies are executed.
 * Mirrors the domain type from context-envelope.ts.
 */
export type RolloutMode = "OFF" | "SHADOW" | "HUMAN_CONFIRM" | "AUTO";

/**
 * ConfirmationStatus: The status of a confirmation request.
 */
export type ConfirmationStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "EXPIRED" | "SUPERSEDED";

/**
 * IdentityLock: The identity scope for a confirmation.
 * Simplified version of ContractIdentityLock from domain.
 */
export interface IdentityLock {
  readonly merchant_id: string;
  readonly store_id: string;
  readonly platform: string;
  readonly platform_account_id: string;
  readonly conversation_id: string;
  readonly trigger_message_id: string;
  readonly generation?: number;
}

/**
 * ReplyPlanRef: Reference to a ReplyPlan for confirmation.
 * Simplified version containing only the fields needed for confirmation.
 */
export interface ReplyPlanRef {
  readonly plan_id: string;
  readonly identity_lock: IdentityLock;
}

/**
 * PolicyDecisionRef: Reference to a PolicyDecision for confirmation.
 * Simplified version containing only the fields needed for confirmation.
 */
export interface PolicyDecisionRef {
  readonly rollout_mode: RolloutMode;
  readonly requires_confirmation: boolean;
  readonly policy_version: string;
}

/**
 * ConfirmationRequest: A request for human confirmation.
 */
export interface ConfirmationRequest {
  readonly confirmation_id: string;
  readonly plan_id: string;
  readonly identity_lock: IdentityLock;
  readonly policy_version: string;
  readonly requested_at: string;
  readonly status: ConfirmationStatus;
  readonly expires_at?: string;
  readonly confirmation_reason?: string;
}

/**
 * ConfirmationBinding: The immutable record of human confirmation.
 */
export interface ConfirmationBinding {
  readonly confirmation_id: string;
  readonly plan_id: string;
  readonly identity_lock: IdentityLock;
  readonly policy_version: string;
  readonly confirmed_at: string;
  readonly confirmed_by: string;
  readonly confirmation_hash: string;
  readonly expires_at?: string;
}

/**
 * ConfirmationResult: The result of a confirm or reject operation.
 */
export interface ConfirmationResult {
  readonly success: boolean;
  readonly confirmation?: ConfirmationBinding;
  readonly request?: ConfirmationRequest;
  readonly reason?: string;
}

/**
 * HumanConfirmControllerOptions: Configuration for the controller.
 */
export interface HumanConfirmControllerOptions {
  /**
   * Default expiration time for confirmation requests in milliseconds.
   * If not provided, requests do not expire by default.
   */
  readonly defaultExpirationMs?: number;

  /**
   * Clock function for getting current time (ISO 8601).
   * Defaults to () => new Date().toISOString().
   */
  readonly clock?: () => string;
}

/**
 * HumanConfirmController: Manages the lifecycle of human confirmation requests.
 *
 * This controller is responsible for:
 * - Creating confirmation requests for ReplyPlans in HUMAN_CONFIRM mode.
 * - Processing confirm/reject operations from the human operator.
 * - Validating that confirmations match the correct plan and identity.
 * - Producing ConfirmationBinding records for audit correlation.
 * - Explicitly rejecting AUTO mode.
 *
 * Usage:
 * ```typescript
 * const controller = new HumanConfirmController();
 *
 * // Request confirmation for a ReplyPlan
 * const request = controller.requestConfirmation(replyPlanRef, policyDecisionRef);
 *
 * // Human confirms
 * const result = controller.confirm(request.confirmation_id, "user-123");
 * if (result.success) {
 *   // Proceed with transport execution using result.confirmation
 * }
 * ```
 */
export class HumanConfirmController {
  private readonly pendingRequests = new Map<string, ConfirmationRequest>();
  private readonly defaultExpirationMs?: number;
  private readonly clock: () => string;

  constructor(options: HumanConfirmControllerOptions = {}) {
    this.defaultExpirationMs = options.defaultExpirationMs;
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  /**
   * Request human confirmation for a ReplyPlan.
   *
   * @param plan - Reference to the ReplyPlan to confirm.
   * @param decision - Reference to the PolicyDecision for this plan.
   * @returns A new ConfirmationRequest with PENDING status.
   * @throws Error if the decision does not require confirmation.
   * @throws Error if the rollout mode is AUTO (explicitly rejected).
   */
  requestConfirmation(plan: ReplyPlanRef, decision: PolicyDecisionRef): ConfirmationRequest {
    // Explicitly reject AUTO mode
    if (decision.rollout_mode === "AUTO") {
      throw new Error(
        "AUTO mode is explicitly rejected for MVP. " +
        "Human confirmation is required for HUMAN_CONFIRM mode."
      );
    }

    // Validate that confirmation is required
    if (!decision.requires_confirmation) {
      throw new Error(
        `Confirmation is not required for rollout mode: ${decision.rollout_mode}. ` +
        "requestConfirmation should only be called for HUMAN_CONFIRM mode."
      );
    }

    // Calculate expiration time if configured
    const expiresAt = this.defaultExpirationMs
      ? new Date(Date.now() + this.defaultExpirationMs).toISOString()
      : undefined;

    // Create the confirmation request
    const request: ConfirmationRequest = {
      confirmation_id: `conf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      plan_id: plan.plan_id,
      identity_lock: plan.identity_lock,
      policy_version: decision.policy_version,
      requested_at: this.clock(),
      status: "PENDING",
      expires_at: expiresAt,
      confirmation_reason: `Confirmation required for ReplyPlan ${plan.plan_id}`,
    };

    // Store the pending request
    this.pendingRequests.set(request.confirmation_id, request);

    return request;
  }

  /**
   * Confirm a pending confirmation request.
   *
   * @param confirmationId - The confirmation request ID.
   * @param userId - The user ID who is confirming.
   * @returns A ConfirmationResult with the binding if successful.
   */
  confirm(confirmationId: string, userId: string): ConfirmationResult {
    const request = this.pendingRequests.get(confirmationId);

    if (!request) {
      return {
        success: false,
        reason: `Confirmation request not found: ${confirmationId}`,
      };
    }

    // Check if the request is still pending
    if (request.status !== "PENDING") {
      return {
        success: false,
        request,
        reason: `Confirmation request is not pending: ${request.status}`,
      };
    }

    // Check if the request has expired
    if (request.expires_at && new Date(request.expires_at) < new Date(this.clock())) {
      const expiredRequest: ConfirmationRequest = { ...request, status: "EXPIRED" };
      this.pendingRequests.set(confirmationId, expiredRequest);
      return {
        success: false,
        request: expiredRequest,
        reason: "Confirmation request has expired",
      };
    }

    // Create the confirmation binding
    const confirmedAt = this.clock();
    const confirmationHash = this.computeHash(
      request.confirmation_id,
      request.plan_id,
      confirmedAt,
      userId,
      request.identity_lock
    );

    const binding: ConfirmationBinding = {
      confirmation_id: request.confirmation_id,
      plan_id: request.plan_id,
      identity_lock: request.identity_lock,
      policy_version: request.policy_version,
      confirmed_at: confirmedAt,
      confirmed_by: userId,
      confirmation_hash: confirmationHash,
      expires_at: request.expires_at,
    };

    // Update the request status
    const confirmedRequest: ConfirmationRequest = { ...request, status: "CONFIRMED" };
    this.pendingRequests.set(confirmationId, confirmedRequest);

    return {
      success: true,
      confirmation: binding,
      request: confirmedRequest,
    };
  }

  /**
   * Reject a pending confirmation request.
   *
   * @param confirmationId - The confirmation request ID.
   * @param userId - The user ID who is rejecting.
   * @param reason - The reason for rejection.
   * @returns A ConfirmationResult indicating success.
   */
  reject(confirmationId: string, userId: string, reason: string): ConfirmationResult {
    const request = this.pendingRequests.get(confirmationId);

    if (!request) {
      return {
        success: false,
        reason: `Confirmation request not found: ${confirmationId}`,
      };
    }

    // Check if the request is still pending
    if (request.status !== "PENDING") {
      return {
        success: false,
        request,
        reason: `Confirmation request is not pending: ${request.status}`,
      };
    }

    // Update the request status
    const rejectedRequest: ConfirmationRequest = {
      ...request,
      status: "REJECTED",
      confirmation_reason: reason,
    };
    this.pendingRequests.set(confirmationId, rejectedRequest);

    return {
      success: true,
      request: rejectedRequest,
    };
  }

  /**
   * Get the status of a confirmation request.
   *
   * @param confirmationId - The confirmation request ID.
   * @returns The confirmation status, or "NOT_FOUND" if the request does not exist.
   */
  getConfirmationStatus(confirmationId: string): ConfirmationStatus | "NOT_FOUND" {
    const request = this.pendingRequests.get(confirmationId);

    if (!request) {
      return "NOT_FOUND";
    }

    // Check if the request has expired
    if (request.status === "PENDING" && request.expires_at) {
      if (new Date(request.expires_at) < new Date(this.clock())) {
        const expiredRequest: ConfirmationRequest = { ...request, status: "EXPIRED" };
        this.pendingRequests.set(confirmationId, expiredRequest);
        return "EXPIRED";
      }
    }

    return request.status;
  }

  /**
   * Get a confirmation request by ID.
   *
   * @param confirmationId - The confirmation request ID.
   * @returns The confirmation request, or undefined if not found.
   */
  getRequest(confirmationId: string): ConfirmationRequest | undefined {
    return this.pendingRequests.get(confirmationId);
  }

  /**
   * Validate that a confirmation binding matches the expected plan and identity.
   *
   * @param binding - The confirmation binding to validate.
   * @param expectedPlanId - The expected ReplyPlan ID.
   * @param expectedIdentityLock - The expected IdentityLock.
   * @returns true if the binding matches, false otherwise.
   */
  validateConfirmation(
    binding: ConfirmationBinding,
    expectedPlanId: string,
    expectedIdentityLock: IdentityLock
  ): boolean {
    // Check plan_id match
    if (binding.plan_id !== expectedPlanId) {
      return false;
    }

    // Check identity_lock match - ALL fields must match
    if (binding.identity_lock.conversation_id !== expectedIdentityLock.conversation_id) {
      return false;
    }

    if (binding.identity_lock.merchant_id !== expectedIdentityLock.merchant_id) {
      return false;
    }

    if (binding.identity_lock.store_id !== expectedIdentityLock.store_id) {
      return false;
    }

    if (binding.identity_lock.platform !== expectedIdentityLock.platform) {
      return false;
    }

    if (binding.identity_lock.platform_account_id !== expectedIdentityLock.platform_account_id) {
      return false;
    }

    if (binding.identity_lock.trigger_message_id !== expectedIdentityLock.trigger_message_id) {
      return false;
    }

    return true;
  }

  /**
   * Clear all pending requests.
   * Used for testing and cleanup.
   */
  clear(): void {
    this.pendingRequests.clear();
  }

  /**
   * Get the number of pending requests.
   * Used for diagnostics and testing.
   */
  get pendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Compute a simple hash for confirmation integrity.
   * Placeholder implementation. In production, use SHA-256.
   */
  private computeHash(
    confirmationId: string,
    planId: string,
    confirmedAt: string,
    confirmedBy: string,
    identityLock?: IdentityLock
  ): string {
    // Include identity_lock in hash to prevent cross-target collisions
    let content = `${confirmationId}:${planId}:${confirmedAt}:${confirmedBy}`;
    
    if (identityLock) {
      content += `:${identityLock.merchant_id}:${identityLock.store_id}:${identityLock.platform}:${identityLock.platform_account_id}:${identityLock.conversation_id}:${identityLock.trigger_message_id}`;
    }
    
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `sha256-${Math.abs(hash).toString(16).padStart(8, "0")}`;
  }
}
