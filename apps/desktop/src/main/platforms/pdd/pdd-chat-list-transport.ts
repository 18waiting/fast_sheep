// SHEEP-301: `/plateau/chat/list` history-window decoding + overlap accounting.
//
// Observed real shape (single controlled store, read-only observation, 2026-09-20):
//   POST <approved PDD host>/plateau/chat/list
//   -> { success: true,
//        result: { response, request_id, result, has_more,
//                  read_mark: { user_last_read, min_supported_msg_id },
//                  messages: [ { from: { role, uid[, cs_uid] }, to: { role, uid }, content,
//                                status, is_aut, ts, type, client_msg_id, is_read, version,
//                                msg_id, mallName, manual_reply, mall_context, cs_type,
//                                pre_msg_id } ],
//                  cs_infos: [] } }
//
// Contract (same discipline as pdd-inbound-transport.ts):
// - This is a HISTORY window, not a delivery event. A decoded window must go through the
//   normal canonical path (dedup + identity + validation); it is never "new traffic" by itself.
// - Ownership never comes from payload fields (mallName, uids, read state or the currently
//   selected customer are not ownership evidence).
// - Only `from.role === "user" && to.role === "mall_cs"` are customer-inbound candidates.
// - `ts` is carried verbatim as the platform-supplied value. This decoder never converts,
//   guesses, or substitutes a time; the canonical path reports an explicit diagnostic when the
//   value is outside the supported subset.
// - Read-state fields (`read_mark`, per-item `is_read`) are reported as BOOLEAN FACTS only.
//   Their identifier values are never returned, so they cannot be persisted or mistaken for
//   message identity.
// - Unknown or unsupported shapes return an explicit status. No guessing, no fallback.
import { MessageDeduplicator } from "@fastwork/platform-pdd";
import type { PddDecodedTransportMessage, PddInboundTransportClassification } from "./pdd-inbound-transport.js";

/** Non-sensitive facts about one decoded window. */
export interface PddChatListWindowFacts {
  readonly messageCount: number;
  /** `result.has_more` when it is a real boolean; null when absent or not a boolean. */
  readonly hadMore: boolean | null;
  readonly readMarkPresent: boolean;
  /** True only when user_last_read equals one of THIS window's message ids. Value never returned. */
  readonly userLastReadIsOneOfWindowMessageIds: boolean | null;
  /** Same rule for min_supported_msg_id. */
  readonly minSupportedMsgIdIsOneOfWindowMessageIds: boolean | null;
  readonly preMessageIdChainLength: number;
  readonly distinctMessageIds: number;
  readonly inboundCandidates: number;
  readonly nonInboundItems: number;
  readonly unknownDirectionItems: number;
  readonly itemsSkippedMalformed: number;
  readonly inboundWithoutMessageId: number;
  /** Item kinds by PLATFORM `type` field (never inferred from message text). */
  readonly textItems: number;
  readonly recallNoticeItems: number;
  readonly nonTextItems: number;
  readonly unknownTypeItems: number;
  readonly platformTypeCounts: Record<string, number>;
}

/**
 * Item semantics derived ONLY from the platform `type` field.
 *
 * Evidence (loaded client bundle, read-only inspection):
 *   - a withdrawn message is rendered as `type: 31` with `info.mall_content = withdraw_hint`;
 *   - `type: 24` is handled specially (jump/quote listing) and `type: 26..29/32` exist as other
 *     message kinds;
 *   - text content is carried with `type: 0` (the quote branch rewrites content with `type: 0`).
 *
 * Anything else is UNKNOWN_TYPE: it is reported explicitly and never becomes a customer question.
 * Detection never looks at message text, so wording can never decide a kind.
 */
export type PddChatListItemKind = "TEXT" | "RECALL_NOTICE" | "NON_TEXT_MESSAGE" | "UNKNOWN_TYPE";

const RECALL_NOTICE_TYPES = new Set<number>([31]);
const KNOWN_NON_TEXT_TYPES = new Set<number>([24, 26, 27, 28, 29, 32]);
const TEXT_TYPES = new Set<number>([0]);

export function kindForPlatformType(platformType: number | null): PddChatListItemKind {
  if (platformType === null) return "UNKNOWN_TYPE";
  if (TEXT_TYPES.has(platformType)) return "TEXT";
  if (RECALL_NOTICE_TYPES.has(platformType)) return "RECALL_NOTICE";
  if (KNOWN_NON_TEXT_TYPES.has(platformType)) return "NON_TEXT_MESSAGE";
  return "UNKNOWN_TYPE";
}

/** A decoded window item: direction from roles, kind from the platform `type` field. */
export interface PddChatListItem extends PddDecodedTransportMessage {
  readonly kind: PddChatListItemKind;
  readonly platformType: number | null;
}

export type PddChatListDecodeResult =
  | { readonly status: "DECODED"; readonly messages: readonly PddChatListItem[]; readonly window: PddChatListWindowFacts }
  | { readonly status: "UNSUPPORTED"; readonly reason: string };

