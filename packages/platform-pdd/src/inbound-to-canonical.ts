import type {
  ConversationExternalRef,
  ConversationId,
  CustomerExternalRef,
  IdentityLock,
  IdentityResolution,
  InboundEnvelope,
  MerchantId,
  MessageId,
  PlatformAccountId,
  PlatformMessageIdentity,
  RuntimeIdentityEvidence,
  RuntimeSelectedCustomerObservation,
  RuntimeShopRef,
  StoreId,
} from "@fastwork/domain";
import type { PddCanonicalInboundMessage } from "./inbound-normalizer.js";

/** Authoritative canonical scope supplied by Main for the active document. */
export interface PddCanonicalScopeBinding {
  readonly merchantId: IdentityResolution<MerchantId>;
  readonly storeId: IdentityResolution<StoreId>;
  readonly platformAccountId: IdentityResolution<PlatformAccountId>;
}

/**
 * Per-message association evidence. The source keys must match the normalized
 * message before the internal conversation/local message bindings are trusted.
 */
export interface PddInboundMessageAssociation {
  /** Runtime shop that owned the association at creation/resolution time. */
  readonly ownerRuntimeShopId: string;
  /** Canonical scope that owned the association at creation/resolution time. */
  readonly ownerScope: PddCanonicalScopeBinding;
  readonly platformCustomerId?: string;
  readonly platformMessageId?: string;
  readonly internalConversationId: IdentityResolution<ConversationId>;
  readonly localMessageId: IdentityResolution<MessageId>;
}

/**
 * Trusted binding supplied by Main for one controlled inbound observation.
 * Raw payload canonical IDs never establish this binding.
 */
export interface PddCanonicalIdentityBinding {
  readonly runtimeShop: IdentityResolution<RuntimeShopRef>;
  readonly scope: PddCanonicalScopeBinding;
  readonly runtimeConversationReference: IdentityResolution<ConversationExternalRef>;
  readonly association?: PddInboundMessageAssociation;
  readonly selectedCustomerObservation?: RuntimeSelectedCustomerObservation;
}

export interface PddCanonicalRuntimeBinding {
  readonly sessionId: string;
  readonly documentGeneration: number;
}

export interface MapPddInboundToCanonicalInput {
  readonly normalized: PddCanonicalInboundMessage;
  readonly identity: PddCanonicalIdentityBinding;
  readonly runtime: PddCanonicalRuntimeBinding;
  readonly sourceOccurredAt: string | null;
}

export type PddCanonicalMappingResult =
  | { status: "MAPPED"; envelope: InboundEnvelope; diagnostics: readonly string[] }
  | { status: "REJECTED"; reason: string; diagnostics: readonly string[] };

function freezeResolution<T>(resolution: IdentityResolution<T>): IdentityResolution<T> {
  if (resolution.status !== "RESOLVED") {
    return Object.freeze({ status: resolution.status }) as IdentityResolution<T>;
  }
  const value = cloneIdentityValue(resolution.value);
  return Object.freeze({ status: "RESOLVED", value }) as IdentityResolution<T>;
}

function cloneIdentityValue<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return Object.freeze({ ...(value as Record<string, unknown>) }) as T;
  }
  return value;
}

function mapPlatformMessageIdentity(platformMessageId: string | undefined): PlatformMessageIdentity {
  return platformMessageId === undefined
    ? Object.freeze({ provenance: "UNKNOWN" })
    : Object.freeze({ provenance: "AUTHORITATIVE_PLATFORM_ID", value: platformMessageId });
}

function mapPlatformCustomerId(customerUid: string | undefined): IdentityResolution<CustomerExternalRef> {
  return customerUid === undefined
    ? Object.freeze({ status: "UNKNOWN" })
    : Object.freeze({ status: "RESOLVED", value: Object.freeze({ value: customerUid }) });
}

