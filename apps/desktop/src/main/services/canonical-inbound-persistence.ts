// SHEEP-302 (bounded, offline slice): canonical inbound -> normalized persistence.
//
// Contract:
// - Consumes a canonical InboundEnvelope produced by the accepted SHEEP-301
//   controlled ingress path (trusted Main observer -> admission -> mapper ->
//   default canonical validator). It never re-derives or re-maps identity.
// - Writes only when canonical scope is RESOLVED (merchant/store/platformAccount
//   and internal conversation id). runtime Shop is runtime-only evidence and is
//   NEVER substituted for canonical Store or PlatformAccount.
// - UNKNOWN / UNRESOLVED identity or owner scope is rejected explicitly; it is
//   never guessed, defaulted, or written into another conversation.
// - Dedup is identity-scoped: the same source message is persisted once, while
//   identical opaque platform ids in different conversations or shops stay
//   separate rows. No locally-derived digest is promoted to an authoritative platform id.
// - observedAt is produced here (trusted Main ingestion time, DP-87); occurredAt
//   stays the source time or null when the source did not supply one.
// - No AI, no send, no aggregation, no scene/context classification.
import { createHash } from "node:crypto";
import type { InboundEnvelope } from "@fastwork/domain";
import type {
  MessageRecord,
  MessageRepository,
  NormalizedConversationRecord,
  NormalizedConversationRepository,
} from "@fastwork/persistence";

export type CanonicalInboundPersistenceStatus = "INGESTED" | "DUPLICATE";

export interface CanonicalInboundPersistenceResult {
  readonly status: CanonicalInboundPersistenceStatus;
  readonly conversationId: string;
  readonly messageId: string;
  readonly dedupeKey: string;
}

export class CanonicalInboundPersistenceError extends Error {
  readonly reason:
    | "IDENTITY_NOT_RESOLVED"
    | "SCOPE_NOT_RESOLVED"
    | "CONTENT_NOT_TEXT"
    | "CONVERSATION_SCOPE_CONFLICT"
    | "STORAGE_FAILED";
  constructor(reason: CanonicalInboundPersistenceError["reason"], message: string) {
    super(message);
    this.name = "CanonicalInboundPersistenceError";
    this.reason = reason;
  }
}

export interface CanonicalInboundPersistenceOptions {
  conversations: NormalizedConversationRepository;
  messages: MessageRepository;
  /** Trusted Main ingestion clock; defaults to the real UTC clock. */
  now?: () => string;
}

export interface CanonicalInboundPersistence {
  ingest(envelope: InboundEnvelope): CanonicalInboundPersistenceResult;
}

function hashId(parts: readonly string[]): string {
  // Null separator keeps parts distinct so concatenation cannot alias two keys.
  return createHash("sha256").update(parts.join("\u0000"), "utf8").digest("hex").slice(0, 40);
}

/**
 * Read the conversation external reference through its CONTRACT shape
 * (`ConversationExternalRef` = `{ value: string }`).
 *
 * Defect history: this used to be `String(lock.runtimeConversationReference.value)`, which turned a
 * valid contract-shaped reference into the literal "[object Object]" and stored that fabricated
 * string as the conversation's external reference - an implicit object-to-string conversion taking
 * the place of an identifier. Anything that is not the contract shape is now explicitly UNKNOWN
 * (null): an absent reference is never invented.
 */
function conversationExternalRef(reference: InboundEnvelope["identityLock"]["runtimeConversationReference"]): string | null {
  if (reference.status !== "RESOLVED") return null;
  const value: unknown = reference.value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length !== 1 || keys[0] !== "value") return null;
  const inner = (value as { value?: unknown }).value;
  if (typeof inner !== "string" || inner.length === 0) return null;
  return inner;
}

function messageIdentityKey(envelope: InboundEnvelope): string | null {
  const identity = envelope.identityLock.triggerMessage.platformMessageIdentity;
  // Provenance kinds stay distinct so a locally-derived digest is never treated as
  // an authoritative platform id. Unknown identity returns null (never deduped).
  switch (identity.provenance) {
    case "AUTHORITATIVE_PLATFORM_ID":
      return "authoritative:" + identity.value;
    case "LOCAL_FINGERPRINT":
      return "local-derived:" + identity.value;
    case "SYNTHETIC":
      return "synthetic:" + identity.value;
    default:
      return null;
  }
}

