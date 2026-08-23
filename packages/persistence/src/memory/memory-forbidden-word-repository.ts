// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { ForbiddenWordRepository, ForbiddenWordRecord } from "../repositories/forbidden-word-repository.js";
export class InMemoryForbiddenWordRepository implements ForbiddenWordRepository {
  private rows: ForbiddenWordRecord[] = [];
  private seq = 1;
  list(): ForbiddenWordRecord[] { return [...this.rows].sort((a, b) => (a.sort_order - b.sort_order) || ((a.id ?? 0) - (b.id ?? 0))); }
  save(w: ForbiddenWordRecord): void {
    if (w.id) { const i = this.rows.findIndex((x) => x.id === w.id); if (i >= 0) this.rows[i] = { ...w }; }
    else { this.rows.push({ ...w, id: this.seq++ }); }
  }
  remove(id: number): void { this.rows = this.rows.filter((x) => x.id !== id); }
}
