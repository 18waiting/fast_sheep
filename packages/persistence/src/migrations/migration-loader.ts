// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1 (TASK-016): ordered migration discovery + SHA-256 checksums.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { Migration } from "./migration-types.js";

export function discoverMigrations(migrationsDir: string): Migration[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .flatMap((f) => {
      const m = /^(\d+)_(.+)\.sql$/.exec(f);
      if (!m) return [];
      const version = parseInt(m[1], 10);
      const name = m[2];
      const sql = readFileSync(join(migrationsDir, f), "utf-8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      return [{ version, name, checksum, sql }];
    });
}

export function maxMigrationVersion(migrationsDir: string): number {
  return discoverMigrations(migrationsDir).reduce((mx, m) => Math.max(mx, m.version), 0);
}
