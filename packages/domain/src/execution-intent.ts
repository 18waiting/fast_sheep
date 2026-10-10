/**
 * AU-03: ExecutionIntent contract.
 *
 * Governance basis:
 * - AU-02 EXPECTED_IDENTITY_AUTHORITY_V1.
 * - ExecutionIntent is the sole expected-identity authority for an executable send.
 * - Live Adapter evidence is the actual value at execution time.
 *
 * This module is contract-only. It does not send, call a transport, or modify
 * any orchestrator/send path.
 */

import type { ContractIdentityLock } from "./context-envelope.js";

export const EXECUTION_INTENT_SCHEMA_VERSION = "1.0" as const;

export type ExecutionIntentAuthorizationSource =
  | "HUMAN_CONFIRMATION"
  | "POLICY_AUTHORIZATION";

export type ExecutionIntentState =
  | "CREATED"
  | "PLAN_BOUND"
  | "CONFIRMED"
  | "CLAIMED"
  | "ATTEMPTED"
  | "ACKNOWLEDGED"
  | "REJECTED"
  | "UNKNOWN"
  | "EXPIRED"
  | "CANCELLED";

export interface ExecutionIntentPlanRef {
  readonly plan_id: string;
  readonly plan_hash: string;
}

export interface ExecutionIntentPolicyRef {
  readonly policy_version: string;
}

export interface ExecutionIntentConfirmationRef {
  readonly confirmation_id: string;
  readonly confirmation_hash: string;
  readonly confirmed_at: string;
  readonly expires_at?: string;
}

export interface ExecutionIntentImmutableFields {
  readonly schema_version: typeof EXECUTION_INTENT_SCHEMA_VERSION;
  readonly intent_id: string;
  readonly authorization_source: ExecutionIntentAuthorizationSource;
  readonly identity_lock: ContractIdentityLock;
  readonly plan_ref: ExecutionIntentPlanRef;
  readonly policy_ref: ExecutionIntentPolicyRef;
  readonly confirmation_ref?: ExecutionIntentConfirmationRef;
  readonly session_generation: string;
  readonly document_generation: string;
  readonly created_at: string;
  readonly expires_at: string;
  readonly nonce: string;
}

export interface ExecutionIntent extends ExecutionIntentImmutableFields {
  readonly state: ExecutionIntentState;
  readonly intent_hash: string;
}

export interface CreateExecutionIntentInput
  extends Omit<ExecutionIntentImmutableFields, "schema_version"> {
  readonly state?: ExecutionIntentState;
}

export interface ExecutionIntentFailure {
  readonly field: string;
  readonly reason: string;
}

export interface ExecutionIntentValidation {
  readonly valid: boolean;
  readonly failures: readonly ExecutionIntentFailure[];
}

export class ExecutionIntentValidationError extends Error {
  public readonly failures: readonly ExecutionIntentFailure[];

  constructor(failures: readonly ExecutionIntentFailure[]) {
    super(`ExecutionIntent validation failed: ${failures.map((failure) => failure.reason).join("; ")}`);
    this.name = "ExecutionIntentValidationError";
    this.failures = failures;
  }
}

export const EXECUTION_INTENT_ALLOWED_TRANSITIONS: Readonly<
  Record<ExecutionIntentState, readonly ExecutionIntentState[]>
