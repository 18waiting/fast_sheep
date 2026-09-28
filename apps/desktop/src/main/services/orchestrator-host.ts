//
// ═══════════════════════════════════════════════════════════════════════════════
// Shop vs Store 语义说明（参见 docs/architecture/SHOP_VS_STORE_SEMANTICS.md）
// ═══════════════════════════════════════════════════════════════════════════════
//
// 本文件中的 `shopId` 参数属于 **运行时/UI 层** 概念（Shop），表示：
// - 用户当前激活的会话上下文
// - 平台会话的管理标识
//
// 在领域模型层，`shopId` 实际上是 **Store.id** 的引用。
// 所有跨域转换必须通过 apps/desktop/src/main/services/shop-store-mapper.ts
// ═══════════════════════════════════════════════════════════════════════════════
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
