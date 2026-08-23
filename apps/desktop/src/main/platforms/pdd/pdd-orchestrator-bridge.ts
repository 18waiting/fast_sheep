// M7 PDD orchestrator bridge (clean-room). Forwards normalized inbound PDD events
// through the public M5 ConversationOrchestrator API. Never mutates orchestrator
// internals; no duplicated ConversationEngine.
import type { ConversationOrchestrator, BuyerMessage } from "@fastwork/orchestrator";

export interface PddInboundMessage {
  shop_id: string;
  conversation_id: string;
  buyer_id?: string;
  buyer?: string;
  platform_message_id?: string;
  content: string;
  timestamp?: string;
}

export class PddOrchestratorBridge {
  constructor(private readonly orchestrator: ConversationOrchestrator) {}

  async onInboundMessage(message: PddInboundMessage): Promise<void> {
    const msg: BuyerMessage = {
      message_id: message.platform_message_id,
      shop_id: message.shop_id,
      buyer: message.buyer,
      buyer_id: message.buyer_id,
      content: message.content,
      timestamp: message.timestamp,
    };
    await this.orchestrator.onBuyerMessage(message.shop_id, message.conversation_id, msg);
  }

  async onHumanReply(shopId: string, conversationId: string): Promise<void> {
    await this.orchestrator.onHumanTakeover(shopId, conversationId);
  }

  onConversationChange(shopId: string): void {
    this.orchestrator.onFocusShop(shopId);
  }
}
