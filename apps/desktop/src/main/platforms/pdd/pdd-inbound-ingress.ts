import { validatorFor } from "@fastwork/contracts";
import type { IdentityResolution, InboundEnvelope } from "@fastwork/domain";
import {
  mapPddInboundToCanonical,
  normalizePddInboundForCanonical,
  type PddCanonicalIdentityBinding,
  type PddCanonicalInboundMessage,
  type PddCanonicalScopeBinding,
} from "@fastwork/platform-pdd";
import type { PddInboundDocumentBinding } from "./pdd-session-host.js";

export type PddCanonicalEnvelopeValidator = (value: unknown) => boolean;

export interface PddInboundIngressInput {
  readonly payload?: unknown;
  readonly sourceOccurredAt?: unknown;
}

export interface PddInboundIngressProcessOptions {
  readonly document: PddInboundDocumentBinding;
  readonly input: unknown;
  readonly resolveScope: (document: PddInboundDocumentBinding) => PddCanonicalScopeBinding | null;
  readonly resolveIdentity: (
    message: PddCanonicalInboundMessage,
    document: PddInboundDocumentBinding,
  ) => PddCanonicalIdentityBinding | null;
  /** undefined selects the real canonical schema validator; null forces unavailable. */
  readonly canonicalValidator?: PddCanonicalEnvelopeValidator | null;
}

export type PddInboundIngressResult =
  | { status: "MAPPED"; envelope: InboundEnvelope; diagnostics: readonly string[] }
  | { status: "REJECTED"; reason: string; diagnostics: readonly string[] }
  | { status: "STOPPED"; reason: "COLLECTOR_MISSING"; diagnostics: readonly string[] }
  | { status: "FAILED"; reason: string; diagnostics: readonly string[] };

interface SourceTimeResult {
  readonly value: string | null;
  readonly diagnostics: readonly string[];
}

type CanonicalValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "CANONICAL_VALIDATOR_UNAVAILABLE" | "CANONICAL_VALIDATOR_THREW" | "CANONICAL_VALIDATION_FAILED" };

let defaultCanonicalValidator: PddCanonicalEnvelopeValidator | null | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isIdentityResolution(value: unknown, validateValue: (candidate: unknown) => boolean): boolean {
  if (!isRecord(value)) return false;
  if (value.status === "RESOLVED") return hasOwn(value, "value") && validateValue(value.value);
  if (value.status === "UNKNOWN" || value.status === "UNRESOLVED") return !hasOwn(value, "value");
  return false;
}

function isStringValue(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

function isReferenceValue(value: unknown): boolean {
  return isRecord(value) && isStringValue(value.value) && Object.keys(value).length === 1;
}

function isScopeBinding(value: unknown): value is PddCanonicalScopeBinding {
  if (!isRecord(value)) return false;
  return isIdentityResolution(value.merchantId, isStringValue)
    && isIdentityResolution(value.storeId, isStringValue)
    && isIdentityResolution(value.platformAccountId, isStringValue);
}

function isMessageAssociation(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!isStringValue(value.ownerRuntimeShopId)) return false;
  if (!isScopeBinding(value.ownerScope)) return false;
  if (value.platformCustomerId !== undefined && !isStringValue(value.platformCustomerId)) return false;
  if (value.platformMessageId !== undefined && !isStringValue(value.platformMessageId)) return false;
  return isIdentityResolution(value.internalConversationId, isStringValue)
    && isIdentityResolution(value.localMessageId, isStringValue);
}

function isSelectedCustomerObservation(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.status === "SELECTED") return isRecord(value.platformCustomerId) && isReferenceValue(value.platformCustomerId);
  return value.status === "NONE" || value.status === "UNKNOWN";
}

function isIdentityBinding(value: unknown): value is PddCanonicalIdentityBinding {
  if (!isRecord(value)) return false;
  if (!isIdentityResolution(value.runtimeShop, isReferenceValue)) return false;
  if (!isIdentityResolution(value.runtimeConversationReference, isReferenceValue)) return false;
  if (!isScopeBinding(value.scope)) return false;
  if (value.association !== undefined && !isMessageAssociation(value.association)) return false;
  if (value.selectedCustomerObservation !== undefined && !isSelectedCustomerObservation(value.selectedCustomerObservation)) return false;
  return true;
}

