// M5 test fake: in-memory conversation repository port.
export interface TurnRecord { shopId: string; conversationId: string; role: string; content: string; generation?: number }

export class InMemoryConversationRepositoryPort {
  turns: TurnRecord[] = [];
  async appendTurn(turn: { shopId: string; conversationId: string; role: string; content: string; generation?: number }): Promise<void> {
    this.turns.push({ shopId: turn.shopId, conversationId: turn.conversationId, role: turn.role, content: turn.content, generation: turn.generation });
  }
  get appendCount(): number { return this.turns.length; }
}
