/**
 * Sync-Readiness Contract (M1.5-R07, Phase 1 / M1.5 Early Cross-Cutting Foundation).
 *
 * Capability/contract level ONLY:
 * - NO sync implementation, NO Outbox, NO pull/apply/conflict, NO sync state.
 * - NO per-entity sync fields and NO new tables; existing domain identity contracts
 *   stay authoritative (Merchant/Store/PlatformAccount/Member/Membership/Seat/
 *   Conversation/Message/Customer/Product/Sku/Order/Logistics). This module does NOT
 *   define a second identity system, a unified Sync ID, or re-purpose AccountRef.
 *
 * Core hard boundary: sync-ready != sync-enabled. Nothing here marks any entity
 * sync-enabled; actual classification and enablement are gated by the R-06
 * DATA-DECISION-GATE (per-entity Data Authority / Sync Scope Matrix), not by this
 * contract.
 */

/** Master §15 data classes (governance-level vocabulary). */
export type SyncClass = "cloud_authoritative" | "local_authoritative" | "replicated";

/**
 * Policy integration point (NOT an entity data field).
 * Where a policy/sync configuration exists, it MAY hold an optional syncClass.
 * No Phase 1 entity carries this field, and no entity/record is assigned a class here
 * (assignment = R-06 DATA-DECISION-GATE).
 */
export interface SyncClassPolicyHook {
  readonly syncClass?: SyncClass;
}

/**
 * Readiness state encoding the hard boundary:
 * - "ready": the persistence architecture can add selected sync later without
 *   structural rework (identity stable, typed mutation boundary exists).
 * - "enabled": sync actually active — only reachable through the R-06 gate.
 * Phase 12 implements the engine (SHEEP-220..224); this contract never sets "enabled".
 */
export type SyncReadiness = "ready" | "enabled";