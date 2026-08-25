import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// SHEEP-028 structural guards: the navbar region is a clean-room structural
// placeholder (app-navbar-nav + app-navbar-user) with no bridge/backend/auth/network
// port, no invented Phase 3 nav taxonomy / user-info fields, and no fake business or
// visual placeholder UI (avatar, badge, logo, icon, skeleton, ...).
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "src", "renderer", "components", "app-navbar.ts");
const SHELL_SRC = join(HERE, "..", "src", "renderer", "components", "app-shell.ts");
const DIST = join(HERE, "..", "dist", "renderer", "components", "app-navbar.js");

const BRIDGE_TOKENS = ["店铺API", "ipcRenderer", "fetch(", "WebSocket", "localStorage", "sessionStorage", "navigate(", "api_key", "credential"];
const FAKE_UI_TOKENS = ["avatar", "badge", "logo", "icon", "loading", "skeleton", "暂无导航", "username", "userName"];
const PHASE3_NAV_TOKENS = ["工作台", "会话", "AI", "客户", "商品", "订单", "知识库", "团队", "设置", "用户名", "积分", "到期"];

test("navbar region establishes the two clean-room structural sub-regions", () => {
  const src = readFileSync(SRC, "utf-8");
  assert.ok(src.includes('"app-navbar-nav"'), "must create nav-items sub-region");
  assert.ok(src.includes('"app-navbar-user"'), "must create user-info sub-region");
  assert.ok(src.includes("aria-label"), "must provide generic accessible labels");
});

test("navbar adds no bridge/backend/auth/network dependency", () => {
  const src = readFileSync(SRC, "utf-8");
  for (const t of BRIDGE_TOKENS) {
    assert.ok(!src.includes(t), "app-navbar.ts must not use " + t);
  }
});

test("navbar invents no Phase 3 nav taxonomy or user-info fields", () => {
  const src = readFileSync(SRC, "utf-8");
  for (const t of PHASE3_NAV_TOKENS) {
    assert.ok(!src.includes(t), "app-navbar.ts must not hardcode " + t);
  }
});

test("navbar keeps a true structural placeholder (no fake business/visual UI)", () => {
  const src = readFileSync(SRC, "utf-8");
  for (const t of FAKE_UI_TOKENS) {
    assert.ok(!src.includes(t), "app-navbar.ts must not add " + t);
  }
});

test("app-shell wires the navbar and keeps the existing workbench header", () => {
  const shell = readFileSync(SHELL_SRC, "utf-8");
  assert.ok(shell.includes("renderAppNavbar"), "app-shell must wire navbar region");
  assert.ok(shell.includes("renderWorkbenchHeader"), "app-shell must keep workbench header");
});

test("built app-navbar.js mirrors the same clean-room boundaries", () => {
  const js = readFileSync(DIST, "utf-8");
  assert.ok(js.includes('"app-navbar-nav"'), "dist must create nav-items sub-region");
  assert.ok(js.includes('"app-navbar-user"'), "dist must create user-info sub-region");
  for (const t of [...BRIDGE_TOKENS, ...FAKE_UI_TOKENS]) {
    assert.ok(!js.includes(t), "dist app-navbar.js must not use " + t);
  }
});