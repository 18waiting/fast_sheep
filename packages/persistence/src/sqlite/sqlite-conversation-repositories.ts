// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// SHEEP-019-B: Sqlite implementations for conversation domain repositories.
// SHEEP-063-PR1: SqliteMessageRepository persists the typed message fact contract
// (DP-83/86/87/88) — actor/content/time/provenance. NULL = unknown (I-16); the
// repository persists facts as given and never fabricates provenance.
import type { SqliteConnection } from "../db/sqlite-driver.js";
import type {
  NormalizedConversationRecord, MessageRecord, OwnershipRecord, MessageActor, MessageContentKind,
  NormalizedConversationRepository, MessageRepository, OwnershipRepository,
} from "../repositories/conversation-repositories.js";

interface NConvRow { id: string; merchant_id: string; store_id: string; platform_account_id: string; external_ref: string | null; }
interface MsgRow { id: string; conversation_id: string; external_ref: string | null; actor: string | null; content_kind: string | null; content_text: string | null; occurred_at: string | null; observed_at: string | null; }
interface OwnRow { conversation_id: string; state: string; owner_kind: string | null; owner_member_id: string | null; }

const MSG_COLUMNS = "id, conversation_id, external_ref, actor, content_kind, content_text, occurred_at, observed_at";

function mapMsgRow(r: MsgRow): MessageRecord {
  // Unknown / out-of-contract values map to null (unknown), never fabricated.
  const actor: MessageActor | null = r.actor === "customer" || r.actor === "agent" ? r.actor : null;
  const contentKind: MessageContentKind | null = r.content_kind === "text" ? "text" : null;
  return {
    id: r.id,
    conversationId: r.conversation_id,
    externalRef: r.external_ref,
    actor,
    contentKind,
    contentText: r.content_text,
    occurredAt: r.occurred_at,
    observedAt: r.observed_at,
  };
}

export class SqliteNormalizedConversationRepository implements NormalizedConversationRepository {
  constructor(private conn: SqliteConnection) {}
  save(c: NormalizedConversationRecord): void {
    this.conn.run(
      "INSERT INTO normalized_conversations (id, merchant_id, store_id, platform_account_id, external_ref) VALUES (?, ?, ?, ?, ?)",
      c.id, c.merchantId, c.storeId, c.platformAccountId, c.externalRef ?? null
    );
  }
  findById(id: string): NormalizedConversationRecord | null {
    const r = this.conn.get<NConvRow | undefined>(
      "SELECT id, merchant_id, store_id, platform_account_id, external_ref FROM normalized_conversations WHERE id = ?", id
    );
    return r ? { id: r.id, merchantId: r.merchant_id, storeId: r.store_id, platformAccountId: r.platform_account_id, externalRef: r.external_ref } : null;
  }
  listByMerchant(merchantId: string): NormalizedConversationRecord[] {
    return this.conn.all<NConvRow>(
      "SELECT id, merchant_id, store_id, platform_account_id, external_ref FROM normalized_conversations WHERE merchant_id = ? ORDER BY id", merchantId
    ).map((r) => ({ id: r.id, merchantId: r.merchant_id, storeId: r.store_id, platformAccountId: r.platform_account_id, externalRef: r.external_ref }));
  }
  listByStore(storeId: string): NormalizedConversationRecord[] {
    return this.conn.all<NConvRow>(
      "SELECT id, merchant_id, store_id, platform_account_id, external_ref FROM normalized_conversations WHERE store_id = ? ORDER BY id", storeId
    ).map((r) => ({ id: r.id, merchantId: r.merchant_id, storeId: r.store_id, platformAccountId: r.platform_account_id, externalRef: r.external_ref }));
  }
}

export class SqliteMessageRepository implements MessageRepository {
  constructor(private conn: SqliteConnection) {}
  save(m: MessageRecord): void {
    this.conn.run(
      "INSERT INTO normalized_messages (id, conversation_id, external_ref, actor, content_kind, content_text, occurred_at, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      m.id, m.conversationId, m.externalRef ?? null, m.actor ?? null, m.contentKind ?? null, m.contentText ?? null, m.occurredAt ?? null, m.observedAt ?? null
    );
  }
  findById(id: string): MessageRecord | null {
    const r = this.conn.get<MsgRow | undefined>(`SELECT ${MSG_COLUMNS} FROM normalized_messages WHERE id = ?`, id);
    return r ? mapMsgRow(r) : null;
  }
  // I-12: deterministic, explainable timeline ordering. occurred_at known first
  // (ascending); unknown occurred_at last; equal times tie-broken by internal id.
  // Local ingestion order (observed_at) is never used as source/platform absolute order.
  listByConversation(conversationId: string): MessageRecord[] {
    return this.conn.all<MsgRow>(
      `SELECT ${MSG_COLUMNS} FROM normalized_messages WHERE conversation_id = ? ORDER BY (occurred_at IS NULL), occurred_at, id`,
      conversationId
    ).map(mapMsgRow);
  }
}

export class SqliteOwnershipRepository implements OwnershipRepository {
  constructor(private conn: SqliteConnection) {}
  // Snapshot persistence (upsert by conversation_id). NOT a transition engine:
  // no state<->owner combination checks, no canTransition/claim/release/handoff logic,
  // no authority validation of ownerMemberId.
  save(o: OwnershipRecord): void {
    this.conn.run(
      "INSERT OR REPLACE INTO ownership_records (conversation_id, state, owner_kind, owner_member_id) VALUES (?, ?, ?, ?)",
      o.conversationId, o.state, o.ownerKind ?? null, o.ownerMemberId ?? null
    );
  }
  findById(conversationId: string): OwnershipRecord | null {
    const r = this.conn.get<OwnRow | undefined>(
      "SELECT conversation_id, state, owner_kind, owner_member_id FROM ownership_records WHERE conversation_id = ?", conversationId
    );
    if (!r) return null;
    const ownerKind = r.owner_kind === "member" || r.owner_kind === "ai" ? r.owner_kind : null;
    return { conversationId: r.conversation_id, state: r.state, ownerKind, ownerMemberId: r.owner_member_id };
  }
}
