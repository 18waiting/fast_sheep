// M7 PDD capability model (clean-room). Capability flags with explicit provenance.
import type { PddCapabilities } from "./types.js";

/**
 * PDD capability matrix (M7).
 * - send_image: GF-PLAT-001 expects imageSend capability and GF-PDD-004 expects a
 *   sendImage external call; the synthetic DOM contract implements a composer image
 *   path. Production DOM selector certainty remains PARTIAL.
 * - product_context / order_context: surfaced by the normalized message when the
 *   synthetic DOM provides product/order blocks (PARTIAL evidence).
 */
export const PDD_CAPABILITIES: PddCapabilities = {
  receive_text: true,
  send_text: true,
  send_image: true,
  manual_takeover_detection: true,
  conversation_selection: true,
  transfer: true,
  product_context: true,
  order_context: true,
  desktop_helper: false,
};

export const CAPABILITY_PROVENANCE: Record<keyof PddCapabilities, string> = {
  receive_text: "CONFIRMED (pdd-listener unRead badge; GF-PDD-001)",
  send_text: "PARTIAL (composer interaction from pdd-sender; synthetic DOM contract)",
  send_image: "PARTIAL (发图等待_*ms; GF-PLAT-001/GF-PDD-004)",
  manual_takeover_detection: "DESIGN (bounded automated-send ack registry)",
  conversation_selection: "CONFIRMED (conversation switching; GF-PDD fixtures)",
  transfer: "CONFIRMED surface (steps 1-3, 转接放弃话术; GF-PDD-005/006/007)",
  product_context: "PARTIAL (===== 拼多多订单信息 ===== block)",
  order_context: "PARTIAL (order-state handling)",
  desktop_helper: "CONFIRMED false (no PDD desktop helper)",
};

export function capabilities(): PddCapabilities {
  return { ...PDD_CAPABILITIES };
}

export function supportsCapability(name: keyof PddCapabilities): boolean {
  return PDD_CAPABILITIES[name] === true;
}
