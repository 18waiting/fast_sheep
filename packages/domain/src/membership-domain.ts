/**
 * Membership / Seat Domain Model (SHEEP-011, Phase 1 / M1.1 Core Identity Domain).
 *
 * Governance basis:
 * - Master §7: Account -> Merchant/Organization -> Membership -> Store -> PlatformAccount.
 *   Membership IS the Account<->Merchant relationship entity.
 * - Master §7 (team): Member -> Role -> Capabilities -> Resource Scope.
 * - DEC-011: first-version fixed roles = Owner / Admin / Supervisor / Agent;
 *   underlying authorization is Capability + Resource Scope (no if-role logic).
 * - DEC-012: Store/Seat quotas are commercial entitlement, NOT a domain fact here.
 * - Master §5.4: member / seat scope.
 *
 * Owner SHEEP-011 tightening constraints applied:
 * T-A: Membership is the SINGLE authoritative Member<->Merchant ownership fact.
 *      Member does NOT redundantly hold merchantId.
 * T-B: Seat is ONLY a Merchant-scoped domain identity/capability PLACEHOLDER.
 *      It is NOT commercial license capacity. MAX_SEATS / allocation / occupation /
 *      quota enforcement belong to DEC-012 Entitlement / Phase 11 and are NOT modeled here.
 * T-C: Default roles are exactly owner/admin/supervisor/agent (DEC-011).
 *      RoleId is typed to avoid sealing future extension, but custom roles are NOT
 *      declared or tested as a v1 product capability. Authorization = SHEEP-012.
 */

import type { AccountRef, MerchantId } from "./merchant-domain.js";

/** Opaque, branded local ids. */
export type MemberId = string & { readonly __member: true };
export type MembershipId = string & { readonly __membership: true };
export type SeatId = string & { readonly __seat: true };

/**
 * Role identifier. Type is an extensible string to avoid sealing future extension,
 * but the ONLY governance-confirmed roles for the first version are the four
 * DEFAULT_ROLES below (DEC-011). Custom roles are NOT a v1 product capability.
 */
export type RoleId = string;

export const ROLE_OWNER: RoleId = "owner";
export const ROLE_ADMIN: RoleId = "admin";
export const ROLE_SUPERVISOR: RoleId = "supervisor";
export const ROLE_AGENT: RoleId = "agent";

/** First-version default roles (DEC-011). Read-only. */
export const DEFAULT_ROLES: readonly RoleId[] = [
  ROLE_OWNER,
  ROLE_ADMIN,
  ROLE_SUPERVISOR,
  ROLE_AGENT,
] as const;

/**
 * Member: a person's identity within the team context.
 * Deliberately does NOT carry merchantId — the Member<->Merchant ownership fact is
 * owned exclusively by Membership (T-A). No status vocabulary (no governance evidence).
 */
export interface Member {
  readonly id: MemberId;
  /** Reference to the person's Account identity (local identity domain). */
  readonly accountRef: AccountRef;
}

/**
 * Membership: the SINGLE authoritative fact that a Member belongs to a Merchant
 * with a role (Master §7: Account -> Merchant -> Membership). Carries both the
 * ownership (merchantId) and the role. No status vocabulary.
 */
export interface Membership {
  readonly id: MembershipId;
  readonly merchantId: MerchantId;
  readonly memberId: MemberId;
  readonly role: RoleId;
}

/**
 * Seat: Merchant-scoped seat domain identity/capability PLACEHOLDER (T-B).
 * NOT commercial license capacity. No maxSeats / quota / allocation / occupation fields.
 * Quota enforcement belongs to DEC-012 Entitlement / Phase 11 commercial control.
 */
export interface Seat {
  readonly id: SeatId;
  readonly merchantId: MerchantId;
}