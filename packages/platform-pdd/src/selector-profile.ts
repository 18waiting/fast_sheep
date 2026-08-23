// M7 PDD selector profile (clean-room, versioned). Centralized selector strings only.
// Provenance is explicit; no CONFIRMED production selector is fabricated.

export type SelectorProvenance = "CONFIRMED" | "PARTIAL" | "DESIGN";

export interface SelectorEntry {
  key: string;
  purpose: string;
  primary: string;
  fallbacks?: string[];
  required: boolean;
  provenance: SelectorProvenance;
}

export interface SelectorProfile {
  version: string;
  platform: "pdd";
  entries: SelectorEntry[];
}

/**
 * Clean-room synthetic DOM contract for the PDD vertical slice (M7).
 * Exact production PDD merchant DOM selectors were NOT observed in the allowed
 * clean-room sources; these are narrow semantic selectors over the synthetic DOM
 * contract (data-fw-* attributes), so a mismatch fails safe (DOM_UNSUPPORTED).
 */
export const PDD_SELECTOR_PROFILE: SelectorProfile = {
  version: "pdd-dom-1.0.0",
  platform: "pdd",
  entries: [
    { key: "chat.list", purpose: "conversation list container", primary: "[data-fw-pdd-chat-list]", required: true, provenance: "DESIGN" },
    { key: "conversation.item", purpose: "a conversation row", primary: "[data-fw-pdd-conversation]", required: true, provenance: "DESIGN" },
    { key: "conversation.active", purpose: "active/selected conversation", primary: "[data-fw-pdd-conversation][data-active='true']", required: true, provenance: "DESIGN" },
    { key: "messages.container", purpose: "transcript container of active conversation", primary: "[data-fw-pdd-messages]", required: true, provenance: "DESIGN" },
    { key: "message.row", purpose: "a message bubble/row", primary: "[data-fw-pdd-message]", required: true, provenance: "DESIGN" },
    { key: "message.buyer", purpose: "buyer display name", primary: "[data-fw-pdd-buyer-name]", fallbacks: ["[data-fw-pdd-buyer]"], required: false, provenance: "DESIGN" },
    { key: "message.content", purpose: "message text", primary: "[data-fw-pdd-msg-content]", required: true, provenance: "DESIGN" },
    { key: "message.unread-badge", purpose: "unread indicator", primary: "[data-fw-pdd-unread]", required: false, provenance: "PARTIAL" },
    { key: "composer.input", purpose: "reply input", primary: "[data-fw-pdd-composer-input]", required: true, provenance: "DESIGN" },
    { key: "composer.send", purpose: "send control", primary: "[data-fw-pdd-send-btn]", required: true, provenance: "DESIGN" },
    { key: "composer.disabled", purpose: "send-disabled marker", primary: "[data-fw-pdd-send-disabled]", required: false, provenance: "DESIGN" },
    { key: "composer.image-input", purpose: "image asset input", primary: "[data-fw-pdd-image-input]", required: false, provenance: "DESIGN" },
    { key: "transfer.open", purpose: "transfer dialog trigger", primary: "[data-fw-pdd-transfer-open]", required: false, provenance: "PARTIAL" },
    { key: "transfer.target-list", purpose: "transfer target list", primary: "[data-fw-pdd-transfer-targets]", required: false, provenance: "PARTIAL" },
    { key: "transfer.target-item", purpose: "a transfer target row", primary: "[data-fw-pdd-transfer-target]", required: false, provenance: "PARTIAL" },
    { key: "transfer.confirm", purpose: "transfer confirm control", primary: "[data-fw-pdd-transfer-confirm]", required: false, provenance: "PARTIAL" },
    { key: "login.required", purpose: "login-required marker", primary: "[data-fw-pdd-login]", required: false, provenance: "DESIGN" },
    { key: "product.context", purpose: "product context block", primary: "[data-fw-pdd-product]", required: false, provenance: "PARTIAL" },
    { key: "order.context", purpose: "order context block", primary: "[data-fw-pdd-order]", required: false, provenance: "PARTIAL" },
  ],
};

export function selector(profile: SelectorProfile, key: string): SelectorEntry | undefined {
  return profile.entries.find((e) => e.key === key);
}

export function requiredSelectors(profile: SelectorProfile): SelectorEntry[] {
  return profile.entries.filter((e) => e.required);
}
