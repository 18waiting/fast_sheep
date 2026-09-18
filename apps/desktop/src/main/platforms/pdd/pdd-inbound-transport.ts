// SHEEP-301/302: real PDD inbound transport decoding.
//
// Observed reference (dedicated debug Chrome, single controlled store, read-only):
//   POST <approved PDD host>/plateau/chat/latest_conversations
//   -> { success, result: { conversations: [ { from:{role,uid}, to:{role,uid},
//        content, ts, type, msg_id, client_msg_id, mallName, user_info? } ] } }
//
// Contract:
// - This decodes transport payloads into per-message candidates. It never decides
//   ownership: the owning shop/session/document must come from trusted Main evidence
//   (the observed request/connection binding), never from payload fields such as
//   mallName, shop_id, the selected customer, or the page URL.
// - Only customer-originated messages (from.role === "user") are candidates for the
//   canonical inbound path. Agent/self messages and other record kinds are reported
//   as non-inbound and are never mapped.
// - Multiple conversations/messages are decoded individually; nothing is collapsed
//   onto the currently selected customer.
// - Unknown/unsupported shapes return an explicit status. No guessing, no fallback.
// - `ts` is carried as the platform-supplied raw value only; no receive time or CDP
//   time is substituted when it is absent.
export interface PddTransportIdentity {
  readonly role?: unknown;
  readonly uid?: unknown;
}

export interface PddTransportMessageRecord {
  readonly from?: PddTransportIdentity;
  readonly to?: PddTransportIdentity;
  readonly content?: unknown;
  readonly ts?: unknown;
  readonly type?: unknown;
  readonly msg_id?: unknown;
  readonly client_msg_id?: unknown;
  readonly user_info?: { readonly nickname?: unknown; readonly uid?: unknown } | unknown;
}

export type PddInboundTransportClassification =
  | "CUSTOMER_INBOUND"
  | "NOT_CUSTOMER_ORIGINATED"
  | "UNKNOWN_DIRECTION";

export interface PddDecodedTransportMessage {
  readonly classification: PddInboundTransportClassification;
  /** Present only for CUSTOMER_INBOUND. Shape matches the canonical ingress input. */
  readonly ingressInput?: {
    readonly payload: {
      readonly from: { readonly role: "user"; readonly uid: unknown };
      readonly to: { readonly role: "mall_cs"; readonly uid: unknown };
      readonly content: unknown;
      readonly msg_id: unknown;
    };
    readonly sourceOccurredAt: unknown;
  };
  /** Opaque customer nickname if the payload carried one; never used for ownership. */
  readonly customerNickname?: string;
}

export type PddTransportDecodeResult =
  | { readonly status: "DECODED"; readonly messages: readonly PddDecodedTransportMessage[] }
  | { readonly status: "UNSUPPORTED"; readonly reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function roleOf(identity: unknown): unknown {
  return isRecord(identity) ? identity.role : undefined;
}

/**
 * Decode a `/plateau/chat/latest_conversations` response body into per-message
 * candidates. Pure and side-effect free.
 */
export function decodePddLatestConversationsPayload(raw: string | unknown): PddTransportDecodeResult {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { status: "UNSUPPORTED", reason: "PAYLOAD_NOT_JSON" };
    }
  }
  if (!isRecord(parsed)) return { status: "UNSUPPORTED", reason: "PAYLOAD_NOT_OBJECT" };
  if (parsed.success !== true) return { status: "UNSUPPORTED", reason: "PAYLOAD_NOT_SUCCESSFUL" };
  const result = parsed.result;
  if (!isRecord(result)) return { status: "UNSUPPORTED", reason: "RESULT_MISSING" };
  const conversations = result.conversations;
  if (!Array.isArray(conversations)) return { status: "UNSUPPORTED", reason: "CONVERSATIONS_NOT_ARRAY" };

  const messages: PddDecodedTransportMessage[] = [];
  for (const record of conversations) {
    if (!isRecord(record)) continue;
    const fromRole = roleOf(record.from);
    const toRole = roleOf(record.to);
    const userInfo = isRecord(record.user_info) ? record.user_info : null;
    const customerNickname = userInfo && typeof userInfo.nickname === "string" ? userInfo.nickname : undefined;

    if (fromRole === "user" && toRole === "mall_cs") {
      const from = record.from as Record<string, unknown>;
      const to = record.to as Record<string, unknown>;
      messages.push({
        classification: "CUSTOMER_INBOUND",
        ingressInput: {
          payload: { from: { role: "user", uid: from.uid }, to: { role: "mall_cs", uid: to.uid }, content: record.content, msg_id: record.msg_id },
          sourceOccurredAt: record.ts,
        },
        customerNickname,
      });
      continue;
    }
    // Agent/self-authored records and anything else are explicitly NOT inbound.
    if (fromRole === "mall_cs" || toRole === "user") {
      messages.push({ classification: "NOT_CUSTOMER_ORIGINATED", customerNickname });
      continue;
    }
    messages.push({ classification: "UNKNOWN_DIRECTION", customerNickname });
  }
  return { status: "DECODED", messages };
}
