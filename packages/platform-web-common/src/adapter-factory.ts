// M8 generic platform adapter factory (platform-neutral). Builds an M5
// PlatformAdapter implementation parameterized by platform id + capabilities.
import type { PlatformAdapter, SendAttempt, TransferDecision } from "@fastwork/orchestrator";
import type { PlatformCapabilities, PlatformPageCommand, PlatformPageCommandResult } from "./types.js";
import { PLATFORM_ERROR_CODES } from "./errors.js";
import { isCapabilitySupported } from "./capabilities.js";
import type { PlatformSessionState } from "./session-state.js";

export interface PlatformPageBridge {
  execute(command: PlatformPageCommand): Promise<PlatformPageCommandResult>;
}

export interface PlatformAdapterOptions {
  platform: string;
  bridge: PlatformPageBridge;
  session: PlatformSessionState;
  capabilities: PlatformCapabilities;
  commandIdFactory?: () => string;
}

function defaultCommandId(): string {
  return "cmd-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

export interface GenericPlatformAdapter extends PlatformAdapter {
  capabilities(): PlatformCapabilities;
  supports(capability: string): boolean;
  sendImage(shopId: string, conversationId: string, assetRef: string): Promise<SendAttempt>;
  executeTransfer(shopId: string, conversationId: string, decision: TransferDecision): Promise<{ ok: boolean; executed: boolean; error?: string; fallback_message?: string }>;
  sessionStatus(): string;
}

export function createPlatformAdapter(options: PlatformAdapterOptions): GenericPlatformAdapter {
  const commandId = options.commandIdFactory ?? defaultCommandId;
  const session = options.session;
  const caps = options.capabilities;
  const bridge = options.bridge;

  return {
    capabilities: () => ({ ...caps }),
    supports: (capability: string) => isCapabilitySupported(caps, capability),

    async sendText(shopId: string, conversationId: string, segments: string[]): Promise<SendAttempt> {
      if (!session.isReady()) return { ok: false, error: PLATFORM_ERROR_CODES.NOT_READY };
      if (!isCapabilitySupported(caps, "send_text")) return { ok: false, error: PLATFORM_ERROR_CODES.UNSUPPORTED_CAPABILITY };
      const segment = segments[0];
      if (typeof segment !== "string" || segment.length === 0) return { ok: true };
      const result = await bridge.execute({
        type: "send_text", command_id: commandId(), session_id: session.sessionId,
        shop_id: shopId, conversation_id: conversationId, text: segment,
      });
      if (!result.ok) return { ok: false, error: result.error ?? PLATFORM_ERROR_CODES.SEND_UNCERTAIN };
      return { ok: true, messageId: (result.result?.message_id as string | undefined) ?? undefined };
    },

    async sendImage(shopId: string, conversationId: string, assetRef: string): Promise<SendAttempt> {
      if (!session.isReady()) return { ok: false, error: PLATFORM_ERROR_CODES.NOT_READY };
      if (!isCapabilitySupported(caps, "send_image")) return { ok: false, error: PLATFORM_ERROR_CODES.UNSUPPORTED_CAPABILITY };
      const result = await bridge.execute({
        type: "send_image", command_id: commandId(), session_id: session.sessionId,
        shop_id: shopId, conversation_id: conversationId, asset_ref: assetRef,
      });
      return result.ok ? { ok: true, messageId: result.result?.message_id as string | undefined } : { ok: false, error: result.error };
    },

    async executeTransfer(shopId: string, conversationId: string, decision: TransferDecision) {
      if (!isCapabilitySupported(caps, "transfer")) {
        return { ok: false, executed: false, error: PLATFORM_ERROR_CODES.UNSUPPORTED_CAPABILITY };
      }
      if (!decision.requested || !decision.target) return { ok: false, executed: false, error: "no_target" };
      const result = await bridge.execute({
        type: "transfer", command_id: commandId(), session_id: session.sessionId,
        shop_id: shopId, conversation_id: conversationId, target: decision.target,
      });
      if (!result.ok) {
        return { ok: false, executed: false, error: result.error ?? PLATFORM_ERROR_CODES.TRANSFER_TARGET_UNAVAILABLE, fallback_message: result.result?.fallback_message as string | undefined };
      }
      return { ok: true, executed: true };
    },

    onTransfer(decision: TransferDecision): void {
      const shopId = (decision as { shop_id?: string }).shop_id;
      const conversationId = (decision as { conversation_id?: string }).conversation_id;
      if (!shopId || !conversationId) return;
      void this.executeTransfer(shopId, conversationId, decision).catch(() => undefined);
    },

    async getCurrentConversationState(shopId: string, conversationId: string): Promise<{ hasNewMessage: boolean }> {
      const result = await bridge.execute({
        type: "scan", command_id: commandId(), session_id: session.sessionId,
        shop_id: shopId, conversation_id: conversationId,
      });
      return { hasNewMessage: (result.result?.has_new_message as boolean | undefined) ?? false };
    },

    sessionStatus: () => session.getStatus(),
  };
}
