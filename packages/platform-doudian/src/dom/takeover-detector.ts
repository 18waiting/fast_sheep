// M8 Doudian takeover detector (clean-room). Automated sends excluded via ack registry.
import { detectHumanReply, readMessages } from "@fastwork/platform-web-common";
import type { AutomatedSendAck, DomDocument } from "@fastwork/platform-web-common";
import { DOUDIAN_SELECTOR_PROFILE } from "./selector-registry.js";

export function detectDoudianHumanReply(doc: DomDocument, recentAutomatedAcks: AutomatedSendAck[], nowMs: number, expiryMs = 60_000): { isHuman: boolean; message_id?: string } {
  return detectHumanReply(doc, DOUDIAN_SELECTOR_PROFILE, readMessages(doc, DOUDIAN_SELECTOR_PROFILE), recentAutomatedAcks, nowMs, expiryMs);
}
