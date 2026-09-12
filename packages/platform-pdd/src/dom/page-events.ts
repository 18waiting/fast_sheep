// M7 page event builder (clean-room). Builds normalized PageEvent payloads.
import type {
  NormalizedInboundMessage,
  PddPageEvent,
  PddSelectedCustomerObservedEvent,
  RawDomScan,
} from "../types.js";
import type { SelectedCustomerObservation } from "./selected-customer-reader.js";

export function buildPageReady(sessionId: string, status: string): PddPageEvent {
  return { event: "page_ready", session_id: sessionId, status };
}

export function buildLoginRequired(sessionId: string): PddPageEvent {
  return { event: "login_required", session_id: sessionId };
}

export function buildDomUnsupported(sessionId: string, reason: string): PddPageEvent {
  return { event: "dom_unsupported", session_id: sessionId, reason };
}

export function buildAuthReauthRequired(sessionId: string): PddPageEvent {
  return { event: "auth_reauth_required", session_id: sessionId, reason: "AUTH_REAUTH_REQUIRED" };
}

export function buildConversationChanged(sessionId: string, shopId: string, conversationId: string, buyerId?: string): PddPageEvent {
  return { event: "conversation_changed", session_id: sessionId, shop_id: shopId, conversation_id: conversationId, buyer_id: buyerId };
}

export function buildMessageReceived(sessionId: string, message: NormalizedInboundMessage): PddPageEvent {
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

export function buildHumanReplyDetected(sessionId: string, shopId: string, conversationId: string, messageId?: string): PddPageEvent {
  return { event: "human_reply_detected", session_id: sessionId, shop_id: shopId, conversation_id: conversationId, platform_message_id: messageId };
}

export function buildSendAck(sessionId: string, shopId: string, conversationId: string, commandId: string, ok: boolean, error?: string): PddPageEvent {
  return { event: "send_ack", session_id: sessionId, shop_id: shopId, conversation_id: conversationId, command_id: commandId, ok, error };
}

export function buildTransferAck(sessionId: string, shopId: string, conversationId: string, commandId: string, ok: boolean, error?: string): PddPageEvent {
  return { event: "transfer_ack", session_id: sessionId, shop_id: shopId, conversation_id: conversationId, command_id: commandId, ok, error };
}

export function buildSelectedCustomerObserved(
  sessionId: string,
  shopId: string,
  observation: SelectedCustomerObservation,
): PddSelectedCustomerObservedEvent {
  if (observation.status === "SELECTED") {
    return {
      event: "selected_customer_observed",
      session_id: sessionId,
      shop_id: shopId,
      status: "SELECTED",
      customer_uid: observation.customerUid,
    };
  }
  return {
    event: "selected_customer_observed",
    session_id: sessionId,
    shop_id: shopId,
    status: observation.status,
  };
}

export function scanToMessages(scan: RawDomScan): NormalizedInboundMessage[] {
  return scan.messages
    .filter((m) => m.unread || true)
    .map((m) => ({
      platform: "pdd",
      shop_id: "",
      conversation_id: scan.conversation_id,
      buyer_id: scan.buyer_id,
      buyer: m.buyer,
      platform_message_id: m.platform_message_id,
      message_type: "text",
      direction: "inbound",
      content: m.content,
      timestamp: m.timestamp,
      product_context: m.product_context,
      order_context: m.order_context,
    }));
}