export type PddChatListUnsupportedReason =
  | "PAYLOAD_NOT_JSON"
  | "PAYLOAD_NOT_OBJECT"
  | "PAYLOAD_NOT_SUCCESSFUL"
  | "RESULT_MISSING"
  | "MESSAGES_NOT_ARRAY";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function roleOf(identity: unknown): unknown {
  return isRecord(identity) ? identity.role : undefined;
}

/**
 * Decode one `/plateau/chat/list` response body into per-message candidates plus non-sensitive
 * window facts. Pure and side-effect free.
 */
export function decodePddChatListPayload(raw: string | unknown): PddChatListDecodeResult {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { return { status: "UNSUPPORTED", reason: "PAYLOAD_NOT_JSON" }; }
  }
  if (!isRecord(parsed)) return { status: "UNSUPPORTED", reason: "PAYLOAD_NOT_OBJECT" };
  if (parsed.success !== true) return { status: "UNSUPPORTED", reason: "PAYLOAD_NOT_SUCCESSFUL" };
  const result = parsed.result;
  if (!isRecord(result)) return { status: "UNSUPPORTED", reason: "RESULT_MISSING" };
  const rows = result.messages;
  if (!Array.isArray(rows)) return { status: "UNSUPPORTED", reason: "MESSAGES_NOT_ARRAY" };

  const messages: PddChatListItem[] = [];
  const messageIds = new Set<string>();
  let inboundCandidates = 0;
  let nonInboundItems = 0;
  let unknownDirectionItems = 0;
  let itemsSkippedMalformed = 0;
  let inboundWithoutMessageId = 0;
  let preMessageIdChainLength = 0;
  const platformTypeCounts: Record<string, number> = {};
  let textItems = 0;
  let recallNoticeItems = 0;
  let nonTextItems = 0;
  let unknownTypeItems = 0;

  for (const row of rows) {
    if (!isRecord(row)) { itemsSkippedMalformed += 1; continue; }
    const fromRole = roleOf(row.from);
    const toRole = roleOf(row.to);
    const messageId = nonBlankString(row.msg_id) ? row.msg_id : null;
    if (messageId !== null) messageIds.add(messageId);
    if (nonBlankString(row.pre_msg_id)) preMessageIdChainLength += 1;
    const platformType = typeof row.type === "number" ? row.type : null;
    const kind = kindForPlatformType(platformType);
    platformTypeCounts[platformType === null ? "ABSENT" : String(platformType)] = (platformTypeCounts[platformType === null ? "ABSENT" : String(platformType)] ?? 0) + 1;
    if (kind === "TEXT") textItems += 1;
    else if (kind === "RECALL_NOTICE") recallNoticeItems += 1;
    else if (kind === "NON_TEXT_MESSAGE") nonTextItems += 1;
    else unknownTypeItems += 1;

    // Direction and kind are decided independently:
    //   - direction comes from the role fields,
    //   - kind comes from the platform type field,
    //   - only BOTH together make a customer question candidate.
    const direction: PddInboundTransportClassification = fromRole === "user" && toRole === "mall_cs"
      ? "CUSTOMER_INBOUND"
      : (fromRole === "mall_cs" || toRole === "user") ? "NOT_CUSTOMER_ORIGINATED" : "UNKNOWN_DIRECTION";

    if (direction === "CUSTOMER_INBOUND" && kind === "TEXT") {
      const from = isRecord(row.from) ? row.from : {};
      const to = isRecord(row.to) ? row.to : {};
      if (messageId === null) inboundWithoutMessageId += 1;
      inboundCandidates += 1;
      messages.push({
        classification: direction,
        kind,
        platformType,
        ingressInput: {
          payload: {
            from: { role: "user", uid: from.uid },
            to: { role: "mall_cs", uid: to.uid },
            content: row.content,
            // Carried verbatim: no conversion, no receive-time substitution.
            // A missing id stays explicitly undefined so the canonical normalizer reports
            // PLATFORM_MESSAGE_ID_MISSING instead of this decoder inventing one.
            msg_id: row.msg_id,
          },
          sourceOccurredAt: row.ts,
        },
      });
      continue;
    }
    if (direction === "NOT_CUSTOMER_ORIGINATED") { nonInboundItems += 1; messages.push({ classification: direction, kind, platformType }); continue; }
    if (direction === "CUSTOMER_INBOUND") {
      // Customer-direction item that is NOT a text question (recall notice / non-text / unknown kind):
      // recognised, reported with its kind and platform type, and never offered as a question.
      messages.push({ classification: direction, kind, platformType });
      continue;
    }
    unknownDirectionItems += 1;
    messages.push({ classification: direction, kind, platformType });
  }

  const readMark = isRecord(result.read_mark) ? result.read_mark : null;
  const isOneOfWindowIds = (candidate: unknown): boolean | null =>
    nonBlankString(candidate) ? messageIds.has(candidate) : null;

  return {
    status: "DECODED",
    messages,
    window: {
      messageCount: rows.length,
      hadMore: typeof result.has_more === "boolean" ? result.has_more : null,
      readMarkPresent: readMark !== null,
      userLastReadIsOneOfWindowMessageIds: readMark ? isOneOfWindowIds(readMark.user_last_read) : null,
      minSupportedMsgIdIsOneOfWindowMessageIds: readMark ? isOneOfWindowIds(readMark.min_supported_msg_id) : null,
      preMessageIdChainLength,
      distinctMessageIds: messageIds.size,
      inboundCandidates,
      nonInboundItems,
      unknownDirectionItems,
      itemsSkippedMalformed,
      inboundWithoutMessageId,
      textItems,
      recallNoticeItems,
      nonTextItems,
      unknownTypeItems,
      platformTypeCounts,
    },
  };
}

