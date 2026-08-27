// M1.5-R01: SecretStore Foundation tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  OsBackedSecretStore, InMemorySecretStore, SecretStoreError,
  SECRET_STORE_ERROR_CODES, isValidSecretKey, SECRET_STORE_NAMESPACE_DISCIPLINE,
} from "../dist/index.js";
import { openDatabase, createBackup, DB_FILENAME, BACKUP_METADATA_FILENAME } from "../../persistence/dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fs-sec-")); }

// OS-backed stand-in cipher (XOR obfuscation; the REAL mechanism is Electron
// safeStorage / OS DPAPI in Main). Sufficient to prove storage format carries no plaintext.
// OS-backed stand-in cipher with a verifiable marker (real mechanism = Electron
// safeStorage / OS DPAPI in Main). Marker "S1:" lets decrypt reject corrupted blobs;
// stored bytes never contain the plaintext verbatim.
const mockCipher = {
  isSecureAvailable: true,
  encrypt: (s) => Uint8Array.from(Buffer.from("S1:" + Buffer.from(s, "utf-8").map((b) => b ^ 0x5a).toString("base64"), "utf-8")),
  decrypt: (c) => {
    const str = Buffer.from(c).toString("utf-8");
    if (!str.startsWith("S1:")) throw new Error("bad ciphertext");
    return Buffer.from(str.slice(3), "base64").map((b) => b ^ 0x5a).toString("utf-8");
  },
};

const SECRET = "SUPER-SECRET-TEST-12345";

test("OsBackedSecretStore round-trip: set/get returns value; has() is boolean without exposing value", () => {
  const r = root();
  const store = new OsBackedSecretStore(mockCipher, join(r, "secrets", "store.json"));
  store.set("test.namespace.key", SECRET);
  assert.equal(store.get("test.namespace.key"), SECRET);
  const has = store.has("test.namespace.key");
  assert.equal(typeof has, "boolean");
  assert.equal(has, true);
  assert.equal(store.has("missing"), false);
  assert.equal(store.get("missing"), null);
});

test("plaintext never enters the SecretStore file", () => {
  const r = root();
  const storePath = join(r, "secrets", "store.json");
  const store = new OsBackedSecretStore(mockCipher, storePath);
  store.set("test.plaintext", SECRET);
  const raw = readFileSync(storePath, "utf-8");
  assert.ok(!raw.includes(SECRET), "plaintext absent from store file");
});

test("plaintext never enters SQLite (scan db file bytes)", () => {
  const r = root();
  const dbPath = join(r, DB_FILENAME);
  const { conn } = openDatabase(r);
  conn.run("INSERT OR IGNORE INTO merchants (id, name) VALUES ('m1','m')");
  conn.close();
  const store = new OsBackedSecretStore(mockCipher, join(r, "secrets", "store.json"));
  store.set("test.sqlite", SECRET);
  const dbRaw = readFileSync(dbPath, "utf-8");
  assert.ok(!dbRaw.includes(SECRET), "plaintext absent from SQLite file");
});

test("errors/debug never include the secret value (decrypt failure)", () => {
  const r = root();
  const storePath = join(r, "secrets", "store.json");
  const store = new OsBackedSecretStore(mockCipher, storePath);
  store.set("test.bad", SECRET);
  // corrupt the stored blob so decrypt fails
  const raw = JSON.parse(readFileSync(storePath, "utf-8"));
  raw.entries["test.bad"].blob = "bm90LWEtYmxvYg=="; // base64 of "not-a-blob"

  writeFileSync(storePath, JSON.stringify(raw));
  const store2 = new OsBackedSecretStore(mockCipher, storePath);
  assert.throws(() => store2.get("test.bad"), (e) => {
    assert.ok(e instanceof SecretStoreError);
    assert.equal(e.code, SECRET_STORE_ERROR_CODES.DECRYPT_FAILED);
    assert.ok(!e.message.includes(SECRET), "error message must not contain secret");
    return true;
  });
});

test("fail closed: OS-backed cipher unavailable -> constructor throws, no fallback", () => {
  const r = root();
  assert.throws(
    () => new OsBackedSecretStore({ isSecureAvailable: false, encrypt: () => new Uint8Array(), decrypt: () => "" }, join(r, "s.json")),
    (e) => e instanceof SecretStoreError && e.code === SECRET_STORE_ERROR_CODES.UNAVAILABLE
  );
});

test("InMemorySecretStore is TEST_ONLY: guard requires {testOnly:true}", () => {
  assert.throws(() => new InMemorySecretStore(), (e) => e instanceof SecretStoreError && e.code === SECRET_STORE_ERROR_CODES.TEST_ONLY_GUARD);
  const s = new InMemorySecretStore({ testOnly: true });
  s.set("test.mem", SECRET);
  assert.equal(s.get("test.mem"), SECRET);
});

test("key discipline: valid namespaced keys accepted; invalid rejected", () => {
  assert.ok(isValidSecretKey("byok.openai.key"));
  assert.ok(isValidSecretKey("platform.pdd.account"));
  assert.ok(!isValidSecretKey("has space"));
  assert.ok(!isValidSecretKey("a/b"));
  assert.ok(!isValidSecretKey(""));
  assert.ok(!isValidSecretKey("a".repeat(200)));
  const r = root();
  const store = new OsBackedSecretStore(mockCipher, join(r, "secrets", "store.json"));
  assert.throws(() => store.set("bad/key", "v"), (e) => e.code === SECRET_STORE_ERROR_CODES.INVALID_KEY);
  assert.ok(SECRET_STORE_NAMESPACE_DISCIPLINE.length > 0);
});

test("remove is logical removal: get null, has false, file entry gone", () => {
  const r = root();
  const storePath = join(r, "secrets", "store.json");
  const store = new OsBackedSecretStore(mockCipher, storePath);
  store.set("test.remove", SECRET);
  store.remove("test.remove");
  assert.equal(store.get("test.remove"), null);
  assert.equal(store.has("test.remove"), false);
  const raw = JSON.parse(readFileSync(storePath, "utf-8"));
  assert.ok(!("test.remove" in raw.entries), "file entry removed");
});

test("M1.5-R06 linkage: DB backup does NOT contain the plaintext secret; Backup Manager unaware of SecretStore", () => {
  const r = root();
  const dbPath = join(r, DB_FILENAME);
  const { conn } = openDatabase(r);
  conn.run("INSERT OR IGNORE INTO merchants (id, name) VALUES ('m1','m')");
  conn.close();
  const store = new OsBackedSecretStore(mockCipher, join(r, "secrets", "store.json"));
  store.set("test.backup", SECRET);
  const meta = createBackup(dbPath, join(r, "backups"), 8);
  // backup DB file contains no plaintext secret
  const backupRaw = readFileSync(meta.backupFile, "utf-8");
  assert.ok(!backupRaw.includes(SECRET), "plaintext absent from backup DB");
  // backup dir contains only DB + metadata (no secret artifacts)
  const files = readdirSync(meta.backupDir).sort();
  assert.deepEqual(files, [BACKUP_METADATA_FILENAME, DB_FILENAME]);
  // secret store file lives outside backupRoot and is not referenced
  assert.ok(existsSync(join(r, "secrets", "store.json")));
});
