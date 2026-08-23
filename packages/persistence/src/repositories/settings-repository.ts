// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
export interface ConfigGroupRecord { group_name: string; schema_version: string; payload_json: string; updated_at: string; }
export interface SettingsRepository {
  getGroup(name: string): unknown | undefined;
  setGroup(name: string, payload: unknown): void;   // validates against M0 schema; no mutation on invalid
  listGroups(): ConfigGroupRecord[];
  removeGroup(name: string): void;
}
