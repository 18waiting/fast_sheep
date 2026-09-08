import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PlatformAccountRecord, PlatformAccountRepository } from "@fastwork/persistence";
import type { SecretKey, SecretStore, SecretValue } from "@fastwork/secret-store";
import {
  PddSecretReferenceError,
  PddSecretReferenceService,
  PDD_SECRET_REFERENCE_ERROR_CODES,
} from "../dist/main/services/pdd-credential-reference-service.js";

const MERCHANT_A = "merchant-a";
const MERCHANT_B = "merchant-b";
const ACCOUNT_A = "platform-account-a";
const ACCOUNT_B = "platform-account-b";
const ACCOUNT_OTHER_MERCHANT = "platform-account-other-merchant";
const NON_PDD_ACCOUNT = "platform-account-doudian";

class FakePlatformAccountRepository implements PlatformAccountRepository {
  readonly accounts = new Map<string, PlatformAccountRecord>();

  findById(id: string): PlatformAccountRecord | null {
    const account = this.accounts.get(id);
    return account ? { ...account } : null;
  }

  listByMerchant(merchantId: string): PlatformAccountRecord[] {
    return [...this.accounts.values()]
      .filter((account) => account.merchantId === merchantId)
      .map((account) => ({ ...account }));
  }
}

class RecordingSecretStore implements SecretStore {
  readonly values = new Map<SecretKey, SecretValue>();
  readonly calls: Array<{ operation: string; key: SecretKey }> = [];
  failure: Error | null = null;

  set(key: SecretKey, value: SecretValue): void {
    this.calls.push({ operation: "set", key });
    this.throwIfFailed();
    this.values.set(key, value);
  }

  get(key: SecretKey): SecretValue | null {
    this.calls.push({ operation: "get", key });
    this.throwIfFailed();
    return this.values.get(key) ?? null;
  }

  remove(key: SecretKey): void {
    this.calls.push({ operation: "remove", key });
    this.throwIfFailed();
    this.values.delete(key);
  }

  has(key: SecretKey): boolean {
    this.calls.push({ operation: "has", key });
    this.throwIfFailed();
    return this.values.has(key);
  }

  private throwIfFailed(): void {
    if (this.failure) throw this.failure;
  }
}

function account(id: string, merchantId = MERCHANT_A, platform = "pdd", externalRef: string | null = null): PlatformAccountRecord {
  return { id, merchantId, platform, externalRef };
}

function setup(): { repository: FakePlatformAccountRepository; store: RecordingSecretStore; service: PddSecretReferenceService } {
  const repository = new FakePlatformAccountRepository();
  repository.accounts.set(ACCOUNT_A, account(ACCOUNT_A));
  repository.accounts.set(ACCOUNT_B, account(ACCOUNT_B));
  repository.accounts.set(ACCOUNT_OTHER_MERCHANT, account(ACCOUNT_OTHER_MERCHANT, MERCHANT_B));
  repository.accounts.set(NON_PDD_ACCOUNT, account(NON_PDD_ACCOUNT, MERCHANT_A, "doudian"));
  const store = new RecordingSecretStore();
  return { repository, store, service: new PddSecretReferenceService(store, repository, MERCHANT_A) };
}

test("valid PDD account supports register -> has -> resolve with synthetic material", () => {
  const { service } = setup();
  service.register(ACCOUNT_A, "synthetic-value-a");
  assert.equal(service.has(ACCOUNT_A), true);
  assert.equal(service.resolve(ACCOUNT_A), "synthetic-value-a");
});

test("replace writes the same account-derived reference and changes only the stored value", () => {
  const { service, store } = setup();
  service.register(ACCOUNT_A, "synthetic-value-before");
  const firstKey = store.calls[0]?.key;
  service.replace(ACCOUNT_A, "synthetic-value-after");
  assert.equal(store.calls[1]?.key, firstKey);
  assert.equal(service.resolve(ACCOUNT_A), "synthetic-value-after");
});

test("a reconstructed Main service resolves an existing entry without a mapping row", () => {
  const { repository, store, service } = setup();
  service.register(ACCOUNT_A, "synthetic-restart-value");
  const reconstructed = new PddSecretReferenceService(store, repository, MERCHANT_A);
  assert.equal(reconstructed.resolve(ACCOUNT_A), "synthetic-restart-value");
});

test("missing and removed entries fail closed as unavailable", () => {
  const { service } = setup();
  assert.equal(service.has(ACCOUNT_A), false);
  assert.equal(service.resolve(ACCOUNT_A), null);
  service.register(ACCOUNT_A, "synthetic-removable-value");
  service.remove(ACCOUNT_A);
  assert.equal(service.has(ACCOUNT_A), false);
  assert.equal(service.resolve(ACCOUNT_A), null);
});

test("account-derived references isolate valid accounts", () => {
  const { service } = setup();
  service.register(ACCOUNT_A, "synthetic-account-a-value");
  assert.equal(service.resolve(ACCOUNT_B), null);
});

test("merchant mismatch fails before SecretStore access", () => {
  const { service, store } = setup();
  assert.throws(
    () => service.resolve(ACCOUNT_OTHER_MERCHANT),
    (error) => error instanceof PddSecretReferenceError && error.code === PDD_SECRET_REFERENCE_ERROR_CODES.ACCOUNT_SCOPE_MISMATCH,
  );
  assert.equal(store.calls.length, 0);
});

test("missing, invalid, and non-PDD accounts fail closed before SecretStore access", () => {
  const { service, store } = setup();
  assert.throws(() => service.has("missing-account"), PddSecretReferenceError);
  assert.throws(() => service.has(""), PddSecretReferenceError);
  assert.throws(
    () => service.has(NON_PDD_ACCOUNT),
    (error) => error instanceof PddSecretReferenceError && error.code === PDD_SECRET_REFERENCE_ERROR_CODES.ACCOUNT_PLATFORM_MISMATCH,
  );
  assert.equal(store.calls.length, 0);
});

test("SecretStore failures propagate without plaintext or alternate storage fallback", () => {
  const { service, store } = setup();
  const failure = new Error("synthetic store unavailable");
  store.failure = failure;
  assert.throws(() => service.register(ACCOUNT_A, "synthetic-failure-value"), failure);
  assert.throws(() => service.has(ACCOUNT_A), failure);
  assert.throws(() => service.resolve(ACCOUNT_A), failure);
  assert.throws(() => service.remove(ACCOUNT_A), failure);
  assert.equal(store.values.size, 0);
});

test("public service surface has no arbitrary key/reference operation", () => {
  const methods = Object.getOwnPropertyNames(PddSecretReferenceService.prototype).sort();
  assert.deepEqual(methods, ["constructor", "has", "register", "remove", "replace", "resolve"]);
});

test("externalRef changes do not affect derived lookup", () => {
  const { repository, service } = setup();
  service.register(ACCOUNT_A, "synthetic-external-ref-independent-value");
  repository.accounts.set(ACCOUNT_A, account(ACCOUNT_A, MERCHANT_A, "pdd", "changed-opaque-external-ref"));
  assert.equal(service.resolve(ACCOUNT_A), "synthetic-external-ref-independent-value");
});

test("credential reference boundary does not involve buyer or mall-side identity, session, IPC, or Renderer", () => {
  const source = readFileSync(join(process.cwd(), "src/main/services/pdd-credential-reference-service.ts"), "utf8");
  assert.doesNotMatch(source, /customerUid|mall_cs|mall-side|PddSession|ipc|Renderer|session state/i);
});
