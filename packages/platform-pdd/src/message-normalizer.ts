// M7 message normalizer (clean-room). Raw DOM scan -> canonical inbound message.
import type { NormalizedInboundMessage, RawDomMessage, RawDomScan } from "./types.js";

export interface NormalizeInput {
  shop_id: string;
  conversation_id: string;
  buyer_id?: string;
  raw: RawDomMessage;
}

/** Stable clean-room fallback fingerprint when no platform message id exists (DESIGN). */
export function fallbackFingerprint(msg: NormalizeInput): string {
  const parts = [msg.shop_id, msg.conversation_id, msg.raw.content, msg.raw.timestamp ?? "?"].join("|");
  let h = 0;
  for (let i = 0; i < parts.length; i++) {
    h = ((h << 5) - h + parts.charCodeAt(i)) | 0;
  }
  return "fp-" + (h >>> 0).toString(36);
}

export function normalizeMessage(input: NormalizeInput): NormalizedInboundMessage {
  const content = (input.raw.content ?? "").slice(0, 4000);
  const normalized: NormalizedInboundMessage = {
    platform: "pdd",
    shop_id: input.shop_id,
    conversation_id: input.conversation_id,
    buyer_id: input.buyer_id,
    buyer: input.raw.buyer,
    platform_message_id: input.raw.platform_message_id ?? fallbackFingerprint(input),
    message_type: "text",
    direction: "inbound",
    content,
    timestamp: input.raw.timestamp,
    product_context: input.raw.product_context,
    order_context: input.raw.order_context,
  };
  return normalized;
}

/** Normalize a full DOM scan in deterministic DOM order. */
export function normalizeScan(scan: RawDomScan, shopId: string): NormalizedInboundMessage[] {
  return scan.messages.map((raw) =>
    normalizeMessage({ shop_id: shopId, conversation_id: scan.conversation_id, buyer_id: scan.buyer_id, raw }),
  );
}
