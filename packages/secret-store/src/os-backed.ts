/**
 * OS-backed SecretStore implementation (M1.5-R01).
 *
 * Mechanism: an injected SecureCipher backed by OS-level encryption — in the
 * Electron Main process this is Electron `safeStorage` (Windows: DPAPI; macOS:
 * Keychain; Linux: libsecret). The cipher is injected so this package does not
 * hard-depend on Electron and the mechanism is NOT locked as the only architecture
 * (Phase 13 may add more). Encrypted blobs are persisted in a local JSON file
 * (atomic write via temp+rename); the file contains NO plaintext.
 *
 * Runtime behavior: FAIL CLOSED. If the OS-backed cipher is unavailable, the store
 * refuses to initialize (throws) and never silently falls back to InMemory or
 * plaintext storage. Any decrypt/storage failure throws; errors never include the
 * secret value.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  SecretStore, SecretKey, SecretValue, SecretStoreError, SECRET_STORE_ERROR_CODES, isValidSecretKey,
} from "./secret-store.js";

/** OS-backed encryption provider (e.g., Electron safeStorage in Main). */
export interface SecureCipher {
  readonly isSecureAvailable: boolean;
  encrypt(plaintext: SecretValue): Uint8Array;
  decrypt(ciphertext: Uint8Array): SecretValue;
}

interface StoredEntry {
  alg: string;
  blob: string; // base64 of ciphertext (never plaintext)
}

interface StoreFile {
  version: 1;
  entries: Record<string, StoredEntry>;
}

const STORE_VERSION = 1 as const;
const STORE_ALG = "os" as const;

export class OsBackedSecretStore implements SecretStore {
  private entries: Record<string, StoredEntry> = {};
  private dirty = false;

  constructor(
    private readonly cipher: SecureCipher,
    private readonly filePath: string,
  ) {
    if (!cipher.isSecureAvailable) {
      throw new SecretStoreError(SECRET_STORE_ERROR_CODES.UNAVAILABLE, "OS-backed secure storage unavailable; failing closed (no fallback to InMemory/plaintext)");
    }
    this.load();
  }

  private load(): void {
    if (!existsSync(this.filePath)) return;
    let parsed: StoreFile;
    try {
      parsed = JSON.parse(readFileSync(this.filePath, "utf-8")) as StoreFile;
    } catch {
      throw new SecretStoreError(SECRET_STORE_ERROR_CODES.STORAGE_FAILED, "secret store file unreadable");
    }
    if (!parsed || parsed.version !== STORE_VERSION || !parsed.entries || typeof parsed.entries !== "object") {
      throw new SecretStoreError(SECRET_STORE_ERROR_CODES.STORAGE_FAILED, "secret store file malformed");
    }
    this.entries = parsed.entries;
  }

  private persist(): void {
    const file: StoreFile = { version: STORE_VERSION, entries: this.entries };
    const dir = dirname(this.filePath);
    mkdirSync(dir, { recursive: true });
    const temp = join(dir, `.secret-store-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
    try {
      writeFileSync(temp, JSON.stringify(file), "utf-8");
      renameSync(temp, this.filePath); // atomic replace
    } catch (e) {
      if (existsSync(temp)) rmSync(temp, { force: true });
      throw new SecretStoreError(SECRET_STORE_ERROR_CODES.STORAGE_FAILED, "secret store write failed");
    }
  }

  set(key: SecretKey, value: SecretValue): void {
    if (!isValidSecretKey(key)) throw new SecretStoreError(SECRET_STORE_ERROR_CODES.INVALID_KEY, "invalid secret key");
    let enc: Uint8Array;
    try {
      enc = this.cipher.encrypt(value);
    } catch {
      throw new SecretStoreError(SECRET_STORE_ERROR_CODES.UNAVAILABLE, "OS-backed encryption failed");
    }
    this.entries[key] = { alg: STORE_ALG, blob: Buffer.from(enc).toString("base64") };
    this.persist();
  }

  get(key: SecretKey): SecretValue | null {
    if (!isValidSecretKey(key)) throw new SecretStoreError(SECRET_STORE_ERROR_CODES.INVALID_KEY, "invalid secret key");
    const entry = this.entries[key];
    if (!entry) return null;
    let decrypted: SecretValue;
    try {
      decrypted = this.cipher.decrypt(new Uint8Array(Buffer.from(entry.blob, "base64")));
    } catch {
      throw new SecretStoreError(SECRET_STORE_ERROR_CODES.DECRYPT_FAILED, "secret decrypt failed");
    }
    return decrypted;
  }

  remove(key: SecretKey): void {
    if (!isValidSecretKey(key)) throw new SecretStoreError(SECRET_STORE_ERROR_CODES.INVALID_KEY, "invalid secret key");
    if (Object.prototype.hasOwnProperty.call(this.entries, key)) {
      delete this.entries[key];
      this.persist();
    }
  }

  has(key: SecretKey): boolean {
    if (!isValidSecretKey(key)) throw new SecretStoreError(SECRET_STORE_ERROR_CODES.INVALID_KEY, "invalid secret key");
    return Object.prototype.hasOwnProperty.call(this.entries, key);
  }
}