function mapSelectedCustomerObservation(
  observation: RuntimeSelectedCustomerObservation | undefined,
): RuntimeSelectedCustomerObservation | undefined {
  if (observation === undefined) return undefined;
  if (observation.status !== "SELECTED") return Object.freeze({ status: observation.status });
  return Object.freeze({
    status: "SELECTED",
    platformCustomerId: Object.freeze({ value: observation.platformCustomerId.value }),
  });
}

function mapRuntimeEvidence(
  runtime: PddCanonicalRuntimeBinding,
  selectedCustomerObservation: RuntimeSelectedCustomerObservation | undefined,
): RuntimeIdentityEvidence {
  const observation = mapSelectedCustomerObservation(selectedCustomerObservation);
  return Object.freeze({
    sessionId: runtime.sessionId,
    documentGeneration: runtime.documentGeneration,
    ...(observation === undefined ? {} : { selectedCustomerObservation: observation }),
  });
}

function freezeDiagnostics(diagnostics: readonly string[]): readonly string[] {
  return Object.freeze([...diagnostics]);
}

/**
 * Pure PDD-to-canonical mapper.
 *
 * It builds a fresh immutable InboundEnvelope and performs no schema validation,
 * persistence, AI, target selection, or transport execution.
 */
export function mapPddInboundToCanonical(input: MapPddInboundToCanonicalInput): PddCanonicalMappingResult {
  const diagnostics = [...input.normalized.diagnostics];
  if (input.identity.runtimeShop.status !== "RESOLVED") {
    diagnostics.push("RUNTIME_SHOP_UNRESOLVED");
    return { status: "REJECTED", reason: "runtime_shop_unresolved", diagnostics: freezeDiagnostics(diagnostics) };
  }
  if (typeof input.runtime.sessionId !== "string" || input.runtime.sessionId.length === 0) {
    diagnostics.push("SESSION_ID_MISSING");
    return { status: "REJECTED", reason: "session_id_missing", diagnostics: freezeDiagnostics(diagnostics) };
  }
  if (!Number.isInteger(input.runtime.documentGeneration) || input.runtime.documentGeneration < 1) {
    diagnostics.push("DOCUMENT_GENERATION_INVALID");
    return { status: "REJECTED", reason: "document_generation_invalid", diagnostics: freezeDiagnostics(diagnostics) };
  }
  if (input.sourceOccurredAt !== null && typeof input.sourceOccurredAt !== "string") {
    diagnostics.push("SOURCE_TIME_INVALID");
    return { status: "REJECTED", reason: "source_time_invalid", diagnostics: freezeDiagnostics(diagnostics) };
  }

  const association = input.identity.association;
  const triggerMessage = Object.freeze({
    localMessageId: association === undefined
      ? Object.freeze({ status: "UNKNOWN" })
      : freezeResolution(association.localMessageId),
    platformMessageIdentity: mapPlatformMessageIdentity(input.normalized.platformMessageId),
  });

  const identityLock = Object.freeze({
    platform: "pdd",
    runtimeShop: freezeResolution(input.identity.runtimeShop),
    merchantId: freezeResolution(input.identity.scope.merchantId),
    storeId: freezeResolution(input.identity.scope.storeId),
    platformAccountId: freezeResolution(input.identity.scope.platformAccountId),
    platformCustomerId: mapPlatformCustomerId(input.normalized.customerUid),
    internalConversationId: association === undefined
      ? Object.freeze({ status: "UNKNOWN" })
      : freezeResolution(association.internalConversationId),
    runtimeConversationReference: freezeResolution(input.identity.runtimeConversationReference),
    triggerMessage,
    runtimeEvidence: mapRuntimeEvidence(input.runtime, input.identity.selectedCustomerObservation),
  });

  const envelope: InboundEnvelope = Object.freeze({
    identityLock,
    sourceContent: Object.freeze({ kind: "text", text: input.normalized.content }),
    sourceOccurredAt: input.sourceOccurredAt,
  });

  return { status: "MAPPED", envelope, diagnostics: freezeDiagnostics(diagnostics) };
}