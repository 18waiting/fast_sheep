// M10 product repository port (clean-room). Main single-writer for products.
import type { ProductRow } from "../types.js";
export interface ProductRepositoryPort {
  get(productId: string): ProductRow | null;
  updateDetail(productId: string, detail: string, meta?: { lastOptimizedAt?: string }): boolean;
}
