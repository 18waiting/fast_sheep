// M12 upgraded profile smoke (clean-room). Synthetic v1/v2/v3 DBs -> latest ->
// worker reads/integrity/reopen.
import { mkdtempSync, rmSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, SqliteConnection, MigrationRunner, MIGRATIONS_DIR } from "../packages/persistence/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const NAMES = { 1: "initial", 2: "feedback_effect_tracking", 3: "learning_review_audit_optimization" };
let failed = 0;
const check = (n, c, extra = "") => { console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : " " + extra)); if (!c) failed += 1; };
for (const target of [1, 2, 3]) {
  const r = mkdtempSync(join(tmpdir(), "fw-m12-up-" + target));
  const migDir = join(r, "mig"); mkdirSync(migDir, { recursive: true });
  for (let v = 1; v <= target; v++) copyFileSync(join(MIGRATIONS_DIR, `000${v}_${NAMES[v]}.sql`), join(migDir, `000${v}_${NAMES[v]}.sql`));
  const conn = new SqliteConnection(join(r, "fast_sheep.sqlite3"));
  new MigrationRunner(migDir).migrate(conn, join(r, "backups", "db"));
  conn.close();
  const conn2 = new SqliteConnection(join(r, "fast_sheep.sqlite3"));
  new MigrationRunner().migrate(conn2, join(r, "backups", "db"));
  const v = Number(conn2.get("SELECT value FROM app_meta WHERE key = 'database_schema_version'").value);
  check("v" + target + " upgraded to v8", v === 8);
  conn2.exec("PRAGMA quick_check");
  conn2.close();
  const b = openDatabase(r);
  check("v" + target + " reopen v8", b.schemaVersion === 8);
  b.conn.close();
  rmSync(r, { recursive: true, force: true });
}
if (failed > 0) process.exit(1);
console.log("M12 upgraded profile smoke PASS.");

