// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1 (TASK-016): migration runner — fresh/current no-op, checksum validation,
// transactional migrations, future-schema rejection, failure rollback, backup-before-upgrade.
import type { SqliteConnection } from "../db/sqlite-driver.js";
import { PersistenceError, ERROR_CODES } from "../db/errors.js";
import { assertSchemaSupported } from "../db/schema-version.js";
import { discoverMigrations, maxMigrationVersion } from "./migration-loader.js";
import { backupDatabase } from "./database-backup.js";
import type { Migration, MigrationRecord, MigrationResult } from "./migration-types.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(HERE, "..", "..", "migrations");

export class MigrationRunner {
  constructor(private readonly migrationsDir: string = MIGRATIONS_DIR) {}

  private bootstrap(conn: SqliteConnection): void {
    conn.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)"
    );
    conn.exec("CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  }

  applied(conn: SqliteConnection): MigrationRecord[] {
    this.bootstrap(conn);
    return conn.all<MigrationRecord>("SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version");
  }

  migrate(conn: SqliteConnection, backupDir: string): MigrationResult {
    this.bootstrap(conn);
    const applied = this.applied(conn);
    const appliedVersions = new Set(applied.map((a) => a.version));
    const pending: Migration[] = [];

    for (const mig of discoverMigrations(this.migrationsDir)) {
      if (appliedVersions.has(mig.version)) {
        const row = applied.find((a) => a.version === mig.version);
        if (row && row.checksum !== mig.checksum) {
          throw new PersistenceError(
            ERROR_CODES.MIGRATION_CHECKSUM_MISMATCH,
            `migration ${mig.version} (${mig.name}) checksum mismatch`
          );
        }
        continue;
      }
      pending.push(mig);
    }

    // Reject a future/newer schema that this build does not know.
    const stored = this.readSchemaVersion(conn);
    assertSchemaSupported(stored);

    if (pending.length === 0) return { applied: this.applied(conn), backedUp: false, migratedCount: 0 };

    const backedUp = backupDatabase(conn.path, backupDir) !== null;

    for (const mig of pending) {
      try {
        conn.transaction(() => {
          conn.exec(mig.sql);
          conn.run("INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
                   mig.version, mig.name, mig.checksum, new Date().toISOString());
        });
      } catch (e) {
        throw new PersistenceError(ERROR_CODES.MIGRATION_FAILED, `migration ${mig.version} (${mig.name}) failed: ${String(e)}`);
      }
    }
    conn.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('database_schema_version', ?)", String(maxMigrationVersion(this.migrationsDir)));
    conn.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('updated_at', ?)", new Date().toISOString());
    return { applied: this.applied(conn), backedUp, migratedCount: pending.length };
  }

  private readSchemaVersion(conn: SqliteConnection): number {
    try {
      const row = conn.get<{ value: string }>("SELECT value FROM app_meta WHERE key = 'database_schema_version'");
      return row ? parseInt(row.value, 10) : 0;
    } catch {
      return 0;
    }
  }
}

