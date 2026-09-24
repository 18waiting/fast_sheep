import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(here, "..", "src", "renderer", "app.ts"), "utf8");
const queue = readFileSync(join(here, "..", "src", "renderer", "components", "conversation-list.ts"), "utf8");

test("runtime Shop click does not manufacture a canonical Store scope", () => {
  const shopAction = app.match(/onSelectShop:\s*([\s\S]*?),\s*onSetMode:/)?.[1];
  assert.ok(shopAction, "Shop action must remain mounted");
  assert.match(shopAction, /store\.selectShop\(shopId\)/);
  assert.doesNotMatch(shopAction, /setQueueScope|specific_store|storeId/, "Shop id is not a canonical Store id");
});

test("Queue Store scope remains an explicit fact-backed control", () => {
  assert.match(app, /onScopeAllStores:\s*\(\)\s*=>\s*void store\.setQueueScope\(\{ kind: "all_stores" \}\)/);
  assert.match(app, /onScopeStore:\s*\(storeId\)\s*=>\s*void store\.setQueueScope\(\{ kind: "specific_store", storeId \}\)/);
  assert.match(queue, /for \(const s of state\.availableStores\)/);
  assert.match(queue, /else actions\.onScopeStore\(v\)/);
});
