// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { ConversationRepository, ConversationRecord, MessageRecord } from "../repositories/conversation-repository.js";
export class InMemoryConversationRepository implements ConversationRepository {
  private convs = new Map<string, ConversationRecord>();
  private msgs = new Map<string, MessageRecord>();
  ensureConversation(c: ConversationRecord): void { if (!this.convs.has(c.conversation_id)) this.convs.set(c.conversation_id, { ...c }); }
  appendMessage(msg: MessageRecord): void {
    this.msgs.set(msg.message_id, { ...msg });
    this.ensureConversation({ conversation_id: msg.conversation_id, shop_id: msg.shop_id, buyer: msg.buyer, started_at: msg.created_at, updated_at: msg.created_at, state: "active" });
    const c = this.convs.get(msg.conversation_id);
    if (c) { c.updated_at = msg.created_at; c.state = "active"; }
  }
  getConversation(id: string): ConversationRecord | undefined { const c = this.convs.get(id); return c ? { ...c } : undefined; }
  listMessages(conversationId: string, limit = 500): MessageRecord[] {
    return [...this.msgs.values()].filter((m) => m.conversation_id === conversationId).sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0)).slice(0, limit).map((m) => ({ ...m }));
  }
  queryByBuyer(buyer: string, shopId?: string): ConversationRecord[] {
    return [...this.convs.values()].filter((c) => c.buyer === buyer && (!shopId || c.shop_id === shopId)).map((c) => ({ ...c }));
  }
  queryRange(start: string, end: string): MessageRecord[] {
    return [...this.msgs.values()].filter((m) => m.created_at >= start && m.created_at <= end).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)).map((m) => ({ ...m }));
  }
}
