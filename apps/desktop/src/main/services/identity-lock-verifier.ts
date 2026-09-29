/**
 * IdentityLock Verifier (SHEEP-306, P2-8b).
 *
 * Purpose: Verify IdentityLock completeness and validity before ReplyPlan execution.
 * IdentityLock is the core safety mechanism for AI reply authorization.
 *
 * Governance basis:
 * - Master §5: IdentityLock is structural safety, not business validation.
 * - DEC-SHEEP-306: IdentityLock must be validated before execution.
 * - REPLY_AND_ACTION_SAFETY.md: Identity verification is blocking.
 *
 * Key invariants:
 * - Pure function, no side effects.
 * - Validates all required fields exist and are non-empty.
 * - Validates customer_identity.kind is within bounded vocabulary.
 * - Validates platform is a valid PlatformId.
 * - Does NOT validate timestamp expiration (MVP simplification).
 * - Does NOT validate cross-shop consistency (MVP simplification).
 *
 * Owner SHEEP-306 decisions:
 * D1: IdentityLock verifier is a pure function, not a service.
 * D2: MVP validates existence and format, not temporal validity.
 * D3: Validation errors are blocking (prevent execution).
 */

import type { ContractIdentityLock, ContractCustomerIdentity, PlatformId } from "@fastwork/domain";
import type { VerificationError } from "../ports/reply-plan-verifier-port.js";

/**
 * Valid customer identity kinds (bounded vocabulary).
 * Aligns with ContractCustomerIdentity.kind.
 */
const VALID_CUSTOMER_IDENTITY_KINDS: readonly ContractCustomerIdentity["kind"][] = [
  "customerUid",
  "buyer_id",
  "user_id",
];

/**
 * Valid platform IDs.
 * Aligns with PlatformId type from domain.
 */
const VALID_PLATFORM_IDS: readonly PlatformId[] = [
  "pdd",
  "doudian",
  "jd",
  "kuaishou",
  "qianniu",
  "xianyu",
];

/**
 * Result of IdentityLock verification.
 */
export interface IdentityLockVerificationResult {
  readonly ok: boolean;
  readonly errors: readonly VerificationError[];
}

/**
 * Verify IdentityLock completeness and validity.
 *
 * Validation rules:
 * 1. All required string fields must exist and be non-empty.
 * 2. customer_identity.kind must be within bounded vocabulary.
 * 3. customer_identity.value must be non-empty.
 * 4. platform must be a valid PlatformId.
 *
 * @param lock - The ContractIdentityLock to verify
 * @returns Verification result with errors (if any)
 */
export function verifyIdentityLock(lock: ContractIdentityLock): IdentityLockVerificationResult {
  const errors: VerificationError[] = [];

  // Rule 1: Validate required string fields
  const requiredStringFields: Array<{ field: keyof ContractIdentityLock; description: string }> = [
    { field: "merchant_id", description: "Merchant ID" },
    { field: "store_id", description: "Store ID" },
    { field: "platform_account_id", description: "Platform account ID" },
    { field: "conversation_id", description: "Conversation ID" },
    { field: "trigger_message_id", description: "Trigger message ID" },
  ];

  for (const { field, description } of requiredStringFields) {
    const value = lock[field];
    if (typeof value !== "string" || value.trim() === "") {
      errors.push({
        error_id: `identity_lock_missing_${field}`,
        category: "identity_lock",
        severity: "error",
        message: `${description} is missing or empty`,
        blocking: true,
      });
    }
  }

  // Rule 2: Validate platform
  if (!VALID_PLATFORM_IDS.includes(lock.platform)) {
    errors.push({
      error_id: "identity_lock_invalid_platform",
      category: "identity_lock",
      severity: "error",
      message: `Platform "${lock.platform}" is not a valid PlatformId`,
      blocking: true,
    });
  }

  // Rule 3: Validate customer_identity
  const customerIdentity = lock.customer_identity;
  if (!customerIdentity) {
    errors.push({
      error_id: "identity_lock_missing_customer_identity",
      category: "identity_lock",
      severity: "error",
      message: "customer_identity is missing",
      blocking: true,
    });
  } else {
    // Validate kind
    if (!VALID_CUSTOMER_IDENTITY_KINDS.includes(customerIdentity.kind)) {
      errors.push({
        error_id: "identity_lock_invalid_customer_kind",
        category: "identity_lock",
        severity: "error",
        message: `customer_identity.kind "${customerIdentity.kind}" is not valid`,
        blocking: true,
      });
    }

    // Validate value
    if (typeof customerIdentity.value !== "string" || customerIdentity.value.trim() === "") {
      errors.push({
        error_id: "identity_lock_missing_customer_value",
        category: "identity_lock",
        severity: "error",
        message: "customer_identity.value is missing or empty",
        blocking: true,
      });
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
