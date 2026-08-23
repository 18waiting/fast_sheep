// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1 (TASK-016): open the database — resolve root, provision dirs, open, apply PRAGMAs,
// integrity check, run migrations, seed defaults, return a PersistenceContext.
import { SqliteConnection } from "./sqlite-driver.js";
import { applyPragmas } from "./pragmas.js";
import { resolveDataRoot, provisionDataRoot, type DataRoot } from "./data-root.js";
import { PersistenceError, ERROR_CODES } from "./errors.js";
import { MigrationRunner } from "../migrations/migration-runner.js";
import { SUPPORTED_DB_SCHEMA_VERSION } from "./schema-version.js";
import { seedDefaults } from "../seed.js";

export interface PersistenceContext {
  conn: SqliteConnection;
  dataRoot: DataRoot;
  schemaVersion: number;
}

export function openDatabase(rootOverride?: string, opts: { seed?: boolean } = {}): PersistenceContext {
  const root = resolveDataRoot(rootOverride);
  const dataRoot = provisionDataRoot(root);
  const conn = new SqliteConnection(dataRoot.databasePath);
  applyPragmas(conn);
  const integrity = quickCheck(conn);
  if (integrity !== "ok") {
    conn.close();
    throw new PersistenceError(ERROR_CODES.CORRUPT_DATABASE, `database integrity check failed: ${integrity}`);
  }
  const runner = new MigrationRunner();
  const { applied } = runner.migrate(conn, dataRoot.backupDir);
  const schemaVersion = applied.reduce((mx, a) => Math.max(mx, a.version), 0);
  if (opts.seed !== false) seedDefaults(conn, root);
  return { conn, dataRoot, schemaVersion };
}

export function quickCheck(conn: SqliteConnection): string {
  return conn.get<{ quick_check: string }>("PRAGMA quick_check")?.quick_check ?? "ok";
}

export { SUPPORTED_DB_SCHEMA_VERSION };
