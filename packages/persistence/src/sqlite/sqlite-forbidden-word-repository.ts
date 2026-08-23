// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { SqliteConnection } from "../db/sqlite-driver.js";
import type { ForbiddenWordRepository, ForbiddenWordRecord } from "../repositories/forbidden-word-repository.js";
import { runInTransaction } from "../db/transaction.js";

interface ForbiddenRow { id: number; term: string; replacement: string; enabled: number; sort_order: number; }

export class SqliteForbiddenWordRepository implements ForbiddenWordRepository {
  constructor(private conn: SqliteConnection) {}
  list(): ForbiddenWordRecord[] {
    return this.conn.all<ForbiddenRow>("SELECT id, term, replacement, enabled, sort_order FROM forbidden_words ORDER BY sort_order, id")
      .map((r) => ({ id: r.id, term: r.term, replacement: r.replacement, enabled: !!r.enabled, sort_order: r.sort_order }));
  }
  save(w: ForbiddenWordRecord): void {
    runInTransaction(this.conn, () => {
      if (w.id) this.conn.run("UPDATE forbidden_words SET term=?, replacement=?, enabled=?, sort_order=? WHERE id=?", w.term, w.replacement, w.enabled ? 1 : 0, w.sort_order, w.id);
      else this.conn.run("INSERT INTO forbidden_words (term, replacement, enabled, sort_order) VALUES (?,?,?,?)", w.term, w.replacement, w.enabled ? 1 : 0, w.sort_order);
    });
  }
  remove(id: number): void { this.conn.run("DELETE FROM forbidden_words WHERE id = ?", id); }
}
