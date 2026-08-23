// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { SqliteConnection } from "../db/sqlite-driver.js";
import type { ProductRepository, ProductRecord } from "../repositories/product-repository.js";
import { runInTransaction } from "../db/transaction.js";

export class SqliteProductRepository implements ProductRepository {
  constructor(private conn: SqliteConnection) {}
  get(id: string): ProductRecord | undefined { return this.conn.get("SELECT product_id, title, detail, shop, note, last_optimized_at FROM products WHERE product_id = ?", id); }
  save(p: ProductRecord): void {
    runInTransaction(this.conn, () => {
      this.conn.run("INSERT INTO products (product_id, title, detail, shop, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET title=excluded.title, detail=excluded.detail, shop=excluded.shop, note=excluded.note, updated_at=excluded.updated_at",
                    p.product_id, p.title, p.detail, p.shop, p.note, new Date().toISOString(), new Date().toISOString());
    });
  }
  remove(id: string): void { this.conn.run("DELETE FROM products WHERE product_id = ?", id); }
  list(): ProductRecord[] { return this.conn.all("SELECT product_id, title, detail, shop, note, last_optimized_at FROM products ORDER BY product_id"); }
  applyDetail(id: string, detail: string): boolean {
    return runInTransaction(this.conn, () => {
      this.conn.run("UPDATE products SET detail = ?, updated_at = ? WHERE product_id = ?", detail, new Date().toISOString(), id);
      return (this.conn.get<{ changes: number }>("SELECT changes() AS changes")?.changes ?? 0) > 0;
    });
  }
  updateDetail(id: string, detail: string, meta?: { lastOptimizedAt?: string }): boolean {
    return runInTransaction(this.conn, () => {
      const last = meta?.lastOptimizedAt ?? new Date().toISOString();
      this.conn.run("UPDATE products SET detail = ?, last_optimized_at = ?, updated_at = ? WHERE product_id = ?", detail, last, new Date().toISOString(), id);
      return (this.conn.get<{ changes: number }>("SELECT changes() AS changes")?.changes ?? 0) > 0;
    });
  }
}
