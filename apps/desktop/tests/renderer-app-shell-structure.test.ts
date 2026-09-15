import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// SHEEP-026 structural guards: app shell must establish the three reference-aligned
// region containers (app-navbar / app-main / queue-host) as minimal boundaries;
// keep every existing functional region composed, and introduce no shell framework
// contract or fake business UI. Mirrors the existing source-scan test style.
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "src", "renderer", "components", "app-shell.ts");
const DIST = join(HERE, "..", "dist", "renderer", "components", "app-shell.js");
const SIDEBAR_SRC = join(HERE, "..", "src", "renderer", "components", "shop-sidebar.ts");

const REGIONS = ["app-navbar", "app-sidebar", "app-main", "queue-host"];

test("app-shell establishes navbar/sidebar/main region boundaries (SHEEP-026)", () => {
  const src = readFileSync(SRC, "utf-8");
  for (const cls of REGIONS) {
    assert.ok(src.includes(cls), "app-shell.ts must create " + cls + " container");
  }
  for (const name of ["renderErrorBanner", "renderAppNavbar", "renderShopSidebar", "renderWorkbenchHeader", "renderModeToggle", "renderWorkerStatusBadge", "renderConversationList", "renderPlatformSurface", "renderEmptyPlatformPanel"]) {
    assert.ok(src.includes(name), "app-shell.ts must keep " + name);
  }
});

test("app-shell mounts the existing Shop sidebar without implicit selection or activation", () => {
  const src = readFileSync(SRC, "utf-8");
  assert.match(src, /renderShopSidebar\(appSidebarHost,\s*state,\s*actions\)/, "app-shell must mount shop-sidebar with viewModel state and existing actions");
  assert.match(src, /renderConversationList\(queueHost,\s*state,\s*queueActions\)/, "Store-derived queue filter must remain separate from Shop sidebar");
  assert.ok(!src.includes("actions.onSelectShop("), "app-shell must not auto-select a Shop");
  assert.ok(!src.includes("activatePlatformShop"), "app-shell must not activate a platform directly");
  assert.ok(!src.includes("SqliteShopRepository") && !src.includes("listByMerchant"), "app-shell must not access repositories directly");
});

test("app-shell switches to the existing platform surface only for an active selected Shop", () => {
  const src = readFileSync(SRC, "utf-8");
  assert.match(src, /state\.selectedShopId !== null[\s\S]*state\.platform\.activeShopId === state\.selectedShopId[\s\S]*state\.platform\.platformType !== null/, "platform surface must require explicit selected Shop/runtime state");
  assert.match(src, /renderPlatformSurface\(platformHost,\s*state,\s*\{\s*onBoundsChange:\s*actions\.onPlatformBoundsChange\s*\}\)/, "platform surface must use the existing bounds callback");
  assert.match(src, /else\s*\{\s*renderEmptyPlatformPanel\(platformHost\);\s*\}/, "empty/local platform panel must remain for no runtime");
  assert.ok(!src.includes("getBoundingClientRect") && !src.includes("Math.round"), "app-shell must not hardcode bounds handling");
  assert.ok(!src.includes("onScopePlatform") && !src.includes("manualSend") && !src.includes("send_text"), "platform switching must not activate from filters or add send behavior");
});

test("mounted Shop sidebar is data-driven and selects only through explicit click", () => {
  const src = readFileSync(SIDEBAR_SRC, "utf-8");
  assert.ok(src.includes("vm?.shop_summaries ?? []"), "sidebar must render view_model.shop_summaries");
  assert.match(src, /button\(selected \? "shop-button selected" : "shop-button", shop\.name, \(\) => actions\.onSelectShop\(shop\.shop_id\)\)/, "Shop label and explicit click must use the local Shop id");
  assert.ok(src.includes("shops.length === 0"), "sidebar must retain a safe empty state");
  assert.ok(!src.includes("activatePlatformShop") && !src.includes("StoreRecord") && !src.includes("availableStores"), "Shop sidebar must not activate or manufacture Store identity");
});

test("app-shell keeps integration points minimal (no shell framework/contract)", () => {
  const src = readFileSync(SRC, "utf-8");
  for (const token of ["slotRegistry", "registry", "dynamicMount", "createRouter", "mountRegistry", "navigate("]) {
    assert.ok(!src.includes(token), "app-shell.ts must not introduce " + token);
  }
});

test("app-shell adds no fake business UI placeholders", () => {
  const src = readFileSync(SRC, "utf-8");
  for (const token of ["加载中", "暂无店铺", "empty-state", "fakeShop", "fakeUser", "loading"]) {
    assert.ok(!src.includes(token), "app-shell.ts must not hardcode fake business UI: " + token);
  }
});

test("built app-shell.js mirrors the same region boundaries", () => {
  const js = readFileSync(DIST, "utf-8");
  for (const cls of REGIONS) {
    assert.ok(js.includes(cls), "dist app-shell.js must create " + cls + " container");
  }
  assert.ok(js.includes("renderShopSidebar"), "dist app-shell.js must mount the existing Shop sidebar");
  assert.ok(js.includes("renderPlatformSurface"), "dist app-shell.js must mount the existing platform surface");
});
