// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

import type {
  ConversationRepositoryPort,
  ConversationTurn,
} from "../ports/conversation-repository-port.js";

export interface PersistenceAppendTurn {
  shop_id?: string;
  conversation_id?: string;
  role?: string;
  content?: string;
  message_id?: string;
  generation?: number;
  [key: string]: unknown;
}

export interface PersistenceLike {
  appendTurn(turn: PersistenceAppendTurn): Promise<void> | void;
}

export class PersistenceConversationRepository implements ConversationRepositoryPort {
  constructor(private readonly persistence: PersistenceLike) {}

  async appendTurn(turn: ConversationTurn): Promise<void> {
    await this.persistence.appendTurn({
      shop_id: turn.shopId,
      conversation_id: turn.conversationId,
      role: turn.role,
      content: turn.content,
      message_id: turn.messageId,
      generation: turn.generation,
    });
  }
}