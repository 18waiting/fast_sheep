import { test } from "node:test";
import assert from "node:assert/strict";
import { platformPermissionDecision, SENSITIVE_PERMISSIONS } from "../dist/main/platforms/shared/platform-permission-policy.js";

test("permissions deny by default for all sensitive permissions", () => {
  for (const perm of SENSITIVE_PERMISSIONS) {
    assert.equal(platformPermissionDecision(perm), false, perm);
  }
  assert.equal(platformPermissionDecision("camera"), false);
});
