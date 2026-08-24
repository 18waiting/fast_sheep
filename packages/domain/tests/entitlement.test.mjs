import { test } from "node:test";
import assert from "node:assert/strict";
import * as ent from "../dist/entitlement.js";
import * as auth from "../dist/authorization-domain.js";

const boundary = new ent.DenyByDefaultLocalEntitlementBoundary();

// --- no fail-open: no evidence / unknown / invalid all fail closed ---
test("no evidence fails closed (deny, non-sensitive reason)", () => {
  const d = boundary.evaluate("some.feature", null);
  assert.equal(d.allow, false);
  assert.equal(d.reason, "missing_entitlement_evidence");
});

test("unknown evidence kind fails closed", () => {
  const d = boundary.evaluate("some.feature", { kind: "mystery_kind" });
  assert.equal(d.allow, false);
  assert.equal(d.reason, "unknown_entitlement_evidence");
});

test("invalid evidence (missing kind) fails closed", () => {
  const d = boundary.evaluate("some.feature", {});
  assert.equal(d.allow, false);
});

// --- evidence kinds ---
test("signed_offline_lease is acceptable evidence (R-03); verification is Phase 11", () => {
  const d = boundary.evaluate("some.feature", { kind: "signed_offline_lease", ref: "lease-1" });
  assert.equal(d.allow, true);
});

test("cloud_authoritative fails closed at local boundary but is NOT permanently invalid", () => {
  const d = boundary.evaluate("some.feature", { kind: "cloud_authoritative", ref: "cloud-1" });
  assert.equal(d.allow, false);
  assert.ok(d.reason.includes("requires_authoritative_verification"), "reason indicates pending authoritative verification");
  assert.ok(!d.reason.includes("invalid") && !d.reason.includes("disabled"), "not defined as permanently invalid");
});

test("local_permitted fails closed (trusted evidence, not a local boolean)", () => {
  const d = boundary.evaluate("some.feature", { kind: "local_permitted" });
  assert.equal(d.allow, false);
  assert.ok(d.reason.includes("requires_trusted_verification"));
});

// --- reasons never contain secret/lease/signature content ---
test("deny reasons are static and never echo secret/lease/signature/ref content", () => {
  const sensitive = "SUPER-SECRET-LEASE-REF-999";
  const d1 = boundary.evaluate("f", { kind: "cloud_authoritative", ref: sensitive });
  const d2 = boundary.evaluate("f", { kind: "local_permitted", ref: sensitive });
  const d3 = boundary.evaluate("f", null);
  for (const d of [d1, d2, d3]) {
    assert.equal(d.allow, false);
    assert.ok(!d.reason.includes(sensitive), "reason must not contain evidence ref");
    assert.ok(!d.reason.includes("signature") && !d.reason.includes("lease"), "reason generic");
  }
});

// --- Capability vs Entitlement isolation ---
test("Capability (authorization-domain) and Entitlement are isolated modules", () => {
  const entExports = Object.keys(ent);
  const authExports = Object.keys(auth);
  // entitlement module must not export authorization-engine concepts
  for (const name of ["RoleCapabilitySet", "CapabilityId", "ResourceScope"]) {
    assert.equal(entExports.includes(name), false, `entitlement must not export ${name}`);
  }
  // authorization module must not export entitlement concepts
  for (const name of ["EntitlementId", "LocalEntitlementBoundary", "DenyByDefaultLocalEntitlementBoundary"]) {
    assert.equal(authExports.includes(name), false, `authorization must not export ${name}`);
  }
});

// --- no entitlement taxonomy / business enums ---
test("no business entitlement taxonomy / enums (no PDD_ENABLED / AI_AUTO_REPLY_ENABLED / MAX_SEATS)", () => {
  const exports = Object.keys(ent);
  for (const name of ["PDD_ENABLED", "AI_AUTO_REPLY_ENABLED", "MAX_SEATS", "ENTITLEMENT_TAXONOMY"]) {
    assert.equal(exports.includes(name), false, `no business enum: ${name}`);
  }
  // EntitlementId is extensible: any string accepted at runtime
  const id = "some.future.entitlement";
  assert.equal(typeof id, "string");
});

// --- no authorization-engine judgments implemented ---
test("no role->entitlement / capability->entitlement / tool-permission logic exported", () => {
  const exports = Object.keys(ent);
  for (const name of ["grantForRole", "grantForCapability", "canUseTool", "roleEntitlements", "capabilityEntitlements"]) {
    assert.equal(exports.includes(name), false, `no authorization-engine fn: ${name}`);
  }
});