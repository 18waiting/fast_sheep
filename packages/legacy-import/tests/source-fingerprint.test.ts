import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fingerprintFile, fingerprintString } from "../dist/index.js";

test("fingerprint is sha256 + size + mtime", async () => {
  const root = mkdtempSync(join(tmpdir(), "fw-fp-"));
  const p = join(root, "a.txt");
  writeFileSync(p, "hello");
  const fp = await fingerprintFile(p);
  assert.equal(fp.sha256.length, 64);
  assert.equal(fp.size, 5);
  assert.ok(fp.mtime_ms > 0);
});

test("fingerprint changes when content changes", async () => {
  const root = mkdtempSync(join(tmpdir(), "fw-fp2-"));
  const p = join(root, "a.txt");
  writeFileSync(p, "v1");
  const a = await fingerprintFile(p);
  writeFileSync(p, "v2");
  const b = await fingerprintFile(p);
  assert.notEqual(a.sha256, b.sha256);
});

test("fingerprintString is deterministic", () => {
  assert.equal(fingerprintString("x"), fingerprintString("x"));
  assert.notEqual(fingerprintString("x"), fingerprintString("y"));
});
