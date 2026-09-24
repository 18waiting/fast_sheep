import { test } from "node:test";
import assert from "node:assert/strict";
import { scanLine, isReviewedFinding, validateReviewLedger } from "../scripts/scan-sensitive-values.mjs";

const token = "syntheticOnlyToken1234567890";
const key = "api" + "_key";
const auth = "author" + "ization";

test("literal key assignments and Bearer values remain detectable", () => {
  for (const line of [
    `${key} = "${token}"`, `${key}: ${token}`,
    `"${key}": "${token}"`, `'${key}': '${token}'`,
    `${auth}: "Bearer ${token}"`, `"${auth}": "Bearer ${token}"`, `Bearer ${token}`,
    `${key} = "try_decrypt_text"`, "-----BEGIN " + "PRIVATE KEY-----",
  ]) assert.ok(scanLine(line).length > 0, "literal must be flagged");
});

test("a placeholder on the same line cannot suppress a real value", () => {
  const findings = scanLine(`${key} = "fake_placeholder"; ${auth} = "Bearer ${token}"`);
  assert.ok(findings.length > 0);
  assert.equal(scanLine(`"${key}": "fake_placeholder", "${auth}": "${token}"`).length, 1);
  assert.ok(findings.every((f) => !Object.hasOwn(f, "value")), "no raw value may escape the rule boundary");
});

test("dynamic producers and identifier names are not mistaken for literals", () => {
  for (const line of [
    `${auth} = request.headers.get("Authorization") or ""`,
    `${key} = try_decrypt_text(record.api_key_enc) if record.api_key_enc else ""`,
    "current_execution_authorization: current_execution_authorization,",
    `${key}=payload.api_key,`, `${key}=config.api_key,`,
    `${auth}: NOT_AUTHORIZED`,
    'headers={"Authorization": "Bearer not-a-real-token-12345"}',
  ]) assert.deepEqual(scanLine(line), []);
});


test("reviewed findings require exact path, category and full digest", () => {
  const path = "historical/tests/invalid-auth.py";
  const [known] = scanLine(`Bearer ${token}`);
  const reviewed = validateReviewLedger([{ path, name: known.name, digest: known.digest, reason: "INTENTIONALLY_INVALID_AUTH_TEST_FIXTURE" }]);
  assert.equal(isReviewedFinding(path, known, reviewed), true);
  assert.equal(isReviewedFinding("other/tests/invalid-auth.py", known, reviewed), false);
  assert.equal(isReviewedFinding(path, { ...known, name: "authorization" }, reviewed), false);
  assert.equal(isReviewedFinding(path, scanLine(`Bearer ${token}Different`)[0], reviewed), false);
  const anotherToken = "anotherSyntheticCredential123";
  const mixed = scanLine(`Bearer ${token}; Bearer ${anotherToken}`);
  assert.deepEqual(mixed.map((finding) => isReviewedFinding(path, finding, reviewed)), [true, false]);
});

test("review ledger rejects wildcards, traversals, truncated hashes and duplicates", () => {
  const [known] = scanLine(`Bearer ${token}`);
  const valid = { path: "historical/tests/invalid-auth.py", name: known.name, digest: known.digest, reason: "INTENTIONALLY_INVALID_AUTH_TEST_FIXTURE" };
  for (const invalid of [
    { ...valid, path: "../historical/tests/invalid-auth.py" },
    { ...valid, path: "*" },
    { ...valid, digest: known.digest.slice(0, 12) },
    { ...valid, reason: "UNKNOWN" },
  ]) {
    assert.throws(() => validateReviewLedger([invalid]));
  }
  assert.throws(() => validateReviewLedger([valid, valid]));
});
