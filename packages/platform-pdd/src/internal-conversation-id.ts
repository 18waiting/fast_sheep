// SHEEP-301: internal conversation id derivation.
//
// Contract reuse, no new identity model:
// - The canonical identity binding expects an `internalConversationId: IdentityResolution<ConversationId>`
//   supplied by the trusted resolver; this module only provides the DERIVATION for that value so the
//   same customer in two different platform accounts never collapses into one conversation.
// - Platform facts only: the platform account (authoritative commercial/fact scope) plus the platform
//   customer id. No nickname, no selected customer, no page state, no message content.
// - Insufficient identity returns null (explicit UNKNOWN). Ids are never fabricated from a partial fact.
// - Deterministic and stable: the same (platform account, customer) always yields the same id, so the
//   existing save/query/dedupe paths keep working unchanged (the dedupe key already scopes by
//   conversation id, and that id is now scope-qualified).

const CUSTOMER_ID_PATTERN = /^\d+$/;

export interface PddConversationScopeFact {
  readonly platformAccountId: string;
}

/**
 * Derive the internal conversation id for one customer inside one platform account.
 * Returns null when either fact is missing or malformed, so the caller can keep identity UNKNOWN
 * instead of inventing an association.
 */
export function deriveInternalConversationId(
  scope: PddConversationScopeFact,
  platformCustomerId: unknown,
): string | null {
  if (scope === null || typeof scope !== "object") return null;
  const accountId = scope.platformAccountId;
  if (typeof accountId !== "string" || accountId.trim().length === 0) return null;
  if (typeof platformCustomerId !== "string" || !CUSTOMER_ID_PATTERN.test(platformCustomerId)) return null;
  return "conversation:" + accountId + ":" + platformCustomerId;
}