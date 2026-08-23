// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { SqliteConnection } from "../db/sqlite-driver.js";
import type { ConversationRepository, ConversationRecord, MessageRecord } from "../repositories/conversation-repository.js";
import { runInTransaction } from "../db/transaction.js";

export class SqliteConversationRepository implements ConversationRepository {
  constructor(private conn: SqliteConnection) {}
  ensureConversation(c: ConversationRecord): void {
    this.conn.run("INSERT INTO conversations (conversation_id, shop_id, buyer, started_at, updated_at, state) VALUES (?,?,?,?,?,?) ON CONFLICT(conversation_id) DO NOTHING",
                  c.conversation_id, c.shop_id, c.buyer, c.started_at, c.updated_at, c.state);
  }
  appendMessage(msg: MessageRecord): void {
    runInTransaction(this.conn, () => {
      this.ensureConversation({ conversation_id: msg.conversation_id, shop_id: msg.shop_id, buyer: msg.buyer, started_at: msg.created_at, updated_at: msg.created_at, state: "active" });
      this.conn.run("INSERT INTO conversation_messages (message_id, conversation_id, shop_id, platform, buyer, type, content, role, created_at, product_context, order_context, metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                    msg.message_id, msg.conversation_id, msg.shop_id, msg.platform, msg.buyer, msg.type, msg.content, msg.role, msg.created_at,
                    msg.product_context !== undefined ? JSON.stringify(msg.product_context) : null,
                    msg.order_context !== undefined ? JSON.stringify(msg.order_context) : null,
                    msg.metadata !== undefined ? JSON.stringify(msg.metadata) : null);
      this.conn.run("UPDATE conversations SET updated_at = ?, state = 'active' WHERE conversation_id = ?", msg.created_at, msg.conversation_id);
    });
  }
  getConversation(id: string): ConversationRecord | undefined { return this.conn.get("SELECT conversation_id, shop_id, buyer, started_at, updated_at, state FROM conversations WHERE conversation_id = ?", id); }
  listMessages(conversationId: string, limit = 500): MessageRecord[] {
    return this.conn.all("SELECT message_id, conversation_id, shop_id, platform, buyer, type, content, role, created_at, product_context, order_context, metadata FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at, message_id LIMIT ?", conversationId, limit);
  }
  queryByBuyer(buyer: string, shopId?: string): ConversationRecord[] {
    return shopId
      ? this.conn.all("SELECT conversation_id, shop_id, buyer, started_at, updated_at, state FROM conversations WHERE buyer = ? AND shop_id = ? ORDER BY updated_at DESC", buyer, shopId)
      : this.conn.all("SELECT conversation_id, shop_id, buyer, started_at, updated_at, state FROM conversations WHERE buyer = ? ORDER BY updated_at DESC", buyer);
  }
  queryRange(start: string, end: string): MessageRecord[] {
    return this.conn.all("SELECT message_id, conversation_id, shop_id, platform, buyer, type, content, role, created_at FROM conversation_messages WHERE created_at >= ? AND created_at <= ? ORDER BY created_at", start, end);
  }
}