function sameResolution(left: IdentityResolution<unknown>, right: IdentityResolution<unknown>): boolean {
  if (left.status !== right.status) return false;
  if (left.status !== "RESOLVED" || right.status !== "RESOLVED") return true;
  return Object.is(left.value, right.value);
}

function sameScope(left: PddCanonicalScopeBinding, right: PddCanonicalScopeBinding): boolean {
  return sameResolution(left.merchantId, right.merchantId)
    && sameResolution(left.storeId, right.storeId)
    && sameResolution(left.platformAccountId, right.platformAccountId);
}

function resolveDefaultCanonicalValidator(): PddCanonicalEnvelopeValidator | null {
  if (defaultCanonicalValidator !== undefined) return defaultCanonicalValidator;
  try {
    const validate = validatorFor("fastwork:domain:inbound-envelope");
    defaultCanonicalValidator = (value: unknown) => validate(value) === true;
  } catch {
    defaultCanonicalValidator = null;
  }
  return defaultCanonicalValidator;
}

function validateCanonicalEnvelope(
  envelope: InboundEnvelope,
  validator: PddCanonicalEnvelopeValidator | null | undefined,
): CanonicalValidationResult {
  const validate = validator === undefined ? resolveDefaultCanonicalValidator() : validator;
  if (validate === null) return { ok: false, reason: "CANONICAL_VALIDATOR_UNAVAILABLE" };
  try {
    return validate(envelope) ? { ok: true } : { ok: false, reason: "CANONICAL_VALIDATION_FAILED" };
  } catch {
    return { ok: false, reason: "CANONICAL_VALIDATOR_THREW" };
  }
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Strict controlled-fixture subset: ISO-8601 UTC Z time with a real calendar date. */
function normalizeSourceOccurredAt(value: unknown): SourceTimeResult {
  if (value === undefined || value === null) {
    return Object.freeze({ value: null, diagnostics: Object.freeze(["SOURCE_TIME_MISSING"]) });
  }
  if (typeof value !== "string") {
    return Object.freeze({ value: null, diagnostics: Object.freeze(["SOURCE_TIME_INVALID"]) });
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/.exec(value);
  if (!match) return Object.freeze({ value: null, diagnostics: Object.freeze(["SOURCE_TIME_INVALID"]) });
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)
    || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    return Object.freeze({ value: null, diagnostics: Object.freeze(["SOURCE_TIME_INVALID"]) });
  }
  return Object.freeze({ value, diagnostics: Object.freeze([]) });
}

function malformedInput(): PddInboundIngressResult {
  return { status: "REJECTED", reason: "MALFORMED_INGRESS_INPUT", diagnostics: Object.freeze([]) };
}