export function createCanonicalInboundPersistence(
  options: CanonicalInboundPersistenceOptions
): CanonicalInboundPersistence {
  const { conversations, messages } = options;
  const now = options.now ?? (() => new Date().toISOString());

  function ingest(envelope: InboundEnvelope): CanonicalInboundPersistenceResult {
    const lock = envelope.identityLock;

    // Canonical scope is required. Runtime shop / external runtime reference are
    // evidence only and can never stand in for canonical scope.
    if (lock.merchantId.status !== "RESOLVED") {
      throw new CanonicalInboundPersistenceError(
        "SCOPE_NOT_RESOLVED",
        "canonical merchantId is required before an inbound message can be persisted"
      );
    }
    if (lock.storeId.status !== "RESOLVED") {
      throw new CanonicalInboundPersistenceError(
        "SCOPE_NOT_RESOLVED",
        "canonical storeId is required before an inbound message can be persisted"
      );
    }
    if (lock.platformAccountId.status !== "RESOLVED") {
      throw new CanonicalInboundPersistenceError(
        "SCOPE_NOT_RESOLVED",
        "canonical platformAccountId is required before an inbound message can be persisted"
      );
    }
    if (lock.internalConversationId.status !== "RESOLVED") {
      throw new CanonicalInboundPersistenceError(
        "IDENTITY_NOT_RESOLVED",
        "internal conversation id is required before an inbound message can be persisted"
      );
    }

    const merchantId = String(lock.merchantId.value);
    const storeId = String(lock.storeId.value);
    const platformAccountId = String(lock.platformAccountId.value);
    const conversationId = String(lock.internalConversationId.value);
    const platform = String(lock.platform);

    if (envelope.sourceContent.kind !== "text") {
      throw new CanonicalInboundPersistenceError(
        "CONTENT_NOT_TEXT",
        "only typed text inbound content is persisted in this slice"
      );
    }

    const identityKey = messageIdentityKey(envelope);
    // Dedup scope: platform + canonical conversation + message identity provenance.
    // Unknown message identity is never deduped against another unknown message.
    const dedupeKey = hashId([
      "inbound",
      platform,
      conversationId,
      identityKey ?? "unknown",
    ]);
    const messageId = "msg-inbound-" + dedupeKey;

    try {
      // Scope check FIRST: conversation identity is the bare conversation id, so a caller that
      // derives an unscoped id (for example only from a platform customer id) would make two
      // shops share one conversation - and the dedupe key below would then silently treat the
      // other shop's message as a duplicate. Attaching a message to a conversation owned by a
      // different merchant/store/platform account fails closed instead.
      const existingConversation = conversations.findById(conversationId);
      if (existingConversation
        && (existingConversation.merchantId !== merchantId
          || existingConversation.storeId !== storeId
          || existingConversation.platformAccountId !== platformAccountId)) {
        throw new CanonicalInboundPersistenceError(
          "CONVERSATION_SCOPE_CONFLICT",
          "conversation id already belongs to a different canonical scope; refusing to mix shops"
        );
      }

      const existing = messages.findById(messageId);
      if (existing) {
        return { status: "DUPLICATE", conversationId, messageId, dedupeKey };
      }

      if (!existingConversation) {
        const record: NormalizedConversationRecord = {
          id: conversationId,
          merchantId,
          storeId,
          platformAccountId,
          externalRef: conversationExternalRef(lock.runtimeConversationReference),
        };
        conversations.save(record);
      }

      const message: MessageRecord = {
        id: messageId,
        conversationId,
        externalRef: identityKey === null ? null : identityKey.slice(identityKey.indexOf(":") + 1),
        actor: "customer",
        contentKind: "text",
        contentText: envelope.sourceContent.text,
        occurredAt: envelope.sourceOccurredAt ?? null,
        observedAt: now(),
      };
      messages.save(message);
      return { status: "INGESTED", conversationId, messageId, dedupeKey };
    } catch (error) {
      if (error instanceof CanonicalInboundPersistenceError) throw error;
      throw new CanonicalInboundPersistenceError(
        "STORAGE_FAILED",
        "inbound persistence write failed: " + String((error as { message?: unknown })?.message ?? error)
      );
    }
  }

  return { ingest };
}
