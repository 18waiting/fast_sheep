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

const REGIONS = ["app-navbar", "app-main", "queue-host"];

test("app-shell establishes navbar/sidebar/main region boundaries (SHEEP-026)", () => {
  const src = readFileSync(SRC, "utf-8");
  for (const cls of REGIONS) {
    assert.ok(src.includes(cls), "app-shell.ts must create " + cls + " container");
  }
  for (const name of ["renderErrorBanner", "renderAppNavbar", "renderWorkbenchHeader", "renderModeToggle", "renderWorkerStatusBadge", "renderConversationList"]) {
    assert.ok(src.includes(name), "app-shell.ts must keep " + name);
  }
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
});