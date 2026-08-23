// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { ProductRepository, ProductRecord } from "../repositories/product-repository.js";
export class InMemoryProductRepository implements ProductRepository {
  private map = new Map<string, ProductRecord>();
  get(id: string): ProductRecord | undefined { const p = this.map.get(id); return p ? { ...p } : undefined; }
  save(p: ProductRecord): void { this.map.set(p.product_id, { ...p }); }
  remove(id: string): void { this.map.delete(id); }
  list(): ProductRecord[] { return [...this.map.values()].map((p) => ({ ...p })); }
  applyDetail(id: string, detail: string): boolean { const p = this.map.get(id); if (!p) return false; p.detail = detail; return true; }
  updateDetail(id: string, detail: string, meta?: { lastOptimizedAt?: string }): boolean {
    const p = this.map.get(id);
    if (!p) return false;
    p.detail = detail;
    if (meta?.lastOptimizedAt) p.last_optimized_at = meta.lastOptimizedAt;
    return true;
  }
}
