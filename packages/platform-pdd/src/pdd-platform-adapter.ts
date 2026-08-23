// M7 PddPlatformAdapter (clean-room). Implements the M5 PlatformAdapter interface
// as the PDD I/O boundary. Ownership boundaries:
// - sends EXACTLY ONE already-decided segment per sendText call (segmentation is M5-owned)
// - no segmented-send sleep (M5 SegmentedSender owns timing)
// - no forbidden-word filtering (M5 Main pre-send owns that)
// - no handoff target selection (M9 owns policy; executes explicit TransferDecision)
import type { PlatformAdapter, SendAttempt, TransferDecision } from "@fastwork/orchestrator";
import type { PddPageBridge } from "./pdd-page-bridge.js";
import type { PddSessionState } from "./session-state.js";
import { PDD_CAPABILITIES, supportsCapability } from "./capabilities.js";
import { PDD_ERROR_CODES, PddError } from "./errors.js";
import type { PddCapabilities, SendResult, TransferExecutionResult } from "./types.js";

export interface PddPlatformAdapterOptions {
  bridge: PddPageBridge;
  session: PddSessionState;
  commandIdFactory?: () => string;
}

function defaultCommandId(): string {
  return "cmd-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

export class PddPlatformAdapter implements PlatformAdapter {
  private readonly bridge: PddPageBridge;
  private readonly session: PddSessionState;
  private readonly commandId: () => string;

  constructor(options: PddPlatformAdapterOptions) {
    this.bridge = options.bridge;
    this.session = options.session;
    this.commandId = options.commandIdFactory ?? defaultCommandId;
  }

  capabilities(): PddCapabilities {
    return { ...PDD_CAPABILITIES };
  }

  supports(capability: keyof PddCapabilities): boolean {
    return supportsCapability(capability);
  }

  /** M5 PlatformAdapter.sendText: exactly one segment per call. */
  async sendText(shopId: string, conversationId: string, segments: string[]): Promise<SendAttempt> {
    if (!this.session.isReady()) {
      return { ok: false, error: PDD_ERROR_CODES.NOT_READY };
    }
    const segment = segments[0];
    if (typeof segment !== "string" || segment.length === 0) {
      // GF-ORCH-SEG-002: no empty send.
      return { ok: true };
    }
    const commandId = this.commandId();
    const result = await this.bridge.execute({
      type: "send_text",
      command_id: commandId,
      session_id: this.session.sessionId,
      shop_id: shopId,
      conversation_id: conversationId,
      text: segment,
    });
    if (!result.ok) {
      return { ok: false, error: result.error ?? PDD_ERROR_CODES.SEND_UNCERTAIN, messageId: undefined };
    }
    // Idempotency: bridge ack carries the deterministic message id.
    const messageId = (result.result?.message_id as string | undefined) ?? commandId;
    return { ok: true, messageId };
  }

  /** PDD image send (GF-PLAT-001 / GF-PDD-004). Exactly one asset. */
  async sendImage(shopId: string, conversationId: string, assetRef: string): Promise<SendAttempt> {
    if (!this.session.isReady()) return { ok: false, error: PDD_ERROR_CODES.NOT_READY };
    if (!this.supports("send_image")) return { ok: false, error: PDD_ERROR_CODES.UNSUPPORTED_CAPABILITY };
    const result = await this.bridge.execute({
      type: "send_image",
      command_id: this.commandId(),
      session_id: this.session.sessionId,
      shop_id: shopId,
      conversation_id: conversationId,
      asset_ref: assetRef,
    });
    return result.ok ? { ok: true, messageId: result.result?.message_id as string | undefined } : { ok: false, error: result.error };
  }

  /**
   * Execute an explicit TransferDecision. M7 never chooses a target; if the
   * requested target is unavailable the adapter returns a structured failure
   * (and may emit the 转接放弃话术 fallback, which the frozen fixture expects).
   */
  async executeTransfer(shopId: string, conversationId: string, decision: TransferDecision): Promise<TransferExecutionResult> {
    if (!decision.requested || !decision.target) {
      return { ok: false, executed: false, error: "no_target" };
    }
    const result = await this.bridge.execute({
      type: "transfer",
      command_id: this.commandId(),
      session_id: this.session.sessionId,
      shop_id: shopId,
      conversation_id: conversationId,
      target: decision.target,
    });
    if (!result.ok) {
      return {
        ok: false,
        executed: false,
        error: result.error ?? PDD_ERROR_CODES.TRANSFER_TARGET_UNAVAILABLE,
        fallback_message: result.result?.fallback_message as string | undefined,
      };
    }
    return { ok: true, executed: true };
  }

  /** M5 PlatformAdapter.onTransfer (sync boundary): fire-and-forget execution. */
  onTransfer(decision: TransferDecision): void {
    const shopId = (decision as { shop_id?: string }).shop_id;
    const conversationId = (decision as { conversation_id?: string }).conversation_id;
    if (!shopId || !conversationId) return;
    void this.executeTransfer(shopId, conversationId, decision).catch(() => undefined);
  }

  async getCurrentConversationState(shopId: string, conversationId: string): Promise<{ hasNewMessage: boolean }> {
    const result = await this.bridge.execute({
      type: "scan",
      command_id: this.commandId(),
      session_id: this.session.sessionId,
      shop_id: shopId,
      conversation_id: conversationId,
    });
    return { hasNewMessage: (result.result?.has_new_message as boolean | undefined) ?? false };
  }

  sessionStatus(): string {
    return this.session.getStatus();
  }

  static notFound(shopId: string): PddError {
    return new PddError(PDD_ERROR_CODES.NOT_FOUND, "unknown pdd shop: " + shopId);
  }
}
