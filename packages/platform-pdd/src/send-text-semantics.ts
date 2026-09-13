export const PDD_SEND_TARGET_KIND = "PDD_CUSTOMER_UID" as const;

export type PddSendTarget = {
  kind: typeof PDD_SEND_TARGET_KIND;
  customerUid: string;
};

export interface PddSendIntentInput {
  target?: unknown;
  content?: unknown;
  [key: string]: unknown;
}

export interface PddSendIntent {
  target: PddSendTarget;
  content: string;
}

export type PddLocalValidation = "VALID" | "REJECTED";
export type PddPlatformAttempt = "NOT_ATTEMPTED" | "ATTEMPTED" | "UNKNOWN";
export type PddPlatformOutcome =
  | "NOT_ATTEMPTED"
  | "PLATFORM_APPLICATION_ACCEPTED"
  | "PLATFORM_REJECTED"
  | "UNKNOWN";

/** A future adapter may provide this opaque platform identity without business semantics. */
export interface PddPlatformResultFacts {
  platformMessageId?: string;
}

export interface PddSendState {
  localValidation: PddLocalValidation;
  platformAttempt: PddPlatformAttempt;
  platformOutcome: PddPlatformOutcome;
  platformResult?: PddPlatformResultFacts;
}

export type PddSendIntentValidationResult =
  | { status: "VALID"; intent: PddSendIntent }
  | { status: "REJECTED"; reason: PddSendIntentRejectionReason };

export type PddSendIntentRejectionReason =
  | "target_missing_or_invalid"
  | "target_kind_invalid"
  | "customer_uid_missing_or_invalid"
  | "content_missing_or_invalid";

export type PddSendStateValidationResult =
  | { status: "VALID"; state: PddSendState }
  | { status: "REJECTED"; reason: PddSendStateRejectionReason };

export type PddSendStateRejectionReason =
  | "local_rejection_must_not_attempt"
  | "not_attempted_requires_not_attempted_outcome"
  | "unknown_attempt_requires_unknown_outcome"
  | "attempted_requires_platform_outcome"
  | "platform_result_requires_attempt"
  | "platform_result_invalid"
  | "platform_message_id_invalid";

export type PddUnknownOutcomeDirective = "NO_AUTOMATIC_RETRY";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCustomerUid(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isValidPlatformMessageId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim().length > 0;
}

/** Build a prospective send intent only; this function performs no platform action. */
export function validatePddSendIntent(input: PddSendIntentInput): PddSendIntentValidationResult {
  if (!isRecord(input.target)) return { status: "REJECTED", reason: "target_missing_or_invalid" };
  if (input.target.kind !== PDD_SEND_TARGET_KIND) return { status: "REJECTED", reason: "target_kind_invalid" };
  if (!isCustomerUid(input.target.customerUid)) {
    return { status: "REJECTED", reason: "customer_uid_missing_or_invalid" };
  }
  if (!isNonEmptyText(input.content)) return { status: "REJECTED", reason: "content_missing_or_invalid" };

  return {
    status: "VALID",
    intent: {
      target: { kind: PDD_SEND_TARGET_KIND, customerUid: input.target.customerUid },
      content: input.content,
    },
  };
}

/** Validate state vocabulary without implementing transport transitions or retries. */
export function validatePddSendState(state: PddSendState): PddSendStateValidationResult {
  if (state.localValidation === "REJECTED" && state.platformAttempt !== "NOT_ATTEMPTED") {
    return { status: "REJECTED", reason: "local_rejection_must_not_attempt" };
  }
  if (state.platformAttempt === "NOT_ATTEMPTED" && state.platformOutcome !== "NOT_ATTEMPTED") {
    return { status: "REJECTED", reason: "not_attempted_requires_not_attempted_outcome" };
  }
  if (state.platformAttempt === "UNKNOWN" && state.platformOutcome !== "UNKNOWN") {
    return { status: "REJECTED", reason: "unknown_attempt_requires_unknown_outcome" };
  }
  if (state.platformAttempt === "ATTEMPTED" && state.platformOutcome === "NOT_ATTEMPTED") {
    return { status: "REJECTED", reason: "attempted_requires_platform_outcome" };
  }
  if (state.platformResult !== undefined) {
    if (state.platformAttempt === "NOT_ATTEMPTED") {
      return { status: "REJECTED", reason: "platform_result_requires_attempt" };
    }
    if (!isRecord(state.platformResult)) {
      return { status: "REJECTED", reason: "platform_result_invalid" };
    }
    const keys = Object.keys(state.platformResult);
    if (keys.some((key) => key !== "platformMessageId")) {
      return { status: "REJECTED", reason: "platform_result_invalid" };
    }
    if (state.platformResult.platformMessageId !== undefined && !isValidPlatformMessageId(state.platformResult.platformMessageId)) {
      return { status: "REJECTED", reason: "platform_message_id_invalid" };
    }
  }
  return { status: "VALID", state };
}

/** UNKNOWN is never an instruction to retry automatically. */
export function unknownOutcomeDirective(outcome: PddPlatformOutcome): PddUnknownOutcomeDirective | undefined {
  return outcome === "UNKNOWN" ? "NO_AUTOMATIC_RETRY" : undefined;
}
