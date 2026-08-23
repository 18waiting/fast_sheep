// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { SqliteConnection } from "../db/sqlite-driver.js";
import type { SettingsRepository, ConfigGroupRecord } from "../repositories/settings-repository.js";
import { runInTransaction } from "../db/transaction.js";
import { validateConfigGroup } from "../config-validate.js";
import { PersistenceError, ERROR_CODES } from "../db/errors.js";

export class SqliteSettingsRepository implements SettingsRepository {
  constructor(private conn: SqliteConnection) {}
  getGroup(name: string): unknown | undefined {
    const row = this.conn.get<ConfigGroupRecord>("SELECT group_name, schema_version, payload_json, updated_at FROM config_groups WHERE group_name = ?", name);
    return row ? JSON.parse(row.payload_json) : undefined;
  }
  setGroup(name: string, payload: unknown): void {
    const check = validateConfigGroup(name, payload);
    if (!check.ok) throw new PersistenceError(ERROR_CODES.INVALID_CONFIG, `config ${name} invalid: ${check.errors.join("; ")}`);
    runInTransaction(this.conn, () => {
      this.conn.run("INSERT INTO config_groups (group_name, schema_version, payload_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(group_name) DO UPDATE SET schema_version=excluded.schema_version, payload_json=excluded.payload_json, updated_at=excluded.updated_at",
                    name, "1.0", JSON.stringify(payload), new Date().toISOString());
    });
  }
  listGroups(): ConfigGroupRecord[] { return this.conn.all("SELECT group_name, schema_version, payload_json, updated_at FROM config_groups ORDER BY group_name"); }
  removeGroup(name: string): void { this.conn.run("DELETE FROM config_groups WHERE group_name = ?", name); }
}
