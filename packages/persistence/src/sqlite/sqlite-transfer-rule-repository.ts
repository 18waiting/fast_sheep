// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { SqliteConnection } from "../db/sqlite-driver.js";
import type { TransferRuleRepository, TransferRuleRecord } from "../repositories/transfer-rule-repository.js";
import { runInTransaction } from "../db/transaction.js";

interface TransferRuleRow { id: number; keyword: string; transfer_to: string; transfer_message: string; work_hours: string; source_agent: string; status: string; order_state: string; applicable_shops: string; sort_order: number; enabled: number; }

export class SqliteTransferRuleRepository implements TransferRuleRepository {
  constructor(private conn: SqliteConnection) {}
  list(): TransferRuleRecord[] {
    return this.conn.all<TransferRuleRow>("SELECT id, keyword, transfer_to, transfer_message, work_hours, source_agent, status, order_state, applicable_shops, sort_order, enabled FROM transfer_rules ORDER BY sort_order, id")
      .map((r) => ({ id: r.id, keyword: r.keyword, transfer_to: r.transfer_to, transfer_message: r.transfer_message, work_hours: r.work_hours, source_agent: r.source_agent, status: r.status, order_state: r.order_state, applicable_shops: r.applicable_shops, sort_order: r.sort_order, enabled: !!r.enabled }));
  }
  save(r: TransferRuleRecord): void {
    runInTransaction(this.conn, () => {
      if (r.id) this.conn.run("UPDATE transfer_rules SET keyword=?, transfer_to=?, transfer_message=?, work_hours=?, source_agent=?, status=?, order_state=?, applicable_shops=?, sort_order=?, enabled=? WHERE id=?", r.keyword, r.transfer_to, r.transfer_message, r.work_hours, r.source_agent, r.status, r.order_state, r.applicable_shops, r.sort_order, r.enabled ? 1 : 0, r.id);
      else this.conn.run("INSERT INTO transfer_rules (keyword, transfer_to, transfer_message, work_hours, source_agent, status, order_state, applicable_shops, sort_order, enabled) VALUES (?,?,?,?,?,?,?,?,?,?)", r.keyword, r.transfer_to, r.transfer_message, r.work_hours, r.source_agent, r.status, r.order_state, r.applicable_shops, r.sort_order, r.enabled ? 1 : 0);
    });
  }
  remove(id: number): void { this.conn.run("DELETE FROM transfer_rules WHERE id = ?", id); }
}
