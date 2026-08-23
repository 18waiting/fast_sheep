// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { SqliteConnection } from "../db/sqlite-driver.js";
import type { StatsRepository } from "../repositories/stats-repository.js";
import { runInTransaction } from "../db/transaction.js";

export class SqliteStatsRepository implements StatsRepository {
  constructor(private conn: SqliteConnection) {}
  set(key: string, value: unknown): void { runInTransaction(this.conn, () => { this.conn.run("INSERT INTO stats (stat_key, stat_value, updated_at) VALUES (?,?,?) ON CONFLICT(stat_key) DO UPDATE SET stat_value=excluded.stat_value, updated_at=excluded.updated_at", key, JSON.stringify(value), new Date().toISOString()); }); }
  get(key: string): unknown | undefined { const r = this.conn.get<{ stat_value: string }>("SELECT stat_value FROM stats WHERE stat_key = ?", key); return r ? JSON.parse(r.stat_value) : undefined; }
}
