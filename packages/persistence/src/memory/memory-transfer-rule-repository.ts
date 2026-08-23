// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { TransferRuleRepository, TransferRuleRecord } from "../repositories/transfer-rule-repository.js";
export class InMemoryTransferRuleRepository implements TransferRuleRepository {
  private rows: TransferRuleRecord[] = [];
  private seq = 1;
  list(): TransferRuleRecord[] { return [...this.rows].sort((a, b) => (a.sort_order - b.sort_order) || ((a.id ?? 0) - (b.id ?? 0))); }
  save(r: TransferRuleRecord): void {
    if (r.id) { const i = this.rows.findIndex((x) => x.id === r.id); if (i >= 0) this.rows[i] = { ...r }; }
    else { this.rows.push({ ...r, id: this.seq++ }); }
  }
  remove(id: number): void { this.rows = this.rows.filter((x) => x.id !== id); }
}
