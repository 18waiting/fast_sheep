/**
 * TEST-ONLY in-memory SecretStore. NOT_PRODUCTION_SAFE — never use at runtime.
 * Construction requires { testOnly: true } to prevent accidental production use.
 */

import {
  SecretStore, SecretKey, SecretValue, SecretStoreError, SECRET_STORE_ERROR_CODES, isValidSecretKey,
} from "./secret-store.js";

export const IN_MEMORY_SECRET_STORE_TEST_ONLY = true;

export class InMemorySecretStore implements SecretStore {
  private map = new Map<SecretKey, SecretValue>();

  constructor(opts: { testOnly: true }) {
    if (!opts || opts.testOnly !== true) {
      throw new SecretStoreError(SECRET_STORE_ERROR_CODES.TEST_ONLY_GUARD, "InMemorySecretStore is TEST_ONLY / NOT_PRODUCTION_SAFE");
    }
  }

  set(key: SecretKey, value: SecretValue): void {
    if (!isValidSecretKey(key)) throw new SecretStoreError(SECRET_STORE_ERROR_CODES.INVALID_KEY, "invalid secret key");
    this.map.set(key, value);
  }
  get(key: SecretKey): SecretValue | null {
    if (!isValidSecretKey(key)) throw new SecretStoreError(SECRET_STORE_ERROR_CODES.INVALID_KEY, "invalid secret key");
    return this.map.get(key) ?? null;
  }
  remove(key: SecretKey): void {
    if (!isValidSecretKey(key)) throw new SecretStoreError(SECRET_STORE_ERROR_CODES.INVALID_KEY, "invalid secret key");
    this.map.delete(key);
  }
  has(key: SecretKey): boolean {
    if (!isValidSecretKey(key)) throw new SecretStoreError(SECRET_STORE_ERROR_CODES.INVALID_KEY, "invalid secret key");
    return this.map.has(key);
  }
}