/**
 * AU-04: AdapterIdentityEvidence contract.
 *
 * The guard compares immutable ExecutionIntent expected identity with the
 * evidence observed from the current platform runtime. This module is
 * contract-only and does not read platform DOM, call Transport, or send.
 */

import type { ContractIdentityLock } from "./context-envelope.js";

export type AdapterEvidenceAvailability = "COMPLETE" | "PARTIAL" | "UNREADABLE";

export interface AdapterIdentityEvidence {
  readonly evidence_id: string;
  readonly observed_at: string;
  readonly source: string;
  readonly availability: AdapterEvidenceAvailability;
  readonly runtime_shop_id?: string;
  readonly identity_lock?: ContractIdentityLock;
  readonly session_id?: string;
  readonly session_generation?: string;
  readonly document_generation?: string;
}

export interface AdapterEvidenceFailure {
  readonly field: string;
  readonly reason: string;
}

export interface AdapterEvidenceValidation {
  readonly valid: boolean;
  readonly failures: readonly AdapterEvidenceFailure[];
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

export function validateAdapterIdentityEvidence(
  evidence: AdapterIdentityEvidence,
): AdapterEvidenceValidation {
  const failures: AdapterEvidenceFailure[] = [];
  const add = (field: string, reason: string): void => {
    failures.push({ field, reason });
  };

  if (!isNonEmptyString(evidence.evidence_id)) add("evidence_id", "evidence_id is required");
  if (!isIsoDate(evidence.observed_at)) add("observed_at", "observed_at must be ISO 8601");
  if (!isNonEmptyString(evidence.source)) add("source", "source is required");
  if (
    evidence.availability !== "COMPLETE"
    && evidence.availability !== "PARTIAL"
    && evidence.availability !== "UNREADABLE"
  ) {
    add("availability", "availability is invalid");
  }

  if (evidence.availability !== "COMPLETE") {
    add("availability", "guard requires COMPLETE adapter evidence");
    return { valid: failures.length === 0, failures };
  }

  if (!isNonEmptyString(evidence.runtime_shop_id)) add("runtime_shop_id", "runtime_shop_id is required for COMPLETE evidence");
  if (!isNonEmptyString(evidence.session_id)) add("session_id", "session_id is required for COMPLETE evidence");
  if (!isNonEmptyString(evidence.session_generation)) add("session_generation", "session_generation is required for COMPLETE evidence");
  if (!isNonEmptyString(evidence.document_generation)) add("document_generation", "document_generation is required for COMPLETE evidence");

  const identity = evidence.identity_lock;
  if (!isObject(identity)) {
    add("identity_lock", "identity_lock is required for COMPLETE evidence");
    return { valid: failures.length === 0, failures };
  }

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

  return { valid: failures.length === 0, failures };
}
