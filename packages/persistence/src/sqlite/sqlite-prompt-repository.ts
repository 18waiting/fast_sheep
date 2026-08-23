// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { SqliteConnection } from "../db/sqlite-driver.js";
import type { PromptRepository, PromptRecord } from "../repositories/prompt-repository.js";
import { runInTransaction } from "../db/transaction.js";

function mapPrompt(r: any): PromptRecord { return { id: r.id, title: r.title, content: r.content, order_status_binding: r.order_status_binding, mounted_skills: JSON.parse(r.mounted_skills || "[]") }; }

export class SqlitePromptRepository implements PromptRepository {
  constructor(private conn: SqliteConnection) {}
  list(): PromptRecord[] { return this.conn.all("SELECT id, title, content, order_status_binding, mounted_skills FROM prompt_profiles ORDER BY id").map(mapPrompt); }
  get(id: string): PromptRecord | undefined { const r = this.conn.get("SELECT id, title, content, order_status_binding, mounted_skills FROM prompt_profiles WHERE id = ?", id); return r ? mapPrompt(r) : undefined; }
  save(p: PromptRecord): void { runInTransaction(this.conn, () => { this.conn.run("INSERT INTO prompt_profiles (id, title, content, order_status_binding, mounted_skills, created_at, updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, content=excluded.content, order_status_binding=excluded.order_status_binding, mounted_skills=excluded.mounted_skills, updated_at=excluded.updated_at", p.id, p.title, p.content, p.order_status_binding, JSON.stringify(p.mounted_skills), new Date().toISOString(), new Date().toISOString()); }); }
  remove(id: string): void { this.conn.run("DELETE FROM prompt_profiles WHERE id = ?", id); }
}
