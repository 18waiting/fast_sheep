export type PddInboundNormalizationResult =
  | { status: "NORMALIZED"; candidate: PddInboundCandidate }
  | { status: "REJECTED"; reason: string }
  | { status: "UNKNOWN"; reason: string };

export interface PddInboundPayload {
  content?: unknown;
  from?: { role?: unknown; uid?: unknown };
  to?: { role?: unknown; uid?: unknown };
  msg_id?: unknown;
  client_msg_id?: unknown;
  pre_msg_id?: unknown;
  seq_id?: unknown;
  base_seq_id?: unknown;
  target_id?: unknown;
  chat_type_id?: unknown;
  version?: unknown;
  type?: unknown;
  [key: string]: unknown;
}

export interface PddInboundCandidate {
  direction: "inbound";
  customerUid: string;
  platformMessageId: string;
  content: string;
  clientMessageId?: string;
  opaquePlatformFields?: {
    toUid?: string;
    preMsgId?: unknown;
    seqId?: unknown;
    baseSeqId?: unknown;
    targetId?: unknown;
    chatTypeId?: unknown;
    version?: unknown;
    type?: unknown;
  };
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function nonBlankString(value: unknown): value is string {
  return nonEmptyString(value) && value.trim().length > 0;
}

function customerUidString(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

export function normalizePddInbound(payload: PddInboundPayload): PddInboundNormalizationResult {
  if (!nonEmptyString(payload.content)) return { status: "REJECTED", reason: "content_missing_or_invalid" };
  if (payload.from?.role !== "user") return { status: "REJECTED", reason: "from_role_not_user" };
  if (payload.to?.role !== "mall_cs") return { status: "REJECTED", reason: "to_role_not_mall_cs" };
  if (!customerUidString(payload.from?.uid)) return { status: "UNKNOWN", reason: "customer_uid_missing_or_invalid" };
  if (!nonBlankString(payload.msg_id)) return { status: "UNKNOWN", reason: "platform_message_id_missing_or_invalid" };

  const candidate: PddInboundCandidate = {
    direction: "inbound",
    customerUid: payload.from.uid,
    platformMessageId: payload.msg_id,
    content: payload.content,
  };
  if (nonEmptyString(payload.client_msg_id)) candidate.clientMessageId = payload.client_msg_id;

  const opaquePlatformFields = {
    toUid: nonEmptyString(payload.to?.uid) ? payload.to.uid : undefined,
    preMsgId: payload.pre_msg_id,
    seqId: payload.seq_id,
    baseSeqId: payload.base_seq_id,
    targetId: payload.target_id,
    chatTypeId: payload.chat_type_id,
    version: payload.version,
    type: payload.type,
  };
  if (Object.values(opaquePlatformFields).some((value) => value !== undefined)) {
    candidate.opaquePlatformFields = opaquePlatformFields;
  }
  return { status: "NORMALIZED", candidate };
}