> = {
  CREATED: ["PLAN_BOUND", "CANCELLED", "EXPIRED"],
  PLAN_BOUND: ["CONFIRMED", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["CLAIMED", "CANCELLED", "EXPIRED"],
  CLAIMED: ["ATTEMPTED", "CANCELLED"],
  ATTEMPTED: ["ACKNOWLEDGED", "REJECTED", "UNKNOWN"],
  ACKNOWLEDGED: [],
  REJECTED: [],
  UNKNOWN: [],
  EXPIRED: [],
  CANCELLED: [],
};

interface CryptoLike {
  readonly subtle: {
    digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
  };
}

interface TextEncoderLike {
  encode(input: string): Uint8Array;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  }

  const object = value as Record<string, unknown>;
  const entries = Object.keys(object)
    .filter((key) => object[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`);
  return `{${entries.join(",")}}`;
}

export function getExecutionIntentHashPayload(
  intent: ExecutionIntentImmutableFields | ExecutionIntent,
): Record<string, unknown> {
  return {
    schema_version: intent.schema_version,
    intent_id: intent.intent_id,
    authorization_source: intent.authorization_source,
    identity_lock: intent.identity_lock,
    plan_ref: intent.plan_ref,
    policy_ref: intent.policy_ref,
    ...(intent.confirmation_ref === undefined
      ? {}
      : { confirmation_ref: intent.confirmation_ref }),
    session_generation: intent.session_generation,
    document_generation: intent.document_generation,
    created_at: intent.created_at,
    expires_at: intent.expires_at,
    nonce: intent.nonce,
  };
}

export async function computeExecutionIntentHash(
  intent: ExecutionIntentImmutableFields | ExecutionIntent,
): Promise<string> {
  const cryptoApi = (globalThis as unknown as { crypto?: CryptoLike }).crypto;
  const Encoder = (globalThis as unknown as { TextEncoder?: new () => TextEncoderLike }).TextEncoder;
  if (!cryptoApi?.subtle || !Encoder) {
    throw new Error("ExecutionIntent hashing requires Web Crypto and TextEncoder support");
  }

  const payload = canonicalize(getExecutionIntentHashPayload(intent));
  const digest = await cryptoApi.subtle.digest("SHA-256", new Encoder().encode(payload));
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256-${hex}`;
}

export async function verifyExecutionIntentHash(
  intent: ExecutionIntent,
): Promise<boolean> {
  if (!isNonEmptyString(intent.intent_hash)) return false;
  const expected = await computeExecutionIntentHash(intent);
  return intent.intent_hash === expected;
}

export function validateExecutionIntent(
  intent: ExecutionIntent,
): ExecutionIntentValidation {
  const failures: ExecutionIntentFailure[] = [];
  const add = (field: string, reason: string): void => {
    failures.push({ field, reason });
  };

  if (intent.schema_version !== EXECUTION_INTENT_SCHEMA_VERSION) {
    add("schema_version", `schema_version must be ${EXECUTION_INTENT_SCHEMA_VERSION}`);
  }
  if (!isNonEmptyString(intent.intent_id)) add("intent_id", "intent_id is required");
  if (
    intent.authorization_source !== "HUMAN_CONFIRMATION"
    && intent.authorization_source !== "POLICY_AUTHORIZATION"
  ) {
    add("authorization_source", "authorization_source is invalid");
  }

  const identity = intent.identity_lock;
  if (!isObject(identity)) {
    add("identity_lock", "identity_lock is required");
  } else {
    for (const field of [
      "merchant_id",
      "store_id",
      "platform",
      "platform_account_id",
      "conversation_id",
      "trigger_message_id",
    ]) {
      if (!isNonEmptyString(identity[field])) add(`identity_lock.${field}`, `${field} is required`);
    }
    const customer = identity.customer_identity;
    if (!isObject(customer)) {
      add("identity_lock.customer_identity", "customer_identity is required");
    } else {
      if (!isNonEmptyString(customer.kind)) add("identity_lock.customer_identity.kind", "customer identity kind is required");
      if (!isNonEmptyString(customer.value)) add("identity_lock.customer_identity.value", "customer identity value is required");
    }
    if (identity.generation !== undefined && !Number.isInteger(identity.generation)) {
      add("identity_lock.generation", "identity_lock.generation must be an integer when provided");
    }
  }

  if (!isObject(intent.plan_ref)) {
    add("plan_ref", "plan_ref is required");
  } else {
    if (!isNonEmptyString(intent.plan_ref.plan_id)) add("plan_ref.plan_id", "plan_id is required");
    if (!isNonEmptyString(intent.plan_ref.plan_hash)) add("plan_ref.plan_hash", "plan_hash is required");
  }

  if (!isObject(intent.policy_ref)) {
    add("policy_ref", "policy_ref is required");
  } else if (!isNonEmptyString(intent.policy_ref.policy_version)) {
    add("policy_ref.policy_version", "policy_version is required");
  }

  if (intent.authorization_source === "HUMAN_CONFIRMATION") {
    const confirmation = intent.confirmation_ref;
    if (!isObject(confirmation)) {
      add("confirmation_ref", "HUMAN_CONFIRMATION requires confirmation_ref");
    } else {
      if (!isNonEmptyString(confirmation.confirmation_id)) add("confirmation_ref.confirmation_id", "confirmation_id is required");
      if (!isNonEmptyString(confirmation.confirmation_hash)) add("confirmation_ref.confirmation_hash", "confirmation_hash is required");
      if (!isIsoDate(confirmation.confirmed_at)) add("confirmation_ref.confirmed_at", "confirmed_at must be ISO 8601");
      if (confirmation.expires_at !== undefined && !isIsoDate(confirmation.expires_at)) {
        add("confirmation_ref.expires_at", "expires_at must be ISO 8601 when provided");
      }
    }
  } else if (intent.confirmation_ref !== undefined) {
    add("confirmation_ref", "POLICY_AUTHORIZATION must not include confirmation_ref");
  }

  if (!isNonEmptyString(intent.session_generation)) add("session_generation", "session_generation is required");
  if (!isNonEmptyString(intent.document_generation)) add("document_generation", "document_generation is required");
  if (!isNonEmptyString(intent.nonce)) add("nonce", "nonce is required");
  if (!isIsoDate(intent.created_at)) add("created_at", "created_at must be ISO 8601");
  if (!isIsoDate(intent.expires_at)) {
    add("expires_at", "expires_at must be ISO 8601");
  } else if (isIsoDate(intent.created_at) && Date.parse(intent.expires_at) <= Date.parse(intent.created_at)) {
    add("expires_at", "expires_at must be after created_at");
  }

  if (!Object.hasOwn(EXECUTION_INTENT_ALLOWED_TRANSITIONS, intent.state)) {
    add("state", "state is invalid");
  }
  if (!/^sha256-[0-9a-f]{64}$/.test(intent.intent_hash)) {
    add("intent_hash", "intent_hash must use sha256-<64 lowercase hex characters>");
  }

  return { valid: failures.length === 0, failures };
}

export function isExecutionIntentTransitionAllowed(
  from: ExecutionIntentState,
  to: ExecutionIntentState,
): boolean {
  return EXECUTION_INTENT_ALLOWED_TRANSITIONS[from].includes(to);
}

export function transitionExecutionIntent(
  intent: ExecutionIntent,
  nextState: ExecutionIntentState,
): ExecutionIntent {
  if (!isExecutionIntentTransitionAllowed(intent.state, nextState)) {
    throw new Error(`Invalid ExecutionIntent transition: ${intent.state} -> ${nextState}`);
  }
  return { ...intent, state: nextState };
}

export async function createExecutionIntent(
  input: CreateExecutionIntentInput,
): Promise<ExecutionIntent> {
  const { state = "CREATED", ...fields } = input;
  const immutable: ExecutionIntentImmutableFields = {
    schema_version: EXECUTION_INTENT_SCHEMA_VERSION,
    ...fields,
  };
  const intent: ExecutionIntent = {
    ...immutable,
    state,
    intent_hash: await computeExecutionIntentHash(immutable),
  };

  const validation = validateExecutionIntent(intent);
  if (!validation.valid) {
    throw new ExecutionIntentValidationError(validation.failures);
  }
  if (!(await verifyExecutionIntentHash(intent))) {
    throw new ExecutionIntentValidationError([
      { field: "intent_hash", reason: "intent_hash verification failed" },
    ]);
  }
  return intent;
}
