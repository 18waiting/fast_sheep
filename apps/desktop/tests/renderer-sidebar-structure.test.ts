import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// SHEEP-027 structural guards: the sidebar region stays a clean-room shop-list +
// selection component, fully data-driven from the typed viewModel, with no
// bridge/backend/auth/network port, no add/delete shop UI, no reinterpretation of
// shop_summaries.enabled/type semantics, and the existing clean-room empty-state
// text (reference-derived = NO).
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "src", "renderer", "components", "shop-sidebar.ts");
const DIST = join(HERE, "..", "dist", "renderer", "components", "shop-sidebar.js");

const BRIDGE_TOKENS = ["店铺API", "ipcRenderer", "fetch(", "WebSocket", "localStorage", "sessionStorage", "navigate(", "api_key", "credential"];
const SHOP_WRITE_TOKENS = ["onAddShop", "onDeleteShop", "addShop", "deleteShop", "removeShop", "modal"];

test("sidebar keeps clean-room selection semantics (no bridge/backend/auth port)", () => {
  const src = readFileSync(SRC, "utf-8");
  assert.ok(src.includes("onSelectShop"), "sidebar must keep existing selection action");
  assert.ok(src.includes("aria-current"), "sidebar must keep existing selection highlight");
  for (const t of BRIDGE_TOKENS) {
    assert.ok(!src.includes(t), "shop-sidebar.ts must not use " + t);
  }
});

test("sidebar adds no add/delete shop UI (DO_NOT_PORT_DIRECTLY)", () => {
  const src = readFileSync(SRC, "utf-8");
  for (const t of SHOP_WRITE_TOKENS) {
    assert.ok(!src.includes(t), "shop-sidebar.ts must not introduce " + t);
  }
});

test("sidebar does not reinterpret shop_summaries.enabled/type semantics", () => {
  const src = readFileSync(SRC, "utf-8");
  for (const t of ["disabled", "entitlement", "platform_availability", "isEnabled", "isAvailable"]) {
    assert.ok(!src.includes(t), "shop-sidebar.ts must not reinterpret " + t);
  }
});

test("sidebar keeps the existing clean-room empty-state text (reference-derived = NO)", () => {
  const src = readFileSync(SRC, "utf-8");
  assert.ok(src.includes("暂无店铺 (平台适配器将于 M7/M8 接入)"), "empty-state text must remain the clean-room baseline");
});

test("built shop-sidebar.js carries the same clean-room boundaries", () => {
  const js = readFileSync(DIST, "utf-8");
  assert.ok(js.includes("onSelectShop"), "built sidebar must keep selection");
  for (const t of [...BRIDGE_TOKENS, ...SHOP_WRITE_TOKENS]) {
    assert.ok(!js.includes(t), "dist shop-sidebar.js must not use " + t);
  }
});
