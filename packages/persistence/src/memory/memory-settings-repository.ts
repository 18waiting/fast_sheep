// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { SettingsRepository, ConfigGroupRecord } from "../repositories/settings-repository.js";
import { validateConfigGroup } from "../config-validate.js";
import { PersistenceError, ERROR_CODES } from "../db/errors.js";
export class InMemorySettingsRepository implements SettingsRepository {
  private map = new Map<string, ConfigGroupRecord>();
  getGroup(name: string): unknown | undefined { const r = this.map.get(name); return r ? JSON.parse(r.payload_json) : undefined; }
  setGroup(name: string, payload: unknown): void {
    const check = validateConfigGroup(name, payload);
    if (!check.ok) throw new PersistenceError(ERROR_CODES.INVALID_CONFIG, `config ${name} invalid: ${check.errors.join("; ")}`);
    this.map.set(name, { group_name: name, schema_version: "1.0", payload_json: JSON.stringify(payload), updated_at: new Date().toISOString() });
  }
  listGroups(): ConfigGroupRecord[] { return [...this.map.values()]; }
  removeGroup(name: string): void { this.map.delete(name); }
}