export function processPddInboundIngress(options: PddInboundIngressProcessOptions): PddInboundIngressResult {
  if (!isRecord(options.input) || !hasOwn(options.input, "payload")) return malformedInput();

  let normalized;
  try {
    normalized = normalizePddInboundForCanonical(options.input.payload);
  } catch {
    return { status: "FAILED", reason: "NORMALIZER_THREW", diagnostics: Object.freeze([]) };
  }
  if (normalized.status === "REJECTED") {
    return { status: "REJECTED", reason: normalized.reason, diagnostics: Object.freeze([...normalized.diagnostics]) };
  }

  const sourceSnapshot = Object.freeze({
    ...normalized.value,
    diagnostics: Object.freeze([...normalized.value.diagnostics]),
  });

  let authoritativeScope: PddCanonicalScopeBinding | null;
  try {
    authoritativeScope = options.resolveScope(options.document);
  } catch {
    return { status: "FAILED", reason: "SCOPE_BINDING_RESOLVER_THREW", diagnostics: sourceSnapshot.diagnostics };
  }
  if (!isScopeBinding(authoritativeScope)) {
    return { status: "FAILED", reason: "MALFORMED_SCOPE_BINDING", diagnostics: sourceSnapshot.diagnostics };
  }

  let identity: PddCanonicalIdentityBinding | null;
  try {
    identity = options.resolveIdentity(sourceSnapshot, options.document);
  } catch {
    return { status: "FAILED", reason: "IDENTITY_BINDING_RESOLVER_THREW", diagnostics: sourceSnapshot.diagnostics };
  }
  if (identity === null) {
    return { status: "REJECTED", reason: "IDENTITY_BINDING_MISSING", diagnostics: sourceSnapshot.diagnostics };
  }
  if (!isIdentityBinding(identity)) {
    return { status: "REJECTED", reason: "MALFORMED_IDENTITY_BINDING", diagnostics: sourceSnapshot.diagnostics };
  }
  if (identity.runtimeShop.status !== "RESOLVED" || identity.runtimeShop.value.value !== options.document.shopId) {
    return { status: "REJECTED", reason: "RUNTIME_SHOP_MISMATCH", diagnostics: sourceSnapshot.diagnostics };
  }
  if (!sameScope(identity.scope, authoritativeScope)) {
    return { status: "REJECTED", reason: "CANONICAL_SCOPE_MISMATCH", diagnostics: sourceSnapshot.diagnostics };
  }

  const association = identity.association;
  if (association !== undefined) {
    if (association.ownerRuntimeShopId !== options.document.shopId) {
      return { status: "REJECTED", reason: "ASSOCIATION_RUNTIME_SHOP_MISMATCH", diagnostics: sourceSnapshot.diagnostics };
    }
    if (!sameScope(association.ownerScope, authoritativeScope)) {
      return { status: "REJECTED", reason: "ASSOCIATION_SCOPE_MISMATCH", diagnostics: sourceSnapshot.diagnostics };
    }
    if (sourceSnapshot.customerUid === undefined) {
      if (association.platformCustomerId !== undefined) {
        return { status: "REJECTED", reason: "CUSTOMER_ASSOCIATION_UNEXPECTED", diagnostics: sourceSnapshot.diagnostics };
      }
      if (association.internalConversationId.status === "RESOLVED") {
        return { status: "REJECTED", reason: "CONVERSATION_ASSOCIATION_UNBOUND", diagnostics: sourceSnapshot.diagnostics };
      }
    } else if (association.platformCustomerId !== sourceSnapshot.customerUid) {
      return { status: "REJECTED", reason: "CUSTOMER_ASSOCIATION_MISMATCH", diagnostics: sourceSnapshot.diagnostics };
    }

    if (sourceSnapshot.platformMessageId === undefined) {
      if (association.platformMessageId !== undefined) {
        return { status: "REJECTED", reason: "MESSAGE_ASSOCIATION_UNEXPECTED", diagnostics: sourceSnapshot.diagnostics };
      }
      if (association.localMessageId.status === "RESOLVED") {
        return { status: "REJECTED", reason: "LOCAL_MESSAGE_ASSOCIATION_UNBOUND", diagnostics: sourceSnapshot.diagnostics };
      }
    } else if (association.platformMessageId !== sourceSnapshot.platformMessageId) {
      return { status: "REJECTED", reason: "MESSAGE_ASSOCIATION_MISMATCH", diagnostics: sourceSnapshot.diagnostics };
    }
  }

  const sourceTime = normalizeSourceOccurredAt((options.input as PddInboundIngressInput).sourceOccurredAt);
  let mapped;
  try {
    mapped = mapPddInboundToCanonical({
      normalized: sourceSnapshot,
      identity,
      runtime: {
        sessionId: options.document.sessionId,
        documentGeneration: options.document.documentGeneration,
      },
      sourceOccurredAt: sourceTime.value,
    });
  } catch {
    return { status: "FAILED", reason: "MAPPER_THREW", diagnostics: Object.freeze([...sourceSnapshot.diagnostics, ...sourceTime.diagnostics]) };
  }
  const diagnostics = [...sourceSnapshot.diagnostics, ...sourceTime.diagnostics, ...mapped.diagnostics];
  if (mapped.status === "REJECTED") {
    return { status: "REJECTED", reason: mapped.reason, diagnostics: Object.freeze(diagnostics) };
  }

  const validation = validateCanonicalEnvelope(mapped.envelope, options.canonicalValidator);
  if (!validation.ok) {
    return { status: "FAILED", reason: validation.reason, diagnostics: Object.freeze(diagnostics) };
  }

  return { status: "MAPPED", envelope: mapped.envelope, diagnostics: Object.freeze(diagnostics) };
}