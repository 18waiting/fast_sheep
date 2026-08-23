import { test } from "node:test";
import assert from "node:assert/strict";
import { WINDOW_SECURITY, CSP, windowPolicy, isNavigationAllowed } from "../dist/main/window-policy.js";

test("window security baseline: contextIsolation=true, nodeIntegration=false, sandbox=true", () => {
  assert.equal(WINDOW_SECURITY.contextIsolation, true);
  assert.equal(WINDOW_SECURITY.nodeIntegration, false);
  assert.equal(WINDOW_SECURITY.sandbox, true);
  assert.equal(WINDOW_SECURITY.webSecurity, true);
});

test("CSP blocks remote script/network and local-only resources", () => {
  assert.match(CSP, /script-src 'self'/);
  assert.match(CSP, /connect-src 'none'/);
  assert.match(CSP, /default-src 'self'/);
  assert.doesNotMatch(CSP, /unsafe-inline|unsafe-eval|https?:/);
});

test("windowPolicy applies preload and denies external navigation/window.open", () => {
  const p = windowPolicy("C:/preload/index.js");
  assert.equal(p.webPreferences.preload, "C:/preload/index.js");
  assert.equal(p.denyExternalNavigation, true);
  assert.equal(p.denyWindowOpen, true);
  assert.equal(p.csp, CSP);
});

test("isNavigationAllowed only allows local file URLs on the app origin", () => {
  assert.equal(isNavigationAllowed("file:///C:/app/dist/renderer/index.html", "file://"), true);
  assert.equal(isNavigationAllowed("https://example.com", "file://"), false);
  assert.equal(isNavigationAllowed("file:///C:/elsewhere/evil.html", "file:///C:/app"), false);
});
