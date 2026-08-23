// M8 platform-neutral selector profile type + helpers.
export type SelectorProvenance = "CONFIRMED" | "PARTIAL" | "DESIGN" | "UNKNOWN";

export interface SelectorEntry {
  key: string;
  semantic_purpose: string;
  primary: string;
  fallbacks?: string[];
  required: boolean;
  provenance: SelectorProvenance;
}

export interface SelectorProfile {
  version: string;
  platform: string;
  entries: SelectorEntry[];
}

export function selector(profile: SelectorProfile, key: string): SelectorEntry | undefined {
  return profile.entries.find((e) => e.key === key);
}

export function requiredSelectors(profile: SelectorProfile): SelectorEntry[] {
  return profile.entries.filter((e) => e.required);
}

/**
 * Build the standard clean-room synthetic DOM profile for a platform id.
 * All selectors use narrow data-fw-<platform>-* attributes; provenance is
 * PARTIAL/DESIGN (exact production DOM is not evidence-backed). Platform-neutral.
 */
export function syntheticProfile(platform: string, version: string): SelectorProfile {
  const p = (key: string) => "[data-fw-" + platform + "-" + key + "]";
  return {
    version,
    platform,
    entries: [
      { key: "chat.list", semantic_purpose: "conversation list container", primary: p("chat-list"), required: true, provenance: "DESIGN" },
      { key: "conversation.item", semantic_purpose: "a conversation row", primary: p("conversation"), required: true, provenance: "DESIGN" },
      { key: "conversation.active", semantic_purpose: "active conversation", primary: p("conversation") + "[data-active='true']", required: true, provenance: "DESIGN" },
      { key: "messages.container", semantic_purpose: "transcript container", primary: p("messages"), required: true, provenance: "DESIGN" },
      { key: "message.row", semantic_purpose: "a message row", primary: p("message"), required: true, provenance: "DESIGN" },
      { key: "message.buyer", semantic_purpose: "buyer display name", primary: p("buyer-name"), fallbacks: [p("buyer")], required: false, provenance: "DESIGN" },
      { key: "message.content", semantic_purpose: "message text", primary: p("msg-content"), required: true, provenance: "DESIGN" },
      { key: "message.unread-badge", semantic_purpose: "unread indicator", primary: p("unread"), required: false, provenance: "PARTIAL" },
      { key: "composer.input", semantic_purpose: "reply input", primary: p("composer-input"), required: true, provenance: "DESIGN" },
      { key: "composer.send", semantic_purpose: "send control", primary: p("send-btn"), required: true, provenance: "DESIGN" },
      { key: "composer.disabled", semantic_purpose: "send-disabled marker", primary: p("send-disabled"), required: false, provenance: "DESIGN" },
      { key: "composer.image-input", semantic_purpose: "image asset input", primary: p("image-input"), required: false, provenance: "DESIGN" },
      { key: "transfer.open", semantic_purpose: "transfer dialog trigger", primary: p("transfer-open"), required: false, provenance: "PARTIAL" },
      { key: "transfer.target-list", semantic_purpose: "transfer target list", primary: p("transfer-targets"), required: false, provenance: "PARTIAL" },
      { key: "transfer.target-item", semantic_purpose: "a transfer target row", primary: p("transfer-target"), required: false, provenance: "PARTIAL" },
      { key: "transfer.confirm", semantic_purpose: "transfer confirm control", primary: p("transfer-confirm"), required: false, provenance: "PARTIAL" },
      { key: "login.required", semantic_purpose: "login-required marker", primary: p("login"), required: false, provenance: "DESIGN" },
      { key: "product.context", semantic_purpose: "product context block", primary: p("product"), required: false, provenance: "PARTIAL" },
      { key: "order.context", semantic_purpose: "order context block", primary: p("order"), required: false, provenance: "PARTIAL" },
    ],
  };
}
