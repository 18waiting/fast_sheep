// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1 (TASK-016): migration type definitions.
export interface Migration {
  version: number;
  name: string;
  checksum: string;
  sql: string;
}

export interface MigrationRecord {
  version: number;
  name: string;
  checksum: string;
  applied_at: string;
}

export interface MigrationResult {
  applied: MigrationRecord[];
  backedUp: boolean;
  migratedCount: number;
}
