// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1 (TASK-016): SQLite driver abstraction (node:sqlite DatabaseSync). Repositories
// never touch the driver API directly.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type SqlParam = string | number | bigint | Uint8Array | null;

export class SqliteConnection {
  readonly path: string;
  private db: DatabaseSync;
  private inTransaction = false;

  constructor(path: string) {
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
  }

  run(sql: string, ...params: SqlParam[]): void {
    this.db.prepare(sql).run(...params);
  }

  get<T = Record<string, unknown>>(sql: string, ...params: SqlParam[]): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  all<T = Record<string, unknown>>(sql: string, ...params: SqlParam[]): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  /** Reentrant transaction: nested calls participate in the outer transaction. */
  transaction<T>(fn: () => T): T {
    if (this.inTransaction) return fn();
    this.inTransaction = true;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      try { this.db.exec("ROLLBACK"); } catch { /* ignore */ }
      throw e;
    } finally {
      this.inTransaction = false;
    }
  }

  close(): void {
    try { this.db.close(); } catch { /* ignore */ }
  }
}
