// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// SHEEP-063-PR2-PR1 (Option B): local workspace merchant identity bootstrap.
// Guards: fresh v9 / v8->v9 upgrade (existing name preserved) / NULL-name insert /
// no-empty-magic bootstrap value / FK+reference integrity / atomic identity
// establishment / stable reopen / dangling pointer fail-closed / ambiguous legacy
// fail-closed / no member-membership fabrication / initialized no silent replacement.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, copyFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  openDatabase, SqliteConnection, MigrationRunner, MIGRATIONS_DIR, DB_FILENAME,
  SqliteWorkspaceIdentityBootstrap, resolveOrBootstrapWorkspaceMerchantId,
  generateWorkspaceMerchantId, WORKSPACE_MERCHANT_ID_META_KEY, WorkspaceIdentityError,
} from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fs-wsid-")); }
function withTemp(fn: (r: string) => void) {
  const r = root();
  try { fn(r); } finally { try { rmSync(r, { recursive: true, force: true }); } catch { /* best-effort (Windows may hold open DB conns) */ } }
}
function sha256(path: string): string { return createHash("sha256").update(readFileSync(path, "utf-8")).digest("hex"); }

const THRU_0008 = ["0001_initial.sql","0002_feedback_effect_tracking.sql","0003_learning_review_audit_optimization.sql","0004_legacy_import_tracking.sql","0005_identity_domain.sql","0006_conversation_domain.sql","0007_commerce_domain.sql","0008_message_facts.sql"];

test("fresh 0001->0010: schema v10, migration count 10, merchants.name nullable (no NOT NULL)", () => {
  withTemp((r) => {
    const ctx = openDatabase(r);
    assert.equal(ctx.schemaVersion, 10, "fresh DB must be schema v10");
    assert.equal(ctx.conn.get("SELECT COUNT(*) AS c FROM schema_migrations").c, 10, "0001-0010 applied");
    const ddl = ctx.conn.get<{ sql: string }>("SELECT sql FROM sqlite_master WHERE name='merchants'").sql;
    assert.ok(!/name\s+TEXT\s+NOT\s+NULL/i.test(ddl), "merchants.name must be nullable after 0009");
    // NULL-name insert allowed (DP-103/I-24)
    ctx.conn.run("INSERT INTO merchants (id, name) VALUES ('m-null', NULL)");
    assert.equal(ctx.conn.get<{ name: string | null }>("SELECT name FROM merchants WHERE id='m-null'").name, null);
    ctx.conn.close();
  });
});

test("v8->v10 upgrade (0009+0010): existing non-null merchant names preserved verbatim; checksums 0001-0008 unchanged", () => {
  withTemp((r) => {
    const dbPath = join(r, DB_FILENAME);
    const mig8 = mkdtempSync(join(tmpdir(), "fs-wsid8-"));
    for (const f of THRU_0008) copyFileSync(join(MIGRATIONS_DIR, f), join(mig8, f));

    const conn = new SqliteConnection(dbPath);
    const res8 = new MigrationRunner(mig8).migrate(conn, join(r, "backups", "db"));
    assert.equal(res8.migratedCount, 8, "0001-0008 applied to v8");
    assert.equal(conn.get("SELECT value FROM app_meta WHERE key='database_schema_version'").value, "8");
    conn.run("INSERT INTO merchants (id, name) VALUES ('m1', '既有商户甲')");
    conn.run("INSERT INTO stores (id, merchant_id, name, platform) VALUES ('s1', 'm1', '店', 'pdd')");

    const runner = new MigrationRunner();
    const res = runner.migrate(conn, join(r, "backups", "db"));
    assert.equal(res.migratedCount, 2, "0009+0010 applied (v8 -> v10)");
    assert.equal(res.backedUp, true);
    assert.equal(conn.get("SELECT value FROM app_meta WHERE key='database_schema_version'").value, "10");
    // existing name preserved verbatim (no rewrite/backfill)
    assert.equal(conn.get<{ name: string }>("SELECT name FROM merchants WHERE id='m1'").name, "既有商户甲");
    // FK reference still resolves after rebuild
    assert.equal(conn.get<{ name: string }>("SELECT name FROM stores WHERE id='s1'").name, "店");
    for (const f of THRU_0008) {
      const v = Number(f.match(/^(\d+)_/)?.[1]);
      const applied = runner.applied(conn).find((a) => a.version === v);
      assert.ok(applied, `record for ${f}`);
      assert.equal(applied.checksum, sha256(join(MIGRATIONS_DIR, f)), `checksum unchanged: ${f}`);
    }
    conn.close();
  });
});

test("FK/reference integrity after 0009: valid insert ok, invalid child merchant_id rejected", () => {
  withTemp((r) => {
    const ctx = openDatabase(r);
    ctx.conn.run("INSERT INTO merchants (id, name) VALUES ('m1', 'M')");
    ctx.conn.run("INSERT INTO stores (id, merchant_id, name, platform) VALUES ('s1', 'm1', 'S', 'pdd')");
    assert.throws(() => ctx.conn.run("INSERT INTO stores (id, merchant_id, name, platform) VALUES ('s2', 'nope', 'S', 'pdd')"), /FOREIGN KEY/i, "FK must be enforced after migration");
    ctx.conn.close();
  });
});

