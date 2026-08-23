/**
 * Normalized Conversation Identity (SHEEP-013, Phase 1 / M1.2 Conversation Domain).
 *
 * Governance basis:
 * - Reviewed Roadmap M1.2 SHEEP-013: merchant/store/platform/conversation IDs,
 *   normalized message identity.
 * - Master §5.4: merchant_id / store_id / platform_account_id scoping.
 * - Master §7: Conversation sits under PlatformAccount.
 * - R-07 identity analysis: local entity identity != platform external identity !=
 *   cloud authoritative identity.
 *
 * Owner SHEEP-013 tightening constraints applied:
 * 1. storeId is a governance-confirmed Store scope and is retained on the normalized
 *    conversation identity (not omitted as "derivable from PlatformAccount").
 * 2. The platform-external conversation reference is an opaque identity capability
 *    (AccountRef), NOT a hardcoded `externalConversationId` shape assumed uniform
 *    across platforms; minimal and extensible, no platform business logic.
 * 3. Single platform fact source: `platformAccountId` is the authoritative platform
 *    fact; `externalRef` does NOT carry a redundant `platform` field, so the two
 *    cannot contradict. No authoritative lookup is implemented here.
 * 4. Message external reference is OPTIONAL and is identity-reference only: a message
 *    without a platform message id is still a valid identity; no delivery/status/
 *    time/direction/sender fields are added.
 */

import type { MerchantId, StoreId, PlatformAccountId, PlatformId } from "./merchant-domain.js";
import type { AccountRef } from "./merchant-domain.js";

/** Opaque, branded local conversation / message ids. */
export type ConversationId = string & { readonly __conversation: true };
export type MessageId = string & { readonly __message: true };

/**
 * Normalized conversation identity.
 * - localId: local entity identity.
 * - merchantId / storeId / platformAccountId: governance-confirmed scopes (storeId
 *   retained even though it may be derivable from PlatformAccount).
 * - externalRef: opaque platform-external conversation reference (kind "platform").
 *   The single platform fact source is platformAccountId (no redundant platform field).
 */
export interface NormalizedConversationIdentity {
  readonly localId: ConversationId;
  readonly merchantId: MerchantId;
  readonly storeId: StoreId;
  readonly platformAccountId: PlatformAccountId;
  readonly externalRef: AccountRef;
}

/**
 * Normalized message identity.
 * - localMessageId: local entity identity.
 * - conversationId: owning normalized conversation (local identity).
 * - externalRef (OPTIONAL): platform-external message identity reference only.
 *   Absence of a platform message id does NOT invalidate the message identity.
 *   No delivery/status/time/direction/sender business fields are modeled here.
 */
export interface NormalizedMessageIdentity {
  readonly localMessageId: MessageId;
  readonly conversationId: ConversationId;
  readonly externalRef?: AccountRef;
}

// Re-export PlatformId type for callers that need it in conversation context.
export type { PlatformId };