// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// SHEEP-019-B: conversation domain persistence (NormalizedConversation/Message/Ownership).
// SHEEP-063-PR1: message fact contract foundation (DP-83/86/87/88, I-12/I-13/I-15/I-16).
// Constraints:
// - No delete/hard-delete/tombstone operations.
// - Messages/Ownership carry NO merchantId (single fact source = conversation).
// - Ownership save is snapshot persistence ONLY (no transition engine / state<->owner
//   combination rules / authority validation).
// - externalRef stays OPAQUE (no unified external id semantics; I-13 internal
//   MessageId remains authoritative; no invented UNIQUE on external_ref).
// - Message actor is a CONVERSATION actor (customer | agent), never an LLM role
//   (DP-86, I-15). AI-assisted generation provenance is orthogonal and is NOT part
//   of the actor taxonomy.
// - Message content is typed + extensible, text-first (DP-88). Only 'text' kind is
//   supported in PR1; attachments/rich payload remain SHEEP-065.
// - Message time semantics are explicit (DP-87): occurred_at = source/platform
//   occurrence time (may be unknown); observed_at = Fast Sheep ingested time,
//   produced by the Main ingestion boundary (the repository never fabricates it).
// - NULL fact columns mean UNKNOWN (I-16): historical fact-less rows are preserved
//   as unknown; facts are never backfilled.

export interface NormalizedConversationRecord {
  id: string;
  merchantId: string;
  /** storeId is governance-CONFIRMED for conversations (SHEEP-013). */
  storeId: string;
  platformAccountId: string;
  /** Opaque platform-external conversation reference (optional). */
  externalRef?: string | null;
}

/** Conversation actor (DP-86 + I-15): customer | agent. NOT an LLM role. */
export type MessageActor = "customer" | "agent";

/** Message content kind (DP-88): text-first; only 'text' in PR1. */
export type MessageContentKind = "text";

export interface MessageRecord {
  id: string;
  conversationId: string;
  /** Opaque platform-external message reference (optional); no UNIQUE semantics. */
  externalRef?: string | null;
  /** Conversation actor (DP-86/I-15). NULL = unknown (I-16). */
  actor?: MessageActor | null;
  /** Typed content kind (DP-88); only 'text' in PR1. NULL = unknown content fact (I-16). */
  contentKind?: MessageContentKind | null;
  /** Text payload. Required when contentKind='text' for new writes (ingestion boundary). NULL = unknown. */
  contentText?: string | null;
  /** Source/platform occurrence time (DP-87), ISO-8601 UTC. NULL = unknown (may be absent at source). */
  occurredAt?: string | null;
  /** Fast Sheep observed/ingested time (DP-87), ISO-8601 UTC. Produced by the Main ingestion boundary. NULL = unknown (legacy). */
  observedAt?: string | null;
}

/** Ownership snapshot. ownerKind: null = no owner; "member" | "ai" = actor. */
export interface OwnershipRecord {
  conversationId: string;
  state: string;
  ownerKind?: "member" | "ai" | null;
  /** Member identity reference ONLY — no authority validation here. */
  ownerMemberId?: string | null;
}

export interface NormalizedConversationRepository {
  save(c: NormalizedConversationRecord): void;
  findById(id: string): NormalizedConversationRecord | null;
  listByMerchant(merchantId: string): NormalizedConversationRecord[];
  listByStore(storeId: string): NormalizedConversationRecord[];
}

export interface MessageRepository {
  save(m: MessageRecord): void;
  findById(id: string): MessageRecord | null;
  /** Deterministic, explainable timeline ordering (I-12): occurred_at known first
   *  (ascending), unknown occurred_at last, equal times tie-broken by internal id. */
  listByConversation(conversationId: string): MessageRecord[];
}

export interface OwnershipRepository {
  /** Snapshot persistence (upsert by conversation). NOT a transition engine. */
  save(o: OwnershipRecord): void;
  findById(conversationId: string): OwnershipRecord | null;
}
