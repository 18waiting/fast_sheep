// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
export interface ProductRecord { product_id: string; title: string; detail: string; shop: string; note: string; last_optimized_at?: string | null; }
export interface ProductRepository {
  get(id: string): ProductRecord | undefined;
  save(p: ProductRecord): void;
  remove(id: string): void;
  list(): ProductRecord[];
  applyDetail(id: string, detail: string): boolean;
  /** M10: atomic detail + cooldown metadata update (Main single-writer). */
  updateDetail(id: string, detail: string, meta?: { lastOptimizedAt?: string }): boolean;
}
