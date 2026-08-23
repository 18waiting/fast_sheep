// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { SqliteConnection } from "../db/sqlite-driver.js";
import type { ShopRepository, ShopRecord } from "../repositories/shop-repository.js";
import { runInTransaction } from "../db/transaction.js";

interface ShopRow { id: string; type: string; name: string; created_time: string | null; enabled: number; order: number; }

export class SqliteShopRepository implements ShopRepository {
  constructor(private conn: SqliteConnection) {}
  list(): ShopRecord[] {
    return this.conn.all<ShopRow>("SELECT id, type, name, created_time, enabled, sort_order AS \"order\" FROM shops ORDER BY sort_order, id")
      .map((r) => ({ id: r.id, type: r.type, name: r.name, created_time: r.created_time, enabled: !!r.enabled, order: r.order }));
  }
  add(s: ShopRecord): void { this.conn.run("INSERT INTO shops (id, type, name, created_time, enabled, sort_order) VALUES (?,?,?,?,?,?)", s.id, s.type, s.name, s.created_time ?? null, s.enabled ? 1 : 0, s.order ?? 0); }
  remove(id: string): void { this.conn.run("DELETE FROM shops WHERE id = ?", id); }
  rename(id: string, name: string): void { this.conn.run("UPDATE shops SET name = ? WHERE id = ?", name, id); }
  reorder(id: string, order: number): void { this.conn.run("UPDATE shops SET sort_order = ? WHERE id = ?", order, id); }
  setEnabled(id: string, enabled: boolean): void { this.conn.run("UPDATE shops SET enabled = ? WHERE id = ?", enabled ? 1 : 0, id); }
}
