/**
 * SHEEP-300 canonical inbound identity contract foundation.
 *
 * **Domain Layer Types — Not a Mirror of JSON Schema**
 *
 * These TypeScript types define the domain layer identity model using
 * `IdentityResolution<T>` to express identity resolution states (RESOLVED,
 * UNKNOWN, UNRESOLVED). This is distinct from the JSON Schema definitions
 * in `resources/contracts/schemas/domain/context-envelope.schema.json`.
 *
 * **Key Differences from JSON Schema:**
 * - Domain Model uses `IdentityResolution<T>` wrapper for identity states
 * - JSON Schema uses flat strings with snake_case naming
 * - Domain Model uses camelCase naming
 * - Domain Model has richer type information (e.g., `PlatformMessageIdentity`)
 *
 * **Serialization Boundary:**
 * When these types need to be serialized to JSON Schema format (e.g., for
 * cross-process communication), an explicit mapping layer must be implemented.
 * As of 2026-09-28, no such mapping exists because ContextEnvelope has no
 * consumer yet (SHEEP-306 is contract definition only).
 *
 * **Active Consumers:**
 * - `packages/platform-pdd/src/inbound-to-canonical.ts` — builds InboundEnvelope
 * - `apps/desktop/src/main/platforms/pdd/pdd-inbound-ingress.ts` — validates envelopes
 * - `apps/desktop/src/main/services/canonical-inbound-persistence.ts` — persists envelopes
 *
 * These types do not add mapping, construction, mutation, persistence, or
 * platform behavior. They are readonly domain contracts.
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

/**
 * Canonical identity resolution states. Unknown identities never use placeholders.
 *
 * This wrapper type allows the domain layer to express three distinct states:
 * - RESOLVED: Identity is known and has a value
 * - UNKNOWN: Identity cannot be determined (e.g., customer not logged in)
 * - UNRESOLVED: Identity resolution is in progress or deferred
 *
 * This is intentionally different from the JSON Schema's flat string approach.
 * The domain layer needs this richness to handle identity resolution correctly.
 */
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
 *
 * **Note:** This is the domain layer representation. The JSON Schema representation
 * (in `context-envelope.schema.json`) uses flat strings and snake_case naming.
 * They serve different purposes and are not directly interchangeable.
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
