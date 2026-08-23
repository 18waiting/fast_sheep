/**
 * Merchant Domain Model (SHEEP-010, Phase 1 / M1.1 Core Identity Domain).
 *
 * Clean-room, governance-derived only:
 * - Master §5.4: data model introduces merchant_id / store_id / platform_account_id scoping.
 * - Master §7: Account -> Merchant/Organization -> Membership.
 * - DEC-015: seller/platform identity is local-first; Cloud stores registration/metadata.
 * - R-07 identity analysis: local entity identity != platform external identity != cloud authoritative identity.
 *
 * Owner SHEEP-010 tightening constraints applied:
 * 1. No status vocabularies without governance evidence -> NO status/enabled fields here.
 * 2. Platform identifiers remain extensible -> `PlatformId` is a string, not a closed union.
 * 3. AccountRef carries only identity-kind boundary; NO remote sync id / revision / outbox / sync semantics.
 * 4. Only governance-confirmed scope relations: Merchant -> Store, Merchant -> PlatformAccount.
 *    No invented strong hierarchy/business rules.
 */

/** Extensible platform identifier (string). Known platforms exported as constants; future platforms are allowed. */
export type PlatformId = string;

export const PLATFORM_PDD: PlatformId = "pdd";
export const PLATFORM_DOUDIAN: PlatformId = "doudian";
export const PLATFORM_JD: PlatformId = "jd";
export const PLATFORM_KUAISHOU: PlatformId = "kuaishou";
export const PLATFORM_QIANNIU: PlatformId = "qianniu";
export const PLATFORM_XIANYU: PlatformId = "xianyu";

/**
 * Identity domain boundary (R-07 / IDENTITY ANALYSIS):
 * local entity identity != platform external identity != cloud authoritative identity.
 */
export type IdentityKind = "local" | "platform" | "cloud";

/**
 * AccountRef: identity reference capability only.
 * Records WHICH identity domain a reference belongs to and the opaque reference value.
 * Deliberately carries no remote sync id, revision, outbox, or conflict semantics.
 */
export interface AccountRef {
  readonly kind: IdentityKind;
  readonly value: string;
}

/** Opaque, branded local identity ids. */
export type MerchantId = string & { readonly __merchant: true };
export type StoreId = string & { readonly __store: true };
export type PlatformAccountId = string & { readonly __platformAccount: true };

/** Merchant: top-level merchant/tenant scope. No status vocabulary (no governance evidence to add one). */
export interface Merchant {
  readonly id: MerchantId;
  readonly name: string;
}

/** Store: belongs to exactly one Merchant (governance-confirmed scope). */
export interface Store {
  readonly id: StoreId;
  readonly merchantId: MerchantId;
  readonly name: string;
  readonly platform: PlatformId;
}

/** PlatformAccount: seller platform account, scoped to a Merchant; carries external platform identity. */
export interface PlatformAccount {
  readonly id: PlatformAccountId;
  readonly merchantId: MerchantId;
  readonly platform: PlatformId;
  /** External platform identity reference (IdentityKind = "platform"). */
  readonly externalRef: AccountRef;
}