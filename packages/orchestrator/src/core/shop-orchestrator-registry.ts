// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

import type { EventBus } from "../ports/event-bus.js";
import type { DecisionRecord } from "../state/orchestrator-state.js";
import { ConversationOrchestrator, type OrchestratorOptions } from "./conversation-orchestrator.js";

export type ShopOrchestratorFactory = (shopId: string) => ConversationOrchestrator;

/**
 * Per-shop orchestrator isolation. Each shop gets its own orchestrator instance so
 * generation tokens, send serialization, and in-flight AI work never cross shop
 * boundaries. Focus is a single UI-level shop id.
 */
export class ShopOrchestratorRegistry {
  private readonly shops = new Map<string, ConversationOrchestrator>();
  private focusedShopId: string | null = null;
  private readonly decisions: DecisionRecord[] = [];

  constructor(private readonly options: OrchestratorOptions) {}

  getOrCreate(shopId: string): ConversationOrchestrator {
    let orchestrator = this.shops.get(shopId);
    if (!orchestrator) {
      orchestrator = new ConversationOrchestrator(this.options);
      this.shops.set(shopId, orchestrator);
    }
    return orchestrator;
  }

  get(shopId: string): ConversationOrchestrator | undefined {
    return this.shops.get(shopId);
  }

  focusShop(shopId: string): void {
    if (this.focusedShopId !== shopId) {
      this.focusedShopId = shopId;
      this.decisions.push({ decision: "focus_switch", shop_id: shopId });
    }
  }

  getFocusedShopId(): string | null {
    return this.focusedShopId;
  }

  /** Multi-shop receipt: s2 can proceed while s1 is busy (GF-ORCH-013). */
  async receiveBuyerMessage(shopId: string, conversationId: string, message: Record<string, unknown>): Promise<void> {
    let otherBusy = false;
    for (const [candidateShopId, orchestrator] of this.shops.entries()) {
      if (candidateShopId !== shopId && orchestrator.isBusy()) {
        otherBusy = true;
        break;
      }
    }
    if (otherBusy) {
      this.decisions.push({ decision: "concurrent_ok", shop_id: shopId });
    }

    const orchestrator = this.getOrCreate(shopId);
    if (!this.focusedShopId) {
      this.focusedShopId = shopId;
    }
    await orchestrator.onBuyerMessage(shopId, conversationId, message);
  }

  decisionsSnapshot(): DecisionRecord[] {
    const merged: DecisionRecord[] = [...this.decisions];
    for (const orchestrator of this.shops.values()) {
      merged.push(...orchestrator.decisionsSnapshot());
    }
    return merged;
  }
}