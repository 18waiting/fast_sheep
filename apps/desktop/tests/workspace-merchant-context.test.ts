import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "@fastwork/persistence";
import { createMainContext } from "../dist/main/bootstrap.js";
import { createWorkerBackedMainContext } from "../dist/main/worker-runtime.js";
import { createWorkspaceMerchantContext } from "../dist/main/services/workspace-merchant-context.js";

// SHEEP-063-PR2 guards:
//   - WorkspaceMerchantContext is Main-owned, frozen, minimal (DP-94/96/97)
//   - containsMerchant = I-18 minimal containment (exact merchant match)
//   - production composition builds the context from the trusted bootstrap
//   - test mode uses an explicit synthetic context (DP-95/96; test injection explicit)
//   - offline composition without context -> null (fail closed downstream)
function tempRoot() { return mkdtempSync(join(tmpdir(), "fs-wmc-")); }
function withTemp(fn: (r: string) => void) {
  const r = tempRoot();
  try { fn(r); } finally { try { rmSync(r, { recursive: true, force: true }); } catch { /* best-effort */ } }
}
const fakeWorkerClient = { request: async () => ({ ok: true, data: {} }) } as never;

test("WorkspaceMerchantContext is frozen, minimal, and containsMerchant is exact-match (I-18/DP-97)", () => {
  const ctx = createWorkspaceMerchantContext("merchant-ws1");
  assert.ok(Object.isFrozen(ctx), "context is frozen (Main-owned, not renderer-settable)");
  assert.equal(ctx.merchantId, "merchant-ws1");
  assert.equal(ctx.containsMerchant("merchant-ws1"), true, "same merchant contained");
  assert.equal(ctx.containsMerchant("merchant-other"), false, "cross-merchant not contained");
  assert.equal(ctx.containsMerchant(null), false);
  assert.equal(ctx.containsMerchant(undefined), false);
  // minimal anchor: no session/user/permission/active-conversation surface
  const keys = Object.keys(ctx).sort();
  assert.deepEqual(keys, ["containsMerchant", "merchantId"], "no extra framework surface (DP-97)");
  assert.throws(() => createWorkspaceMerchantContext(""), /non-empty/, "empty id rejected");
  assert.throws(() => createWorkspaceMerchantContext("   "), /non-empty/, "blank id rejected");
});

test("production composition builds WorkspaceMerchantContext from trusted bootstrap (DP-94/96)", () => {
  withTemp((root) => {
    const ctx = createWorkerBackedMainContext({ workerClient: fakeWorkerClient, dataRoot: root });
    assert.ok(ctx.workspaceMerchant, "workspace merchant context established in production composition");
    assert.ok(/^merchant-[0-9a-f-]{36}$/.test(ctx.workspaceMerchant.merchantId), "stable generated identity (DP-99)");
    assert.ok(ctx.workspaceMerchant.containsMerchant(ctx.workspaceMerchant.merchantId), "self-containment");
    // stable across Main context lifetime (I-19): reopen resolves the same id
    const ctx2 = createWorkerBackedMainContext({ workerClient: fakeWorkerClient, dataRoot: root });
    assert.equal(ctx2.workspaceMerchant?.merchantId, ctx.workspaceMerchant?.merchantId, "stable for Main lifetime");
  });
});

test("test mode injects an explicit synthetic WorkspaceMerchantContext (DP-95/96; no ambient inference)", () => {
  const ctx = createMainContext({ testMode: true });
  assert.equal(ctx.workspaceMerchant?.merchantId, "merchant-test-1", "explicit synthetic test identity");
  assert.ok(ctx.workspaceMerchant?.containsMerchant("merchant-test-1"));
});

test("offline composition without workspace merchant -> null (fail closed downstream)", () => {
  const ctx = createMainContext({ testMode: false });
  assert.equal(ctx.workspaceMerchant, null, "no trusted merchant authority -> null");
});
