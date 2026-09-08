import { createHash } from "node:crypto";
import type { PlatformAccountRecord, PlatformAccountRepository } from "@fastwork/persistence";
import type { SecretStore } from "@fastwork/secret-store";

const SECRET_KEY_NAMESPACE = "pdd.secret-ref.v1";
const PDD_PLATFORM = "pdd";

export const PDD_SECRET_REFERENCE_ERROR_CODES = {
  INVALID_ACCOUNT_ID: "invalid_account_id",
  ACCOUNT_NOT_FOUND: "account_not_found",
  ACCOUNT_SCOPE_MISMATCH: "account_scope_mismatch",
  ACCOUNT_PLATFORM_MISMATCH: "account_platform_mismatch",
  ACCOUNT_ID_MISMATCH: "account_id_mismatch",
  INVALID_SECRET_MATERIAL: "invalid_secret_material",
} as const;

export class PddSecretReferenceError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "PddSecretReferenceError";
  }
}

function validateAccountId(platformAccountId: string): void {
  if (
    typeof platformAccountId !== "string" ||
    platformAccountId.length === 0 ||
    platformAccountId.length > 256 ||
    platformAccountId.trim() !== platformAccountId
  ) {
    throw new PddSecretReferenceError(
      PDD_SECRET_REFERENCE_ERROR_CODES.INVALID_ACCOUNT_ID,
      "invalid PlatformAccount identity",
    );
  }
}

function deriveSecretKey(platformAccountId: string): string {
  const digest = createHash("sha256").update(platformAccountId, "utf8").digest("hex");
  return SECRET_KEY_NAMESPACE + "." + digest;
}

/**
 * Main-only composition boundary for one trusted merchant's local PDD accounts.
 * The derived SecretStore key is intentionally not part of this public contract.
 */
export class PddSecretReferenceService {
  #secretStore: SecretStore;
  #platformAccounts: PlatformAccountRepository;
  #trustedMerchantId: string;

  constructor(
    secretStore: SecretStore,
    platformAccounts: PlatformAccountRepository,
    trustedMerchantId: string,
  ) {
    if (typeof trustedMerchantId !== "string" || trustedMerchantId.length === 0 || trustedMerchantId.trim() !== trustedMerchantId) {
      throw new PddSecretReferenceError(
        PDD_SECRET_REFERENCE_ERROR_CODES.ACCOUNT_SCOPE_MISMATCH,
        "invalid trusted merchant scope",
      );
    }
    this.#secretStore = secretStore;
    this.#platformAccounts = platformAccounts;
    this.#trustedMerchantId = trustedMerchantId;
  }

  register(platformAccountId: string, secretMaterial: string): void {
    this.#store(platformAccountId, secretMaterial);
  }

  replace(platformAccountId: string, secretMaterial: string): void {
    this.#store(platformAccountId, secretMaterial);
  }

  has(platformAccountId: string): boolean {
    const account = this.#resolveAccount(platformAccountId);
    return this.#secretStore.has(deriveSecretKey(account.id));
  }

  resolve(platformAccountId: string): string | null {
    const account = this.#resolveAccount(platformAccountId);
    return this.#secretStore.get(deriveSecretKey(account.id));
  }

  remove(platformAccountId: string): void {
    const account = this.#resolveAccount(platformAccountId);
    this.#secretStore.remove(deriveSecretKey(account.id));
  }

  #store(platformAccountId: string, secretMaterial: string): void {
    const account = this.#resolveAccount(platformAccountId);
    if (typeof secretMaterial !== "string" || secretMaterial.length === 0) {
      throw new PddSecretReferenceError(
        PDD_SECRET_REFERENCE_ERROR_CODES.INVALID_SECRET_MATERIAL,
        "secret material must be non-empty opaque text",
      );
    }
    this.#secretStore.set(deriveSecretKey(account.id), secretMaterial);
  }

  #resolveAccount(platformAccountId: string): PlatformAccountRecord {
    validateAccountId(platformAccountId);
    const account = this.#platformAccounts.findById(platformAccountId);
    if (!account) {
      throw new PddSecretReferenceError(
        PDD_SECRET_REFERENCE_ERROR_CODES.ACCOUNT_NOT_FOUND,
        "PlatformAccount was not found",
      );
    }
    if (account.id !== platformAccountId) {
      throw new PddSecretReferenceError(
        PDD_SECRET_REFERENCE_ERROR_CODES.ACCOUNT_ID_MISMATCH,
        "PlatformAccount identity mismatch",
      );
    }
    if (account.merchantId !== this.#trustedMerchantId) {
      throw new PddSecretReferenceError(
        PDD_SECRET_REFERENCE_ERROR_CODES.ACCOUNT_SCOPE_MISMATCH,
        "PlatformAccount is outside the trusted merchant scope",
      );
    }
    if (account.platform !== PDD_PLATFORM) {
      throw new PddSecretReferenceError(
        PDD_SECRET_REFERENCE_ERROR_CODES.ACCOUNT_PLATFORM_MISMATCH,
        "PlatformAccount is not a PDD account",
      );
    }
    return account;
  }
}
