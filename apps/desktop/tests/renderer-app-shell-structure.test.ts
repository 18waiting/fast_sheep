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
const SURFACE_SRC = join(HERE, "..", "src", "renderer", "components", "platform-surface.ts");
const STYLES_SRC = join(HERE, "..", "src", "renderer", "styles.css");

const REGIONS = ["app-navbar", "app-sidebar", "app-main", "queue-host", "local-details-scroll"];

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

test("app-shell keeps one stable platform host outside the local-details scroll region", () => {
  const src = readFileSync(SRC, "utf-8");
  assert.equal((src.match(/el\("div", "platform-host"\)/g) ?? []).length, 1, "exactly one platform-host must exist");
  assert.match(src, /const platformHost =[\s\S]*const localDetailsScroll =[\s\S]*localDetailsScroll\.appendChild\(panels\)/, "platform-host must precede and remain outside local-details-scroll");
  assert.match(src, /localDetailsScroll\.appendChild\(m10Row\)/, "M10 content must live in local-details-scroll");
  assert.match(src, /localDetailsScroll\.appendChild\(liHost\)/, "M11 content must live in local-details-scroll");
  assert.match(src, /main\.appendChild\(localDetailsScroll\)/, "local-details-scroll must remain inside app-main");
  assert.ok(!src.includes("localDetailsScroll.appendChild(platformHost)"), "platform-host must not be nested inside local-details-scroll");
});

test("app-main and local-details-scroll preserve the stable height contract", () => {
  const styles = readFileSync(STYLES_SRC, "utf-8");
  const localDetailsRule = /\.local-details-scroll\s*\{([^}]*)\}/.exec(styles)?.[1] ?? "";
  assert.match(styles, /html,\s*body\s*\{[^}]*height:\s*100%[^}]*\}/, "html/body must remain bounded to the viewport height");
  assert.match(styles, /#app\s*\{[^}]*height:\s*100%[^}]*\}/, "renderer root must remain bounded to the viewport height");
  assert.match(styles, /\.app-shell\s*\{[^}]*height:\s*100%[^}]*\}/, "app-shell must remain bounded to the viewport height");
  assert.match(styles, /\.app-body\s*\{[^}]*flex:\s*1[^}]*min-height:\s*0[^}]*\}/, "app-body must flex and permit its children to shrink");
  assert.match(styles, /\.app-main\s*\{[^}]*min-height:\s*0[^}]*overflow:\s*hidden[^}]*\}/, "app-main must be bounded and non-scrolling");
  assert.match(styles, /\.platform-host\s*\{[^}]*flex:\s*1 1 auto[^}]*min-width:\s*0[^}]*min-height:\s*260px[^}]*\}/, "platform-host must retain priority and minimum useful height");
  assert.ok(localDetailsRule, "local-details-scroll rule must exist");
  assert.doesNotMatch(localDetailsRule, /flex:\s*0\s+1\s+40%/, "local-details-scroll must not retain the old 40% reservation");
  assert.match(localDetailsRule, /flex:\s*0\s+1\s+200px/, "local-details-scroll must use the A200 shrinkable basis");
  assert.match(localDetailsRule, /max-height:\s*200px/, "local-details-scroll must retain the A200 preferred maximum");
  assert.match(localDetailsRule, /min-height:\s*0/, "local-details-scroll must be allowed to shrink");
  assert.match(localDetailsRule, /overflow:\s*auto/, "local-details-scroll must own local vertical overflow");
  assert.match(styles, /\.header-host,\s*\.status-row,\s*\.countdown-host\s*\{\s*flex:\s*none;\s*\}/, "stable workbench header/status items must not shrink");
});

test("A200 allocation remains runtime-state neutral", () => {
  const styles = readFileSync(STYLES_SRC, "utf-8");
  for (const token of [".pdd-active", ".runtime-active", ".platform-active", ".details-expanded", ".details-collapsed"]) {
    assert.ok(!styles.includes(token), "A200 allocation must not introduce state-dependent selector " + token);
  }
});

test("option B introduces no scroll-driven platform bounds tracking", () => {
  const shell = readFileSync(SRC, "utf-8");
  const surface = readFileSync(SURFACE_SRC, "utf-8");
  for (const token of ["addEventListener(\"scroll\"", "addEventListener('scroll'", "onscroll", "scrollY", "wheel"]) {
    assert.ok(!shell.includes(token), "app-shell must not introduce scroll tracking: " + token);
    assert.ok(!surface.includes(token), "platform-surface must not introduce scroll tracking: " + token);
  }
  assert.ok(surface.includes("getBoundingClientRect"), "stable surface keeps its existing bounds measurement");
  assert.ok(surface.includes("ResizeObserver"), "stable surface keeps its existing viewport resize observation");
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
  assert.ok(js.includes("local-details-scroll"), "dist app-shell.js must preserve the local details scroll region");
});
