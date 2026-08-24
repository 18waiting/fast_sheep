// M1.5-R01: SecretStore Foundation.
export {
  SecretStoreError, SECRET_STORE_ERROR_CODES, isValidSecretKey, SECRET_KEY_PATTERN, SECRET_STORE_NAMESPACE_DISCIPLINE,
} from "./secret-store.js";
export type { SecretStore, SecretKey, SecretValue } from "./secret-store.js";
export { OsBackedSecretStore } from "./os-backed.js";
export type { SecureCipher } from "./os-backed.js";
export { InMemorySecretStore, IN_MEMORY_SECRET_STORE_TEST_ONLY } from "./in-memory.js";