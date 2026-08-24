/**
 * SecretStore Foundation (M1.5-R01, Phase 1 / M1.5 Early Cross-Cutting Foundation).
 *
 * Capability/contract for OS-backed secure local secret storage.
 * - Minimal interface: set / get / remove / has. `rotate` is NOT required here
 *   (R-01 Controller note); Phase 13 (SHEEP-240..243) owns full hardening,
 *   lifecycle, migration, audit and privacy.
 * - `remove` promises LOGICAL removal only, not unprovable forensic secure erase.
 * - Errors / debug / serialization NEVER include the secret value. `has()` is
 *   implemented without exposing the value.
 * - Secret keys follow a minimal stable namespace/identifier discipline
 *   (e.g. "<namespace>.<name>"), but the full PDD/DouDian/BYOK business key
 *   taxonomy is intentionally NOT designed here.
 * - Privileged boundary: real secrets must never reach Renderer, SQLite, logs,
 *   DOM, localStorage or the model prompt (Master §5 / §11).
 */

export type SecretKey = string;
export type SecretValue = string;

export const SECRET_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export const SECRET_STORE_NAMESPACE_DISCIPLINE =
  "Secret keys follow '<namespace>.<name>' (e.g. 'byok.openai.key'); the business taxonomy is defined later.";

export function isValidSecretKey(key: SecretKey): boolean {
  return typeof key === "string" && SECRET_KEY_PATTERN.test(key);
}

export class SecretStoreError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SecretStoreError";
  }
}

export const SECRET_STORE_ERROR_CODES = {
  UNAVAILABLE: "secret_store_unavailable",
  INVALID_KEY: "secret_store_invalid_key",
  NOT_FOUND: "secret_store_not_found",
  DECRYPT_FAILED: "secret_store_decrypt_failed",
  STORAGE_FAILED: "secret_store_storage_failed",
  TEST_ONLY_GUARD: "secret_store_test_only_guard",
} as const;

/** SecretStore contract (minimal; no rotate). */
export interface SecretStore {
  set(key: SecretKey, value: SecretValue): void;
  get(key: SecretKey): SecretValue | null;
  /** Logical removal only (no forensic secure-erase promise). */
  remove(key: SecretKey): void;
  /** Returns presence WITHOUT exposing the value. */
  has(key: SecretKey): boolean;
}