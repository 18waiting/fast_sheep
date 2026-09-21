// SHEEP-301 PDD_DECODED_INBOUND_EVENT_PROOF: page-decoded inbound event -> canonical CANDIDATE.
//
// Boundary (see the round report): the page's decoded business event is CANDIDATE DATA only. Ownership
// (shop / session / document generation) always comes from the trusted Main binding, and the customer,
// message id, direction and type come from the per-message object - never from the selected customer,
// a nickname, DOM text or bubble position.
//
// This gate is fail-closed: anything that is not a plain customer text message is REJECTED with an
// explicit reason, and a rejection never falls back to any legacy path.
import { kindForPlatformType } from "./pdd-chat-list-transport.js";

export type PddInboundEventRejectionReason =
  | "EVENT_NOT_OBJECT"
  | "NOT_CUSTOMER_DIRECTION"
  | "HISTORY_LOAD"
  | "RECALL_NOTICE"
  | "NON_TEXT_MESSAGE"
  | "UNKNOWN_TYPE"
  | "CONTENT_MISSING"
  | "PLATFORM_MESSAGE_ID_MISSING";

export interface PddInboundEventIngressInput {
  readonly payload: {
    readonly from: { readonly role: "user"; readonly uid: unknown };
    readonly to: { readonly role: "mall_cs"; readonly uid: unknown };
    readonly content: string;
    readonly msg_id: string;
  };
  /** Always null here: the page time field's semantics are unverified, so receive time is never
   * substituted for the source time. */
  readonly sourceOccurredAt: null;
}

export type PddInboundEventCandidateResult =
  | {
    readonly status: "CANDIDATE";
    readonly ingressInput: PddInboundEventIngressInput;
    /** The id came from the page-decoded event; its authoritative provenance is decided by Main. */
    readonly idProvenance: "PAYLOAD_SUPPLIED_UNVERIFIED";
    readonly diagnostics: readonly string[];
  }
  | { readonly status: "REJECTED"; readonly reason: PddInboundEventRejectionReason; readonly diagnostics: readonly string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Classify one page-decoded inbound event (the object the page's own receive path carries).
 * Evidence-based discriminators only:
 *   - `is_history === true`  -> the page marked this object as a history fetch (its own marker);
 *   - platform `type`        -> recalls / other kinds are separated by the type field, never by text;
 *   - `from.role`/`to.role`  -> direction;
 *   - `msg_id`               -> a client-side id is never promoted to a platform message id.
 */
export function toInboundEventCandidate(event: unknown): PddInboundEventCandidateResult {
  const diagnostics: string[] = [];
  if (!isRecord(event)) return { status: "REJECTED", reason: "EVENT_NOT_OBJECT", diagnostics };

  const from = isRecord(event.from) ? event.from : null;
  const to = isRecord(event.to) ? event.to : null;
  const fromRole = from && typeof from.role === "string" ? from.role : null;
  const toRole = to && typeof to.role === "string" ? to.role : null;

  if (fromRole !== "user" || toRole !== "mall_cs") {
    // Merchant-authored, system records and everything else are not customer inbound.
    return { status: "REJECTED", reason: "NOT_CUSTOMER_DIRECTION", diagnostics };
  }

  if (event.is_history === true) {
    // The page's own history marker: a history row must never be treated as a new inbound question.
    return { status: "REJECTED", reason: "HISTORY_LOAD", diagnostics };
  }

  const platformType = typeof event.type === "number" ? event.type : null;
  const kind = kindForPlatformType(platformType);
  if (kind !== "TEXT") {
    // RECALL_NOTICE / NON_TEXT_MESSAGE / UNKNOWN_TYPE, by the platform field only.
    return { status: "REJECTED", reason: kind, diagnostics };
  }

  if (!nonBlankString(event.content)) return { status: "REJECTED", reason: "CONTENT_MISSING", diagnostics };

  if (!nonBlankString(event.msg_id)) {
    // A locally generated id (for example client_msg_id on a failed send) is never promoted here.
    if (nonBlankString(event.client_msg_id)) diagnostics.push("CLIENT_MSG_ID_PRESENT_WITHOUT_PLATFORM_ID");
    return { status: "REJECTED", reason: "PLATFORM_MESSAGE_ID_MISSING", diagnostics };
  }

  diagnostics.push("SOURCE_TIME_UNVERIFIED");
  return {
    status: "CANDIDATE",
    idProvenance: "PAYLOAD_SUPPLIED_UNVERIFIED",
    diagnostics,
    ingressInput: {
      payload: {
        from: { role: "user", uid: from ? from.uid : undefined },
        to: { role: "mall_cs", uid: to ? to.uid : undefined },
        content: event.content,
        msg_id: event.msg_id,
      },
      sourceOccurredAt: null,
    },
  };
}