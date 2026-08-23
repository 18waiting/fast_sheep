// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1 (TASK-016): explicit transaction boundary (BEGIN IMMEDIATE / COMMIT / ROLLBACK).
import type { SqliteConnection } from "./sqlite-driver.js";

export function runInTransaction<T>(conn: SqliteConnection, fn: () => T): T {
  return conn.transaction(fn);
}
