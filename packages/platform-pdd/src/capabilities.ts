// M7 PDD capability model (clean-room). Capability flags with explicit provenance.
import type { PddCapabilities } from "./types.js";

export type PddCapabilityMaturity =
  | "OBSERVATION_ONLY"
  | "LOCAL_CONTRACT_ONLY"
  | "SYNTHETIC_ONLY"
  | "NOT_IMPLEMENTED";

export interface PddCapabilityDescriptor {
  declared: boolean;
  maturity: PddCapabilityMaturity;
  provenance: string;
}

/** Canonical PDD capability descriptors. Booleans below are derived compatibility data. */
export const PDD_CAPABILITY_DESCRIPTORS: Record<keyof PddCapabilities, PddCapabilityDescriptor> = {
  receive_text: { declared: true, maturity: "OBSERVATION_ONLY", provenance: "live observation + local event contract; no production producer wiring" },
  send_text: { declared: true, maturity: "LOCAL_CONTRACT_ONLY", provenance: "local send contract + historical application-acceptance evidence; transport not integrated" },
  send_image: { declared: true, maturity: "SYNTHETIC_ONLY", provenance: "synthetic DOM composer path; exact production media contract not established" },
  manual_takeover_detection: { declared: true, maturity: "LOCAL_CONTRACT_ONLY", provenance: "local bounded acknowledgement classification; production semantics not established" },
  conversation_selection: { declared: true, maturity: "OBSERVATION_ONLY", provenance: "live selected-buyer observation + transient local reader; durable conversation identity unresolved" },
  transfer: { declared: true, maturity: "SYNTHETIC_ONLY", provenance: "synthetic DOM transfer path; production platform contract not established" },
  product_context: { declared: true, maturity: "SYNTHETIC_ONLY", provenance: "synthetic/compatibility context block; verified PDD product producer absent" },
  order_context: { declared: true, maturity: "SYNTHETIC_ONLY", provenance: "synthetic/compatibility context block; verified PDD order producer absent" },
  desktop_helper: { declared: false, maturity: "NOT_IMPLEMENTED", provenance: "no PDD desktop helper" },
};

function declaredCapabilities(): PddCapabilities {
  return {
    receive_text: PDD_CAPABILITY_DESCRIPTORS.receive_text.declared,
    send_text: PDD_CAPABILITY_DESCRIPTORS.send_text.declared,
    send_image: PDD_CAPABILITY_DESCRIPTORS.send_image.declared,
    manual_takeover_detection: PDD_CAPABILITY_DESCRIPTORS.manual_takeover_detection.declared,
    conversation_selection: PDD_CAPABILITY_DESCRIPTORS.conversation_selection.declared,
    transfer: PDD_CAPABILITY_DESCRIPTORS.transfer.declared,
    product_context: PDD_CAPABILITY_DESCRIPTORS.product_context.declared,
    order_context: PDD_CAPABILITY_DESCRIPTORS.order_context.declared,
    desktop_helper: PDD_CAPABILITY_DESCRIPTORS.desktop_helper.declared,
  };
}

/**
 * PDD capability matrix (M7).
 * - send_image: GF-PLAT-001 expects imageSend capability and GF-PDD-004 expects a
 *   sendImage external call; the synthetic DOM contract implements a composer image
 *   path. Production DOM selector certainty remains PARTIAL.
 * - product_context / order_context: surfaced by the normalized message when the
 *   synthetic DOM provides product/order blocks (PARTIAL evidence).
 */
export const PDD_CAPABILITIES: PddCapabilities = declaredCapabilities();

export const CAPABILITY_PROVENANCE: Record<keyof PddCapabilities, string> = Object.fromEntries(
  Object.entries(PDD_CAPABILITY_DESCRIPTORS).map(([name, descriptor]) => [name, descriptor.provenance]),
) as Record<keyof PddCapabilities, string>;

export function capabilities(): PddCapabilities {
  return { ...PDD_CAPABILITIES };
}

export function supportsCapability(name: keyof PddCapabilities): boolean {
  return PDD_CAPABILITIES[name] === true;
}
