/**
 * Local Ownership Execution Semantics (M1.5-R02, Phase 1 / M1.5 Early Cross-Cutting
 * Foundation). Built on the SHEEP-014 ownership domain (ConversationOwnershipState /
 * OwnershipActorRef).
 *
 * Owner tightening applied:
 * 1. Actor != Authority. OwnershipActorRef(member|ai) is ONLY the executing actor's
 *    identity; it does NOT grant claim/release/handoff/takeover permission. Permission
 *    is a SHEEP-012 Capability + Resource Scope concern and is NOT implemented here.
 * 2. supervisor_takeover is an ownership ACTION / result semantic; it does NOT mean
 *    every role=supervisor automatically has takeover authority. No role is consulted
 *    here; authority validation is deferred.
 * 3. Action semantics != a full transition engine. Only the target-state contract of
 *    each action is defined; NO transition matrix, NO canTransition, NO all-state
 *    combination rules (transition governance = later M1.5 / Phase 4 / Phase 12).
 * 4. AI_ACTIVE is an ownership state only; it does NOT imply AI_AUTO_REPLY,
 *    ALLOW_AUTO, or any Automation Policy / Entitlement result.
 * 5. lease duration/refresh/expiry, Cloud ownership authority, reconciliation and
 *    presence remain DEFERRED (Phase 12).
 */

import type { ConversationOwnershipState, OwnershipActorRef } from "./conversation-ownership.js";
import type { MemberId } from "./membership-domain.js";

/** The four governance-confirmed ownership actions (DEC-014). No others. */
export type OwnershipAction = "claim" | "release" | "handoff" | "supervisor_takeover";

/** An action request: action + executing actor identity (+ optional handoff target). */
export interface OwnershipActionRequest {
  readonly action: OwnershipAction;
  /** Executing actor identity ONLY (not authority). */
  readonly actor: OwnershipActorRef;
  /** Required for handoff: the member the conversation is handed off to. */
  readonly targetMemberId?: MemberId;
}

/** Target-state contract of a successful action (state semantics, not authority). */
export interface OwnershipTargetState {
  readonly state: ConversationOwnershipState;
  /** Resulting owner (absent = no owner, e.g. RELEASED). */
  readonly ownerRef?: OwnershipActorRef;
}

export class OwnershipExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OwnershipExecutionError";
  }
}

/**
 * Pure action -> target-state semantics. This is NOT an authorization/permission
 * check: it never validates whether the actor is permitted to perform the action
 * (that is SHEEP-012 Capability + Resource Scope, deferred). A malformed request
 * (e.g. handoff without a target member) throws a generic, non-sensitive error.
 */
export function targetOwnershipFor(request: OwnershipActionRequest): OwnershipTargetState {
  switch (request.action) {
    case "claim":
      return request.actor.kind === "ai"
        ? { state: "AI_ACTIVE", ownerRef: request.actor }
        : { state: "CLAIMED", ownerRef: request.actor };
    case "release":
      return { state: "RELEASED" };
    case "handoff":
      if (!request.targetMemberId) {
        throw new OwnershipExecutionError("handoff requires a target member");
      }
      return { state: "ASSIGNED", ownerRef: { kind: "member", memberId: request.targetMemberId } };
    case "supervisor_takeover":
      return { state: "SUPERVISOR_TAKEOVER", ownerRef: request.actor };
  }
}