test("bootstrap fresh: stable generated MerchantId (no magic default), name=NULL, pointer written, no member/auth fabrication", () => {
  withTemp((r) => {
    const ctx = openDatabase(r);
    const b = new SqliteWorkspaceIdentityBootstrap(ctx.conn);
    const id = resolveOrBootstrapWorkspaceMerchantId(b);
    assert.ok(/^merchant-[0-9a-f-]{36}$/.test(id), "stable generated internal MerchantId, not magic default");
    assert.notEqual(id, "default");
    assert.equal(b.resolveWorkspaceMerchantId(), id, "pointer written");
    const m = ctx.conn.get<{ id: string; name: string | null }>("SELECT id, name FROM merchants WHERE id = ?", id);
    assert.equal(m.name, null, "name=NULL (unknown); no fabricated/label/magic value persisted");
    // no member/membership/seat/auth fabrication
    assert.equal(ctx.conn.get("SELECT COUNT(*) AS c FROM members").c, 0);
    assert.equal(ctx.conn.get("SELECT COUNT(*) AS c FROM memberships").c, 0);
    assert.equal(ctx.conn.get("SELECT COUNT(*) AS c FROM seats").c, 0);
    ctx.conn.close();
  });
});

test("atomic identity establishment: failure inside the transaction rolls back merchant row (DP-101)", () => {
  withTemp((r) => {
    const ctx = openDatabase(r);
    const b = new SqliteWorkspaceIdentityBootstrap(ctx.conn);
    // Force app_meta insert to fail inside the bootstrap transaction.
    ctx.conn.exec(`CREATE TRIGGER fail_ws_meta BEFORE INSERT ON app_meta WHEN NEW.key = '${WORKSPACE_MERCHANT_ID_META_KEY}' BEGIN SELECT RAISE(ABORT, 'boom'); END;`);
    assert.throws(() => b.bootstrapWorkspaceMerchantId(generateWorkspaceMerchantId), /boom/);
    assert.equal(ctx.conn.get("SELECT COUNT(*) AS c FROM merchants").c, 0, "no orphan merchant row after failed bootstrap");
    assert.equal(b.resolveWorkspaceMerchantId(), null, "no pointer after failed bootstrap");
    ctx.conn.close();
  });
});

test("stable reopen: bootstrap -> close -> reopen resolves the SAME merchant id (I-19 stable lifetime)", () => {
  withTemp((r) => {
    const ctx1 = openDatabase(r);
    const id1 = resolveOrBootstrapWorkspaceMerchantId(new SqliteWorkspaceIdentityBootstrap(ctx1.conn));
    ctx1.conn.close();

    const ctx2 = openDatabase(r);
    const b2 = new SqliteWorkspaceIdentityBootstrap(ctx2.conn);
    const id2 = resolveOrBootstrapWorkspaceMerchantId(b2);
    assert.equal(id2, id1, "reopen must resolve the same stable workspace merchant id");
    assert.equal(ctx2.conn.get("SELECT COUNT(*) AS c FROM merchants").c, 1, "no duplicate merchant on reopen");
    ctx2.conn.close();
  });
});

test("initialized workspace no silent replacement: pointer+merchant exist -> resolve same id, no second row", () => {
  withTemp((r) => {
    const ctx = openDatabase(r);
    const b = new SqliteWorkspaceIdentityBootstrap(ctx.conn);
    const id = resolveOrBootstrapWorkspaceMerchantId(b);
    ctx.conn.run("INSERT INTO stores (id, merchant_id, name, platform) VALUES ('s1', ?, 'S', 'pdd')", id);
    const again = resolveOrBootstrapWorkspaceMerchantId(b);
    assert.equal(again, id);
    assert.equal(ctx.conn.get("SELECT COUNT(*) AS c FROM merchants").c, 1);
    ctx.conn.close();
  });
});

test("dangling pointer fail-closed: pointer to missing merchant throws; no auto replacement", () => {
  withTemp((r) => {
    const ctx = openDatabase(r);
    const b = new SqliteWorkspaceIdentityBootstrap(ctx.conn);
    ctx.conn.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, 'merchant-missing')", WORKSPACE_MERCHANT_ID_META_KEY);
    assert.throws(() => resolveOrBootstrapWorkspaceMerchantId(b), (e) => e instanceof WorkspaceIdentityError && /dangling/i.test(e.message));
    assert.equal(b.resolveWorkspaceMerchantId(), "merchant-missing", "pointer unchanged (no silent replacement)");
    assert.equal(ctx.conn.get("SELECT COUNT(*) AS c FROM merchants").c, 0, "no merchant auto-created");
    ctx.conn.close();
  });
});

test("ambiguous existing identity fail-closed: merchant rows without pointer are NOT bootstrappable (I-21)", () => {
  withTemp((r) => {
    const ctx = openDatabase(r);
    const b = new SqliteWorkspaceIdentityBootstrap(ctx.conn);
    ctx.conn.run("INSERT INTO merchants (id, name) VALUES ('m-existing', '已有商户')");
    assert.throws(() => resolveOrBootstrapWorkspaceMerchantId(b), (e) => e instanceof WorkspaceIdentityError && /ambiguous/i.test(e.message));
    assert.equal(b.resolveWorkspaceMerchantId(), null, "no pointer invented");
    assert.equal(ctx.conn.get("SELECT COUNT(*) AS c FROM merchants").c, 1, "no first-row/count==1 inference");
    ctx.conn.close();
  });
});