export interface PddChatListAccumulation {
  readonly decoded: boolean;
  readonly unsupportedReason: string | null;
  readonly inboundSeen: number;
  readonly addedInbound: readonly PddChatListItem[];
  readonly duplicateInbound: number;
  readonly unidentifiedInbound: number;
  readonly nonInbound: number;
  readonly unknownDirection: number;
  /** Items seen in the window that are NOT text questions, by kind (never silent). */
  readonly excludedByKind: Record<string, number>;
}

export interface PddChatListAccumulatorStats {
  readonly windows: number;
  readonly distinctInboundMessageIds: number;
  readonly duplicateInbound: number;
  readonly unidentifiedInbound: number;
  /** Non-question items excluded across all windows, by kind. */
  readonly excludedByKindTotals: Record<string, number>;
  readonly deduplicator: { size: number; maxSize: number };
}

/**
 * Accumulates decoded history windows.
 *
 * A conversation switch can return overlapping windows (the same message appears in more than one
 * response), so inbound candidates are deduplicated by their authoritative platform message id.
 * Candidates WITHOUT a message id are never merged or dropped silently: they are reported as
 * unidentified and passed through, because the canonical path decides what an unidentified
 * message may become.
 */
export class PddChatListWindowAccumulator {
  private readonly dedup: MessageDeduplicator;
  private windows = 0;
  private distinctInboundMessageIds = 0;
  private duplicateInbound = 0;
  private unidentifiedInbound = 0;
  private excludedByKindTotals: Record<string, number> = {};

  constructor(maxSize = 4096) {
    this.dedup = new MessageDeduplicator(maxSize);
  }

  ingest(decoded: PddChatListDecodeResult): PddChatListAccumulation {
    if (decoded.status !== "DECODED") {
      return { decoded: false, unsupportedReason: decoded.reason, inboundSeen: 0, addedInbound: [], duplicateInbound: 0, unidentifiedInbound: 0, nonInbound: 0, unknownDirection: 0, excludedByKind: {} };
    }
    this.windows += 1;
    const added: PddChatListItem[] = [];
    let inboundSeen = 0;
    let duplicateInbound = 0;
    let unidentifiedInbound = 0;
    const excludedByKind: Record<string, number> = {};

    for (const message of decoded.messages) {
      if (message.classification !== "CUSTOMER_INBOUND" || message.kind !== "TEXT") {
        // Recall notices / non-text / unknown platform types are counted, never silently dropped and
        // never mapped as questions.
        const key = message.kind + ":" + message.classification;
        excludedByKind[key] = (excludedByKind[key] ?? 0) + 1;
        continue;
      }
      inboundSeen += 1;
      const messageId = message.ingressInput ? message.ingressInput.payload.msg_id : undefined;
      if (typeof messageId !== "string" || messageId.length === 0) {
        // No authoritative id: cannot be proven duplicate, and is never merged with another row.
        unidentifiedInbound += 1;
        this.unidentifiedInbound += 1;
        added.push(message);
        continue;
      }
      if (this.dedup.observe(messageId)) {
        this.distinctInboundMessageIds += 1;
        added.push(message);
        continue;
      }
      duplicateInbound += 1;
      this.duplicateInbound += 1;
    }

    for (const [key, count] of Object.entries(excludedByKind)) this.excludedByKindTotals[key] = (this.excludedByKindTotals[key] ?? 0) + count;
    return {
      decoded: true,
      unsupportedReason: null,
      inboundSeen,
      addedInbound: added,
      duplicateInbound,
      unidentifiedInbound,
      nonInbound: decoded.window.nonInboundItems,
      unknownDirection: decoded.window.unknownDirectionItems,
      excludedByKind,
    };
  }

  stats(): PddChatListAccumulatorStats {
    return {
      windows: this.windows,
      distinctInboundMessageIds: this.distinctInboundMessageIds,
      duplicateInbound: this.duplicateInbound,
      unidentifiedInbound: this.unidentifiedInbound,
      excludedByKindTotals: { ...this.excludedByKindTotals },
      deduplicator: this.dedup.stats(),
    };
  }
}
