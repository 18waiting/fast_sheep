import { test } from "node:test";
import assert from "node:assert/strict";
import { detectSecrets, providerSecretDecision, SELLER_SECRET_FIELDS, PROVIDER_SECRET_FIELDS } from "../dist/index.js";

test("seller secrets are detected and never importable", () => {
  const r = detectSecrets({ cookie: "x", session_token: "y", password: "z" });
  assert.ok(r.seller_secrets_detected.includes("cookie"));
  assert.ok(r.seller_secrets_detected.includes("session_token"));
  assert.ok(r.seller_secrets_detected.includes("password"));
  assert.ok(r.plaintext_must_not_persist.length >= 3);
});

test("provider secrets default to SKIP; explicit consent yields a credential_ref", () => {
  const r = detectSecrets({ api_key: "fake-super-secret-value" });
  assert.ok(r.provider_secrets_detected.includes("api_key"));
  assert.equal(providerSecretDecision({}, "api_key").action, "skip");
  assert.equal(providerSecretDecision({ import_provider_secret: true }, "api_key").action, "store_ref");
});

test("detection returns field names, never values", () => {
  const r = detectSecrets({ api_key: "fake-super-secret-value" });
  assert.ok(!JSON.stringify(r).includes("fake-super-secret-value"));
});
