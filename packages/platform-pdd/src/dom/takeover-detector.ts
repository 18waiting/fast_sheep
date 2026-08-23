// M7 takeover detector (clean-room).
// Detects seller/human-authored outgoing messages, but automated sends by THIS
// adapter must never be misclassified as human takeover. Uses a bounded recent
// automated-send acknowledgement registry (DESIGN).
import type { DomDocument } from "./dom-types.js";
import { selector, type SelectorProfile } from "../selector-profile.js";
import type { AutomatedSendAck, RawDomMessage } from "../types.js";

export interface TakeoverSignal {
  isHuman: boolean;
  message_id?: string;
}

/**
 * A message is human-authored iff it is an OUTBOUND message whose id is NOT in the
 * bounded recent automated-send ack registry (within the expiry window).
 */
export function detectHumanReply(
  doc: DomDocument,
  profile: SelectorProfile,
  messages: RawDomMessage[],
  recentAutomatedAcks: AutomatedSendAck[],
  nowMs: number,
  expiryMs = 60_000,
): TakeoverSignal {
  const ackIds = new Set(
    recentAutomatedAcks.filter((a) => nowMs - a.at_ms <= expiryMs).map((a) => a.message_id),
  );
  const rowSel = selector(profile, "message.row");
  if (!rowSel) return { isHuman: false };
  for (const row of doc.querySelectorAll(rowSel.primary)) {
    const direction = row.getAttribute("data-direction");
    if (direction !== "outbound") continue;
    const mid = row.getAttribute("data-message-id");
    if (mid && ackIds.has(mid)) continue; // automated send echo -> NOT takeover
    return { isHuman: true, message_id: mid ?? undefined };
  }
  void messages;
  return { isHuman: false };
}
