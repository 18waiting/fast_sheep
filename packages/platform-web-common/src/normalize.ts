// M8 canonical message normalization (platform-neutral).
import type { NormalizedInboundMessage, RawDomMessage } from "./types.js";

export interface NormalizeInput {
  platform: string;
  shop_id: string;
  conversation_id: string;
  buyer_id?: string;
  raw: RawDomMessage;
}

export function fallbackFingerprint(msg: NormalizeInput): string {
  const parts = [msg.shop_id, msg.conversation_id, msg.raw.content, msg.raw.timestamp ?? "?"].join("|");
  let h = 0;
  for (let i = 0; i < parts.length; i++) h = ((h << 5) - h + parts.charCodeAt(i)) | 0;
  return "fp-" + (h >>> 0).toString(36);
}

export function normalizeMessage(input: NormalizeInput): NormalizedInboundMessage {
  return {
    platform: input.platform,
    shop_id: input.shop_id,
    conversation_id: input.conversation_id,
    buyer_id: input.buyer_id,
    buyer: input.raw.buyer,
    platform_message_id: input.raw.platform_message_id ?? fallbackFingerprint(input),
    message_type: "text",
    direction: "inbound",
    content: (input.raw.content ?? "").slice(0, 4000),
    timestamp: input.raw.timestamp,
    product_context: input.raw.product_context,
    order_context: input.raw.order_context,
  };
}
