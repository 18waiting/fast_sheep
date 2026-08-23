import { test } from "node:test";
import assert from "node:assert/strict";
import { createMainContext } from "../dist/main/bootstrap.js";

test("main composition builds the full offline context in test mode", async () => {
  const ctx = createMainContext({ testMode: true });
  const shops = await ctx.shops.list();
  assert.equal(shops.length, 7, "M8 test mode exposes one synthetic shop per platform (2 PDD + 5 others)");
  assert.equal(shops[0].shop_id, "shop-test-1");
  const vm = ctx.projection.project();
  assert.equal(vm.platform_capability, "pdd", "test mode activates the PDD platform projection");
  assert.equal(vm.shop_summaries.length, 7);
  assert.equal(vm.worker_status.status, "ready");
  assert.ok(ctx.orchestratorHost.get(), "orchestrator host owns the ConversationOrchestrator");
  const settings = ctx.settings.view();
  assert.equal(settings.reviewModeDefault, "human_review");
});

test("revision is monotonic and Main is the revision authority", () => {
  const ctx = createMainContext({ testMode: false });
  const a = ctx.revision();
  const b = ctx.revision();
  assert.equal(a, 0);
  assert.equal(b, 0);
});

test("production (non-test) mode returns an empty shop list until M7/M8 adapters", async () => {
  const ctx = createMainContext({ testMode: false });
  const shops = await ctx.shops.list();
  assert.deepEqual(shops, []);
  const vm = ctx.projection.project();
  assert.equal(vm.platform_capability, "none");
});

test("typed UI command path reaches the M5 orchestrator (manual send round trip)", async () => {
  const ctx = createMainContext({ testMode: true });
  await ctx.orchestratorHost.manualSend("shop-test-1", "c1");
  // No PDD session is activated in the unit composition, so the routing adapter
  // falls back to the fake platform adapter (M6 semantics preserved).
  assert.ok(ctx.platformFallback.sendCalls.length >= 1, "fallback platform adapter received the send");
  assert.equal(ctx.platformFallback.sendCalls[0].conversationId, "c1");
});
