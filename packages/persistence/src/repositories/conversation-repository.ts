// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
export interface ConversationRecord { conversation_id: string; shop_id: string; buyer: string; started_at: string; updated_at: string; state: string; }
export interface MessageRecord { message_id: string; conversation_id: string; shop_id: string; platform: string; buyer: string; type: string; content: string; role: string; created_at: string; product_context?: unknown; order_context?: unknown; metadata?: unknown; }
export interface ConversationRepository {
  appendMessage(msg: MessageRecord): void;          // atomic: insert message + bump conversation.updated_at
  ensureConversation(c: ConversationRecord): void;
  getConversation(id: string): ConversationRecord | undefined;
  listMessages(conversationId: string, limit?: number): MessageRecord[];
  queryByBuyer(buyer: string, shopId?: string): ConversationRecord[];
  queryRange(start: string, end: string): MessageRecord[];
}
