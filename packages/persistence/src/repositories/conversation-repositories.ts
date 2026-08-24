// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// SHEEP-019-B: conversation domain persistence (NormalizedConversation/Message/Ownership).
// Constraints:
// - No delete/hard-delete/tombstone operations.
// - Messages/Ownership carry NO merchantId (single fact source = conversation).
// - Ownership save is snapshot persistence ONLY (no transition engine / state<->owner
//   combination rules / authority validation).
// - externalRef stays OPAQUE (no unified external id semantics).

export interface NormalizedConversationRecord {
  id: string;
  merchantId: string;
  /** storeId is governance-CONFIRMED for conversations (SHEEP-013). */
  storeId: string;
  platformAccountId: string;
  /** Opaque platform-external conversation reference (optional). */
  externalRef?: string | null;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  /** Opaque platform-external message reference (optional). */
  externalRef?: string | null;
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
  listByConversation(conversationId: string): MessageRecord[];
}

export interface OwnershipRepository {
  /** Snapshot persistence (upsert by conversation). NOT a transition engine. */
  save(o: OwnershipRecord): void;
  findById(conversationId: string): OwnershipRecord | null;
}