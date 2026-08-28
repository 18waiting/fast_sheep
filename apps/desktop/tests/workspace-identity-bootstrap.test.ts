import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteWorkspaceIdentityBootstrap, WORKSPACE_MERCHANT_ID_META_KEY } from "@fastwork/persistence";
import { createWorkerBackedMainContext } from "../dist/main/worker-runtime.js";

// SHEEP-063-PR2-PR1 production composition guards:
//   - bootstrap runs at composition time (after migrations, before services/IPC ready)
//   - MainContext.workspaceMerchantId is set from the trusted bootstrap
//   - reopen resolves the SAME stable merchant id
//   - ambiguous existing identity (merchants without pointer) fails closed
//   - dangling pointer fails closed (no silent replacement)
function tempRoot() { return mkdtempSync(join(tmpdir(), "fs-wsid-desk-")); }
function withTemp(fn: (r: string) => void) {
  const r = tempRoot();
  try { fn(r); } finally { try { rmSync(r, { recursive: true, force: true }); } catch { /* best-effort */ } }
}
const fakeWorkerClient = { request: async () => ({ ok: true, data: {} }) } as never;

test("production composition bootstraps workspace merchant (Main-owned, name=NULL, pointer), stable on reopen", () => {
  withTemp((root) => {
    const ctx = createWorkerBackedMainContext({ workerClient: fakeWorkerClient, dataRoot: root });
    assert.ok(/^merchant-[0-9a-f-]{36}$/.test(ctx.workspaceMerchantId ?? ""), "workspaceMerchantId set from trusted bootstrap");
    const id1 = ctx.workspaceMerchantId as string;

    // probe the shared production DB: merchant row (name NULL) + app_meta pointer
    const probe = openDatabase(root);
    const m = probe.conn.get<{ id: string; name: string | null }>("SELECT id, name FROM merchants WHERE id = ?", id1);
    assert.ok(m, "merchant row exists");
    assert.equal(m.name, null, "unknown name stored as NULL (no fabricated label)");
    assert.equal(probe.conn.get<{ value: string }>("SELECT value FROM app_meta WHERE key = ?", WORKSPACE_MERCHANT_ID_META_KEY).value, id1);
    probe.conn.close();

    // reopen same data root -> same stable id (I-19)
    const ctx2 = createWorkerBackedMainContext({ workerClient: fakeWorkerClient, dataRoot: root });
    assert.equal(ctx2.workspaceMerchantId, id1, "reopen resolves the same workspace merchant id");
  });
});

test("production composition fails closed on ambiguous existing identity (merchants without pointer, I-21)", () => {
  withTemp((root) => {
    const seed = openDatabase(root);
    seed.conn.run("INSERT INTO merchants (id, name) VALUES ('m-existing', '已有商户')");
    seed.conn.close();
    assert.throws(
      () => createWorkerBackedMainContext({ workerClient: fakeWorkerClient, dataRoot: root }),
      /ambiguous/i,
      "must fail closed; no first-row/count==1 inference"
    );
  });
});

test("production composition fails closed on dangling workspace pointer (no silent replacement, I-20)", () => {
  withTemp((root) => {
    const seed = openDatabase(root);
    seed.conn.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, 'merchant-missing')", WORKSPACE_MERCHANT_ID_META_KEY);
    seed.conn.close();
    assert.throws(
      () => createWorkerBackedMainContext({ workerClient: fakeWorkerClient, dataRoot: root }),
      /dangling/i,
      "must fail closed; pointer must not be replaced"
    );
  });
});
