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
 * Owner SHEEP-013 tightening + REPAIR constraints applied:
 * 1. storeId is a governance-confirmed Store scope and is retained on the normalized
 *    conversation identity (not omitted as "derivable from PlatformAccount").
 * 2. The platform-external conversation reference is an opaque identity capability
 *    (ConversationExternalRef), NOT a hardcoded `externalConversationId` shape assumed
 *    uniform across platforms; minimal and extensible, no platform business logic.
 * 3. Single platform fact source: `platformAccountId` is the authoritative platform
 *    fact; `externalRef` does NOT carry a redundant `platform` field, so the two
 *    cannot contradict. No authoritative lookup is implemented here.
 * 4. Message external reference is OPTIONAL and is identity-reference only: a message
 *    without a platform message id is still a valid identity; no delivery/status/
 *    time/direction/sender fields are added.
 * REPAIR (Owner): AccountRef (account identity reference from SHEEP-010) is NOT reused
 * for Conversation/Message external references. Dedicated, semantically distinct
 * opaque reference types are defined instead: ConversationExternalRef and
 * MessageExternalRef. No cloud/sync/revision, no platform business logic, no unified
 * external ID assumption.
 */

import type { MerchantId, StoreId, PlatformAccountId, PlatformId } from "./merchant-domain.js";

/** Opaque, branded local conversation / message ids. */
export type ConversationId = string & { readonly __conversation: true };
export type MessageId = string & { readonly __message: true };

/**
 * Opaque platform-external conversation reference.
 * Semantically specific to conversations; deliberately opaque (no unified external
 * conversation ID shape is assumed across platforms). Carries no platform field —
 * the single platform fact source is platformAccountId. No sync/revision semantics.
 */
export interface ConversationExternalRef {
  readonly value: string;
}

/**
 * Opaque platform-external message reference (optional).
 * Semantically specific to messages; identity-reference only. Absence of a platform
 * message reference does NOT invalidate the message identity. No delivery/status/
 * time/direction/sender business fields.
 */
export interface MessageExternalRef {
  readonly value: string;
}

/**
 * Normalized conversation identity.
 * - localId: local entity identity.
 * - merchantId / storeId / platformAccountId: governance-confirmed scopes (storeId
 *   retained even though it may be derivable from PlatformAccount).
 * - externalRef: opaque platform-external conversation reference
 *   (ConversationExternalRef). The single platform fact source is platformAccountId.
 */
export interface NormalizedConversationIdentity {
  readonly localId: ConversationId;
  readonly merchantId: MerchantId;
  readonly storeId: StoreId;
  readonly platformAccountId: PlatformAccountId;
  readonly externalRef: ConversationExternalRef;
}

/**
 * Normalized message identity.
 * - localMessageId: local entity identity.
 * - conversationId: owning normalized conversation (local identity).
 * - externalRef (OPTIONAL): platform-external message identity reference
 *   (MessageExternalRef), identity-reference only.
 */
export interface NormalizedMessageIdentity {
  readonly localMessageId: MessageId;
  readonly conversationId: ConversationId;
  readonly externalRef?: MessageExternalRef;
}

// Re-export PlatformId type for callers that need it in conversation context.
export type { PlatformId };