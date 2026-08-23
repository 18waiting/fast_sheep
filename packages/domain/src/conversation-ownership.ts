/**
 * Conversation Ownership Domain (SHEEP-014, Phase 1 / M1.2 Conversation Domain).
 *
 * Governance basis:
 * - Reviewed Roadmap M1.2 SHEEP-014: 8 ownership states.
 * - Master §9: Conversation must support the ownership states; AI must obey ownership
 *   (after human takeover, auto-reply pauses; suggestions may continue per policy).
 * - Master §15: ownership lease rules reference the "real owner" of a conversation.
 * - DEC-014: multi-user ownership with claim/release/handoff/supervisor takeover.
 *
 * Owner SHEEP-014 tightening constraints applied:
 * 1. Minimal owner/actor identity capability: OwnershipActorRef = member (MemberId,
 *    reused from SHEEP-011) | ai. Governance (Master §9/§15, DEC-014) explicitly
 *    requires knowing the current owner. NO assignedBy/claimedBy/handoffFrom/
 *    handoffTo/lease-holder/authority-lookup execution semantics (-> M1.5/Phase 4/12).
 * 2. The 8 states are VOCABULARY ONLY. No state transition matrix and no legality
 *    declarations; transition semantics belong to M1.5 / Phase 4 / Phase 12.
 * 3. AI_ACTIVE is an ownership state only. It does NOT imply AI_AUTO_REPLY, ALLOW_AUTO,
 *    or any Automation Policy / Entitlement result (Master §10: policy engine decides).
 */

import type { ConversationId } from "./conversation-identity.js";
import type { MemberId } from "./membership-domain.js";

/** Ownership state vocabulary — exactly the 8 governance-confirmed states. */
export type ConversationOwnershipState =
  | "UNASSIGNED"
  | "AI_ACTIVE"
  | "ASSIGNED"
  | "CLAIMED"
  | "ACTIVE"
  | "HANDOFF_REQUIRED"
  | "SUPERVISOR_TAKEOVER"
  | "RELEASED";

export const OWNERSHIP_UNASSIGNED: ConversationOwnershipState = "UNASSIGNED";
export const OWNERSHIP_AI_ACTIVE: ConversationOwnershipState = "AI_ACTIVE";
export const OWNERSHIP_ASSIGNED: ConversationOwnershipState = "ASSIGNED";
export const OWNERSHIP_CLAIMED: ConversationOwnershipState = "CLAIMED";
export const OWNERSHIP_ACTIVE: ConversationOwnershipState = "ACTIVE";
export const OWNERSHIP_HANDOFF_REQUIRED: ConversationOwnershipState = "HANDOFF_REQUIRED";
export const OWNERSHIP_SUPERVISOR_TAKEOVER: ConversationOwnershipState = "SUPERVISOR_TAKEOVER";
export const OWNERSHIP_RELEASED: ConversationOwnershipState = "RELEASED";

/** All 8 ownership states (read-only). */
export const CONVERSATION_OWNERSHIP_STATES: readonly ConversationOwnershipState[] = [
  OWNERSHIP_UNASSIGNED,
  OWNERSHIP_AI_ACTIVE,
  OWNERSHIP_ASSIGNED,
  OWNERSHIP_CLAIMED,
  OWNERSHIP_ACTIVE,
  OWNERSHIP_HANDOFF_REQUIRED,
  OWNERSHIP_SUPERVISOR_TAKEOVER,
  OWNERSHIP_RELEASED,
] as const;

/**
 * Minimal current-owner actor reference capability (tightening #1).
 * - member: a team member (reuses SHEEP-011 MemberId).
 * - ai: the AI actor.
 * No assignedBy/claimedBy/handoffFrom/handoffTo/lease-holder fields — those are
 * execution semantics for M1.5 / Phase 4 / Phase 12.
 */
export type OwnershipActorRef =
  | { readonly kind: "member"; readonly memberId: MemberId }
  | { readonly kind: "ai" };

/**
 * Conversation ownership record.
 * - state: vocabulary only (no transition legality, tightening #2).
 * - ownerRef: minimal current-owner identity capability; absent for states without
 *   an owner (e.g. UNASSIGNED / RELEASED). AI_ACTIVE does NOT grant auto-send
 *   (tightening #3).
 */
export interface ConversationOwnership {
  readonly conversationId: ConversationId;
  readonly state: ConversationOwnershipState;
  readonly ownerRef?: OwnershipActorRef;
}