import { test } from "node:test";
import assert from "node:assert/strict";
import { DENY_ALL_MAIN_ADMISSION_PROVIDER, PddMainAdmissionRegistry } from "../dist/main/platforms/pdd/pdd-main-admission.js";

function fixture() {
  const webContents = { id: "wc-1" };
  const connection = {
    webContents,
    observerId: "observer-1",
    observerLifecycleId: 1,
    sessionId: "session-1",
    shopId: "shop-1",
    documentGeneration: 1,
    cdpSessionId: "",
    requestId: "request-1",
    url: "ws://127.0.0.1:1/socket",
  };
  const binding = { sessionId: "session-1", shopId: "shop-1", documentGeneration: 1 };
  return { webContents, connection, binding, request: { webContents, connection, binding } };
}

test("default admission provider denies canonical output", () => {
  const registry = new PddMainAdmissionRegistry(DENY_ALL_MAIN_ADMISSION_PROVIDER);
  const decision = registry.evaluate(fixture().request as never);
  assert.deepEqual(decision, { granted: false, reason: "MAIN_ADMISSION_DENIED_DEFAULT" });
});

test("granted admission validates object identity, lifecycle, scope, and connection evidence", () => {
  const f = fixture();
  const registry = new PddMainAdmissionRegistry({ evaluate: () => ({ granted: true, admissionId: "provider-value-must-not-be-used" }) } as never);
  const decision = registry.evaluate(f.request as never);
  assert.equal(decision.granted, true);
  assert.notEqual(decision.admissionId, "provider-value-must-not-be-used");
  assert.equal(registry.validate(decision.admissionId, f.request as never), true);
  assert.equal(registry.validate(decision.admissionId, { ...f.request, webContents: { id: "wc-1" } } as never), false);
  assert.equal(registry.validate(decision.admissionId, { ...f.request, binding: { ...f.binding, documentGeneration: 2 } } as never), false);
  assert.equal(registry.validate(decision.admissionId, { ...f.request, connection: { ...f.connection, requestId: "request-2" } } as never), false);
});

test("revocation and provider exceptions fail closed", () => {
  const f = fixture();
  const registry = new PddMainAdmissionRegistry({ evaluate: () => ({ granted: true, admissionId: "x" }) } as never);
  const decision = registry.evaluate(f.request as never);
  assert.equal(decision.granted, true);
  registry.revoke(decision.admissionId);
  assert.equal(registry.validate(decision.admissionId, f.request as never), false);

  const throwing = new PddMainAdmissionRegistry({ evaluate: () => { throw new Error("provider"); } } as never);
  assert.deepEqual(throwing.evaluate(f.request as never), { granted: false, reason: "MAIN_ADMISSION_PROVIDER_THREW" });
});
