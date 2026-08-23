// M8 platform-web-common page event builders (platform-neutral).
import type { NormalizedInboundMessage, PlatformPageEvent } from "./types.js";

export function buildPageReady(sessionId: string, status: string): PlatformPageEvent {
  return { event: "page_ready", session_id: sessionId, status };
}

export function buildLoginRequired(sessionId: string): PlatformPageEvent {
  return { event: "login_required", session_id: sessionId };
}

export function buildDomUnsupported(sessionId: string, reason: string): PlatformPageEvent {
  return { event: "dom_unsupported", session_id: sessionId, reason };
}

export function buildConversationChanged(sessionId: string, shopId: string, conversationId: string, buyerId?: string): PlatformPageEvent {
  return { event: "conversation_changed", session_id: sessionId, shop_id: shopId, conversation_id: conversationId, buyer_id: buyerId };
}

export function buildMessageReceived(sessionId: string, message: NormalizedInboundMessage): PlatformPageEvent {
  return {
    event: "message_received",
    session_id: sessionId,
    shop_id: message.shop_id,
    conversation_id: message.conversation_id,
    buyer_id: message.buyer_id,
    buyer: message.buyer,
    platform_message_id: message.platform_message_id,
    message_type: message.message_type,
    direction: message.direction,
    content: message.content,
    timestamp: message.timestamp,
  };
}

export function buildHumanReplyDetected(sessionId: string, shopId: string, conversationId: string, messageId?: string): PlatformPageEvent {
  return { event: "human_reply_detected", session_id: sessionId, shop_id: shopId, conversation_id: conversationId, platform_message_id: messageId };
}

export function buildSendAck(sessionId: string, shopId: string, conversationId: string, commandId: string, ok: boolean, error?: string): PlatformPageEvent {
  return { event: "send_ack", session_id: sessionId, shop_id: shopId, conversation_id: conversationId, command_id: commandId, ok, error };
}

export function buildTransferAck(sessionId: string, shopId: string, conversationId: string, commandId: string, ok: boolean, error?: string): PlatformPageEvent {
  return { event: "transfer_ack", session_id: sessionId, shop_id: shopId, conversation_id: conversationId, command_id: commandId, ok, error };
}
