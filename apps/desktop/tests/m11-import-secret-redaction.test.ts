import { test } from "node:test";
import assert from "node:assert/strict";
import { detectSecrets, providerSecretDecision } from "../../../packages/legacy-import/dist/index.js";

test("plaintext secrets never appear in detection output", () => {
  const r = detectSecrets({ api_key: "fake-super-secret-value", cookie: "SESSION=abc" });
  const json = JSON.stringify(r);
  assert.ok(!json.includes("fake-super-secret-value"));
  assert.ok(!json.includes("SESSION=abc"));
});

test("provider secret decision defaults to SKIP and stores credential_ref on consent", () => {
  assert.equal(providerSecretDecision({}, "api_key").action, "skip");
  const d = providerSecretDecision({ import_provider_secret: true }, "api_key");
  assert.equal(d.action, "store_ref");
  assert.ok(d.ref!.startsWith("cred_"));
});
