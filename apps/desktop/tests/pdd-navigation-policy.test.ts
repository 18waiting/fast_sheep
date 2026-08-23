import { test } from "node:test";
import assert from "node:assert/strict";
import { isPddNavigationAllowed, isPddPopupAllowed } from "../dist/main/platforms/pdd/pdd-navigation-policy.js";

test("test mode allows only local file URLs (no remote PDD)", () => {
  assert.equal(isPddNavigationAllowed("file:///C:/fixture/chat-basic.html", { allowedProductionHosts: [], testMode: true }), true);
  assert.equal(isPddNavigationAllowed("https://mms.pinduoduo.com", { allowedProductionHosts: [], testMode: true }), false);
  assert.equal(isPddNavigationAllowed("http://evil.example", { allowedProductionHosts: [], testMode: true }), false);
});

test("production allows only configured https hosts (no fake default)", () => {
  assert.equal(isPddNavigationAllowed("https://mms.example.com", { allowedProductionHosts: ["mms.example.com"], testMode: false }), true);
  assert.equal(isPddNavigationAllowed("https://other.example.com", { allowedProductionHosts: ["mms.example.com"], testMode: false }), false);
  assert.equal(isPddNavigationAllowed("http://mms.example.com", { allowedProductionHosts: ["mms.example.com"], testMode: false }), false);
  assert.equal(isPddNavigationAllowed("file:///x.html", { allowedProductionHosts: [], testMode: false }), false);
});

test("popups are denied by default", () => {
  assert.equal(isPddPopupAllowed("https://evil.example", { allowedProductionHosts: [], testMode: true }), false);
});
