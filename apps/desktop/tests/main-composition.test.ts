import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMainContext } from "../dist/main/bootstrap.js";
import { createWorkerBackedMainContext, resolveControlledProductionPddShop } from "../dist/main/worker-runtime.js";
import { openDatabase, SqliteSettingsRepository, SqliteShopRepository } from "@fastwork/persistence";
import { partitionFor } from "../dist/main/platforms/pdd/pdd-session-partition.js";

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

function productionRoot(): string {
  return mkdtempSync(join(tmpdir(), "fast-sheep-controlled-shop-"));
}

function makeProductionContext(root: string) {
  return createWorkerBackedMainContext({
    workerClient: { request: async () => ({}) } as never,
    dataRoot: root,
  });
}

function seedProductionShop(root: string, shops: Array<{ id: string; type: string; name: string; enabled: boolean }>, controlledShopId?: string): void {
  const db = openDatabase(root);
  const shopRepository = new SqliteShopRepository(db.conn);
  for (const shop of shops) shopRepository.add({ ...shop, order: 0 });
  if (controlledShopId !== undefined) {
    new SqliteSettingsRepository(db.conn).setGroup("PlatformConfig", { platform: "pdd", controlled_shop_id: controlledShopId });
  }
  db.conn.close();
}

test("controlled PDD production binding fails closed without one valid explicit local shop", async () => {
  const cases: Array<{ name: string; shops: Array<{ id: string; type: string; name: string; enabled: boolean }>; controlledShopId?: string }> = [
    { name: "missing selector", shops: [{ id: "shop-pdd", type: "pdd", name: "PDD", enabled: true }] },
    { name: "unknown shop", shops: [{ id: "shop-pdd", type: "pdd", name: "PDD", enabled: true }], controlledShopId: "shop-missing" },
    { name: "disabled shop", shops: [{ id: "shop-disabled", type: "pdd", name: "PDD", enabled: false }], controlledShopId: "shop-disabled" },
    { name: "non-PDD shop", shops: [{ id: "shop-other", type: "doudian", name: "Other", enabled: true }], controlledShopId: "shop-other" },
  ];

  for (const item of cases) {
    const root = productionRoot();
    seedProductionShop(root, item.shops, item.controlledShopId);
    const context = makeProductionContext(root);
    assert.deepEqual(await context.shops.list(), [], item.name);
    assert.equal(context.platformForShop(item.controlledShopId ?? "shop-pdd"), null, item.name);
    assert.equal(context.platform.status(item.controlledShopId ?? "shop-pdd"), null, item.name);
    assert.equal(context.platform.adapterFor(item.controlledShopId ?? "shop-pdd"), null, item.name);
  }

  const malformedRoot = productionRoot();
  const malformedDb = openDatabase(malformedRoot);
  new SqliteShopRepository(malformedDb.conn).add({ id: "shop-pdd", type: "pdd", name: "PDD", enabled: true, order: 0 });
  malformedDb.conn.run("INSERT INTO config_groups (group_name, schema_version, payload_json, updated_at) VALUES (?, ?, ?, ?)", "PlatformConfig", "1.0", "{", "2026-01-01T00:00:00Z");
  malformedDb.conn.close();
  const malformedContext = makeProductionContext(malformedRoot);
  assert.deepEqual(await malformedContext.shops.list(), [], "malformed selector config");

  const shops = { list: () => [{ id: "shop-pdd", type: "pdd", name: "PDD", enabled: true }] };
  assert.equal(resolveControlledProductionPddShop({ platform: "pdd", controlled_shop_id: "" }, shops), null);
  assert.equal(resolveControlledProductionPddShop({ platform: "pdd", controlled_shop_id: " shop-pdd" }, shops), null);
  assert.equal(resolveControlledProductionPddShop(
    { platform: "pdd", controlled_shop_id: "shop-pdd" },
    { list: () => { throw new Error("repository unavailable"); } },
  ), null);
});

test("controlled PDD production binding selects exactly one explicit local shop without identity inference", async () => {
  const root = productionRoot();
  seedProductionShop(root, [
    { id: "shop-controlled", type: "pdd", name: "Controlled PDD", enabled: true },
    { id: "shop-other-pdd", type: "pdd", name: "Other PDD", enabled: true },
  ], "shop-controlled");

  const context = makeProductionContext(root);
  assert.deepEqual(await context.shops.list(), [{ shop_id: "shop-controlled", name: "Controlled PDD", type: "pdd", enabled: true }]);
  assert.equal(context.platformForShop("shop-controlled"), "pdd");
  assert.equal(context.platformForShop("shop-other-pdd"), null);
  assert.equal(context.platform.status("shop-controlled"), null);
  assert.equal(context.platform.adapterFor("shop-controlled"), null);
  assert.equal(partitionFor("shop-controlled"), "persist:shop-shop-controlled");

  assert.deepEqual(await context.routingAdapter.sendText("shop-controlled", "c1", ["blocked"]), { ok: false, error: "platform.command_disabled_navigation_only" });
  assert.equal(context.platformFallback.sendCalls.length, 0);
  context.routingAdapter.onTransfer({ shop_id: "shop-controlled" } as never);
  assert.equal(context.platformFallback.transferCalls.length, 0);

  const verification = openDatabase(root);
  assert.equal(verification.conn.get<{ c: number }>("SELECT COUNT(*) AS c FROM platform_accounts")?.c, 0);
  verification.conn.close();
});
