import { validatorFor } from "@fastwork/contracts";
import type { InboundEnvelope } from "@fastwork/domain";
import {
  mapPddInboundToCanonical,
  normalizePddInboundForCanonical,
  type PddCanonicalIdentityBinding,
  type PddCanonicalInboundMessage,
} from "@fastwork/platform-pdd";
import type { PddInboundDocumentBinding } from "./pdd-session-host.js";

export type PddCanonicalEnvelopeValidator = (value: unknown) => boolean;

export interface PddInboundIngressInput {
  readonly payload: unknown;
  readonly sourceOccurredAt?: unknown;
}

export interface PddInboundIngressProcessOptions {
  readonly document: PddInboundDocumentBinding;
  readonly input: PddInboundIngressInput;
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

/**
 * Strict controlled-fixture source-time subset: ISO-8601 UTC with a mandatory
 * trailing Z, optional 1-9 fractional-second digits, and a real calendar date.
 */
function normalizeSourceOccurredAt(value: unknown): SourceTimeResult {
  if (value === undefined || value === null) {
    return Object.freeze({ value: null, diagnostics: Object.freeze(["SOURCE_TIME_MISSING"]) });
  }
  if (typeof value !== "string") {
    return Object.freeze({ value: null, diagnostics: Object.freeze(["SOURCE_TIME_INVALID"]) });
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/.exec(value);
  if (!match) {
    return Object.freeze({ value: null, diagnostics: Object.freeze(["SOURCE_TIME_INVALID"]) });
  }
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

export function processPddInboundIngress(options: PddInboundIngressProcessOptions): PddInboundIngressResult {
  const normalized = normalizePddInboundForCanonical(options.input.payload);
  if (normalized.status === "REJECTED") {
    return {
      status: "REJECTED",
      reason: normalized.reason,
      diagnostics: Object.freeze([...normalized.diagnostics]),
    };
  }

  let identity: PddCanonicalIdentityBinding | null;
  try {
    identity = options.resolveIdentity(normalized.value, options.document);
  } catch {
    return {
      status: "FAILED",
      reason: "IDENTITY_BINDING_RESOLVER_THREW",
      diagnostics: Object.freeze([...normalized.value.diagnostics]),
    };
  }
  if (identity === null) {
    return {
      status: "REJECTED",
      reason: "IDENTITY_BINDING_MISSING",
      diagnostics: Object.freeze([...normalized.value.diagnostics]),
    };
  }

  const sourceTime = normalizeSourceOccurredAt(options.input.sourceOccurredAt);
  const mapped = mapPddInboundToCanonical({
    normalized: normalized.value,
    identity,
    runtime: {
      sessionId: options.document.sessionId,
      documentGeneration: options.document.documentGeneration,
    },
    sourceOccurredAt: sourceTime.value,
  });
  const diagnostics = [...normalized.value.diagnostics, ...sourceTime.diagnostics, ...mapped.diagnostics];
  if (mapped.status === "REJECTED") {
    return { status: "REJECTED", reason: mapped.reason, diagnostics: Object.freeze(diagnostics) };
  }

  const validation = validateCanonicalEnvelope(mapped.envelope, options.canonicalValidator);
  if (!validation.ok) {
    return { status: "FAILED", reason: validation.reason, diagnostics: Object.freeze(diagnostics) };
  }

  return { status: "MAPPED", envelope: mapped.envelope, diagnostics: Object.freeze(diagnostics) };
}