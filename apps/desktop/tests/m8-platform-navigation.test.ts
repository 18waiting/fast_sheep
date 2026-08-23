import { test } from "node:test";
import assert from "node:assert/strict";
import { isPlatformNavigationAllowed, isPlatformPopupAllowed } from "../dist/main/platforms/shared/platform-navigation-policy.js";

test("navigation allowlist: test mode local-only; production hosts config-provided", () => {
  assert.equal(isPlatformNavigationAllowed("file:///C:/f.html", { allowedProductionHosts: [], testMode: true }), true);
  assert.equal(isPlatformNavigationAllowed("https://evil.example", { allowedProductionHosts: [], testMode: true }), false);
  assert.equal(isPlatformNavigationAllowed("https://allowed.example", { allowedProductionHosts: ["allowed.example"], testMode: false }), true);
  assert.equal(isPlatformNavigationAllowed("https://other.example", { allowedProductionHosts: ["allowed.example"], testMode: false }), false);
  assert.equal(isPlatformPopupAllowed(), false);
});
