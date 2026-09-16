/**
 * SHEEP-300 canonical inbound identity contract foundation.
 *
 * JSON Schema Draft 2020-12 is the cross-process source of truth. These readonly
 * TypeScript types mirror the canonical schemas without adding mapping,
 * construction, mutation, persistence, or platform behavior.
 */

import type {
  ConversationExternalRef,
  ConversationId,
  MessageId,
} from "./conversation-identity.js";
import type { CustomerExternalRef } from "./customer.js";
import type {
  MerchantId,
  PlatformAccountId,
  PlatformId,
  StoreId,
} from "./merchant-domain.js";

/** Runtime shop registry identity. It is intentionally not StoreId or PlatformAccountId. */
export interface RuntimeShopRef {
  readonly value: string;
}

/** Canonical identity resolution states. Unknown identities never use placeholders. */
export type IdentityResolution<T> =
  | { readonly status: "RESOLVED"; readonly value: T }
  | { readonly status: "UNKNOWN" }
  | { readonly status: "UNRESOLVED" };

/**
 * Platform message identity provenance.
 * LOCAL_FINGERPRINT and SYNTHETIC remain distinct from authoritative platform IDs.
 */
export type PlatformMessageIdentity =
  | {
      readonly provenance: "AUTHORITATIVE_PLATFORM_ID";
      readonly value: string;
    }
  | {
      readonly provenance: "LOCAL_FINGERPRINT";
      readonly value: string;
    }
  | {
      readonly provenance: "SYNTHETIC";
      readonly value: string;
    }
  | {
      readonly provenance: "UNKNOWN";
    };

/** Immutable selected-customer runtime evidence, not canonical customer identity. */
export type RuntimeSelectedCustomerObservation =
  | {
      readonly status: "SELECTED";
      readonly platformCustomerId: CustomerExternalRef;
    }
  | { readonly status: "NONE" }
  | { readonly status: "UNKNOWN" };

/** Runtime/session/document evidence retained with the identity snapshot. */
export interface RuntimeIdentityEvidence {
  readonly sessionId?: string;
  readonly documentGeneration?: number;
  readonly selectedCustomerObservation?: RuntimeSelectedCustomerObservation;
}

/** Triggering inbound message identity owned by the IdentityLock. */
export interface TriggeringInboundMessageIdentity {
  readonly localMessageId: IdentityResolution<MessageId>;
  readonly platformMessageIdentity: PlatformMessageIdentity;
}

/**
 * Immutable identity scope for an inbound message.
 *
 * Runtime shop, platform customer identity, and internal conversation identity
 * are distinct fields and must never be substituted for one another.
 */
export interface IdentityLock {
  readonly platform: PlatformId;
  readonly runtimeShop: IdentityResolution<RuntimeShopRef>;
  readonly merchantId: IdentityResolution<MerchantId>;
  readonly storeId: IdentityResolution<StoreId>;
  readonly platformAccountId: IdentityResolution<PlatformAccountId>;
  readonly platformCustomerId: IdentityResolution<CustomerExternalRef>;
  readonly internalConversationId: IdentityResolution<ConversationId>;
  readonly runtimeConversationReference: IdentityResolution<ConversationExternalRef>;
  readonly triggerMessage: TriggeringInboundMessageIdentity;
  readonly runtimeEvidence?: RuntimeIdentityEvidence;
}

/** Source content owned by the inbound envelope. */
export interface InboundSourceContent {
  readonly kind: "text";
  readonly text: string;
}

/**
 * Canonical inbound source boundary.
 *
 * Source platform and message identity live only in identityLock.triggerMessage.
 * This envelope owns source content and occurrence time and excludes downstream
 * AI, Scene, ContextEnvelope, Policy, ReplyPlan, send, and delivery facts.
 */
export interface InboundEnvelope {
  readonly identityLock: IdentityLock;
  readonly sourceContent: InboundSourceContent;
  readonly sourceOccurredAt: string | null;
}
