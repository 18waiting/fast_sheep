import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, SqliteSettingsRepository, SqliteShopRepository } from "../../packages/persistence/dist/index.js";
import {
  CONFIRMATION_FLAG,
  CONTROLLED_PDD_SHOP_NAME,
  CONTROLLED_SHOP_ERROR_CODES,
  createControlledPddShop,
  generateLocalShopId,
} from "../../scripts/create-controlled-pdd-shop.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = resolve(ROOT, "scripts", "create-controlled-pdd-shop.mjs");

function temporaryRoot() {
  return mkdtempSync(join(tmpdir(), "fast-sheep-controlled-shop-"));
}

async function withTemporaryRoot(run) {
  const root = temporaryRoot();
  try {
    return await run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runCli(root, args = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, FASTWORK_DATA_DIR: root },
  });
}

function readState(root) {
  const db = openDatabase(root);
  try {
    return {
      shops: new SqliteShopRepository(db.conn).list(),
      merchants: db.conn.get("SELECT COUNT(*) AS count FROM merchants").count,
      stores: db.conn.get("SELECT COUNT(*) AS count FROM stores").count,
      platformAccounts: db.conn.get("SELECT COUNT(*) AS count FROM platform_accounts").count,
      customers: db.conn.get("SELECT COUNT(*) AS count FROM customers").count,
      orders: db.conn.get("SELECT COUNT(*) AS count FROM orders").count,
      products: db.conn.get("SELECT COUNT(*) AS count FROM products").count,
      conversations: db.conn.get("SELECT COUNT(*) AS count FROM normalized_conversations").count,
      platformConfig: new SqliteSettingsRepository(db.conn).getGroup("PlatformConfig"),
    };
  } finally {
    db.conn.close();
  }
}

function seedShop(root, shop) {
  const db = openDatabase(root);
  try {
    new SqliteShopRepository(db.conn).add(shop);
  } finally {
    db.conn.close();
  }
}

test("local Shop ID uses the documented shape and injected deterministic suffix", () => {
  assert.equal(generateLocalShopId(1_789_000_000_000, 42), "shop-1789000000000-0042");
});

test("confirmation flag is mandatory and creates nothing without it", async () => {
  await withTemporaryRoot(async (root) => {
    const result = runCli(root);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.equal(existsSync(join(root, "fast_sheep.sqlite3")), false);
    assert.deepEqual(readState(root).shops, []);
  });
});

test("confirmed invocation creates exactly one local PDD Shop and no identity/business rows", async () => {
  await withTemporaryRoot(async (root) => {
    const result = runCli(root, [CONFIRMATION_FLAG]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^shop-\d+-\d{4}\n$/);

    const id = result.stdout.trim();
    const state = readState(root);
    assert.deepEqual(state.shops, [{
      id,
      type: "pdd",
      name: CONTROLLED_PDD_SHOP_NAME,
      created_time: null,
      enabled: true,
      order: 0,
    }]);
    assert.equal(state.merchants, 0);
    assert.equal(state.stores, 0);
    assert.equal(state.platformAccounts, 0);
    assert.equal(state.customers, 0);
    assert.equal(state.orders, 0);
    assert.equal(state.products, 0);
    assert.equal(state.conversations, 0);
    assert.equal(state.platformConfig, undefined);

    const second = runCli(root, [CONFIRMATION_FLAG]);
    assert.notEqual(second.status, 0);
    assert.equal(second.stdout, "");
    assert.equal(readState(root).shops.length, 1);
  });
});

test("pre-existing PDD Shop rejects creation and remains unchanged", async () => {
  await withTemporaryRoot(async (root) => {
    const existing = { id: "shop-existing-pdd", type: "pdd", name: "Existing PDD", created_time: null, enabled: true, order: 0 };
    seedShop(root, existing);
    const result = runCli(root, [CONFIRMATION_FLAG]);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.deepEqual(readState(root).shops, [existing]);
  });
});

test("pre-existing non-PDD Shop remains unchanged while the controlled PDD Shop is created", async () => {
  await withTemporaryRoot(async (root) => {
    const existing = { id: "shop-existing-other", type: "doudian", name: "Existing Other", created_time: null, enabled: true, order: 3 };
    seedShop(root, existing);
    const result = runCli(root, [CONFIRMATION_FLAG]);
    assert.equal(result.status, 0, result.stderr);
    const shops = readState(root).shops;
    assert.equal(shops.length, 2);
    assert.deepEqual(shops.find((shop) => shop.id === existing.id), existing);
    assert.equal(shops.filter((shop) => shop.type === "pdd").length, 1);
  });
});

test("local Shop ID collision fails closed without retry or insertion", async () => {
  await withTemporaryRoot(async (root) => {
    const nowMs = 1_789_000_000_000;
    const fourDigit = 7;
    const collisionId = generateLocalShopId(nowMs, fourDigit);
    seedShop(root, { id: collisionId, type: "doudian", name: "Existing Collision", created_time: null, enabled: true, order: 0 });

    assert.throws(
      () => createControlledPddShop({ dataRoot: root, nowMs, fourDigit }),
      (error) => error?.code === CONTROLLED_SHOP_ERROR_CODES.LOCAL_SHOP_ID_CONFLICT,
    );
    const shops = readState(root).shops;
    assert.equal(shops.length, 1);
    assert.equal(shops[0].id, collisionId);
    assert.equal(shops[0].type, "doudian");
  });
});
