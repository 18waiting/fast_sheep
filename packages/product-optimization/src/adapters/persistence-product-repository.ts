// M10 persistence product repository adapter (clean-room). Main single-writer.
import type { ProductRow } from "../types.js";
import type { ProductRepositoryPort } from "../ports/index.js";

export class PersistenceProductRepository implements ProductRepositoryPort {
  constructor(private readonly repo: { get(id: string): ProductRow | null; updateDetail(id: string, detail: string, meta?: { lastOptimizedAt?: string }): boolean }) {}
  get(productId: string): ProductRow | null { return this.repo.get(productId); }
  updateDetail(productId: string, detail: string, meta?: { lastOptimizedAt?: string }): boolean { return this.repo.updateDetail(productId, detail, meta); }
}
