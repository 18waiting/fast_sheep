// M6 orchestrator host: owns/accesses the M5 ConversationOrchestrator.
// The renderer never reaches the orchestrator directly; all access is via
// typed IPC through this host.
import type { ConversationOrchestrator } from "@fastwork/orchestrator";

export class OrchestratorHost {
  constructor(private readonly orchestrator: ConversationOrchestrator) {}

  get(): ConversationOrchestrator {
    return this.orchestrator;
  }

  async setMode(shopId: string, conversationId: string, mode: "human_review" | "full_auto"): Promise<void> {
    await this.orchestrator.onSetMode(shopId, conversationId, mode);
  }

  async manualSend(shopId: string, conversationId: string): Promise<void> {
    await this.orchestrator.onManualSend(shopId, conversationId, "Enter");
  }

  async noSaveSend(shopId: string, conversationId: string): Promise<void> {
    await this.orchestrator.onManualSend(shopId, conversationId, "Alt+Enter");
  }

  async cancel(shopId: string, conversationId: string): Promise<void> {
    await this.orchestrator.onCancel(shopId, conversationId);
  }

  focus(shopId: string): void {
    this.orchestrator.onFocusShop(shopId);
  }

  snapshot(shopId?: string): unknown {
    return shopId ? this.orchestrator.snapshot(shopId) : this.orchestrator.snapshot();
  }
}
