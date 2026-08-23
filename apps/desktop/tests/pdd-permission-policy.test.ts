import { test } from "node:test";
import assert from "node:assert/strict";
import { pddPermissionDecision, isSensitivePermission, SENSITIVE_PERMISSIONS } from "../dist/main/platforms/pdd/pdd-permission-policy.js";

test("sensitive permissions are denied by default", () => {
  for (const perm of SENSITIVE_PERMISSIONS) {
    assert.equal(pddPermissionDecision(perm), false, perm);
    assert.equal(isSensitivePermission(perm), true, perm);
  }
});

test("even unknown permissions are denied (deny-by-default)", () => {
  assert.equal(pddPermissionDecision("notifications"), false);
  assert.equal(pddPermissionDecision("geolocation"), false);
  assert.equal(pddPermissionDecision("camera"), false);
});
