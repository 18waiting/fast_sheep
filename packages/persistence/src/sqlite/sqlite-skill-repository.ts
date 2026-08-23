// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { SqliteConnection } from "../db/sqlite-driver.js";
import type { SkillRepository, SkillRecord } from "../repositories/skill-repository.js";
import { runInTransaction } from "../db/transaction.js";

interface SkillRow { skill_id: string; name: string; enabled: number; asset_path: string; signature: string | null; metadata: string; }
function mapSkill(r: SkillRow): SkillRecord { return { skill_id: r.skill_id, name: r.name, enabled: !!r.enabled, asset_path: r.asset_path, signature: r.signature, metadata: r.metadata ? JSON.parse(r.metadata) : {} }; }

export class SqliteSkillRepository implements SkillRepository {
  constructor(private conn: SqliteConnection) {}
  list(): SkillRecord[] { return this.conn.all<SkillRow>("SELECT skill_id, name, enabled, asset_path, signature, metadata FROM skills ORDER BY skill_id").map(mapSkill); }
  get(id: string): SkillRecord | undefined { const r = this.conn.get<SkillRow>("SELECT skill_id, name, enabled, asset_path, signature, metadata FROM skills WHERE skill_id = ?", id); return r ? mapSkill(r) : undefined; }
  save(s: SkillRecord): void { runInTransaction(this.conn, () => { this.conn.run("INSERT INTO skills (skill_id, name, enabled, asset_path, signature, metadata) VALUES (?,?,?,?,?,?) ON CONFLICT(skill_id) DO UPDATE SET name=excluded.name, enabled=excluded.enabled, asset_path=excluded.asset_path, signature=excluded.signature, metadata=excluded.metadata", s.skill_id, s.name, s.enabled ? 1 : 0, s.asset_path, s.signature ?? null, s.metadata ? JSON.stringify(s.metadata) : "{}"); }); }
  remove(id: string): void { runInTransaction(this.conn, () => { this.conn.run("DELETE FROM skills WHERE skill_id = ?", id); this.conn.run("DELETE FROM product_skill_mounts WHERE skill_id = ?", id); }); }
  mountToProduct(productId: string, skillId: string): void { this.conn.run("INSERT OR IGNORE INTO product_skill_mounts (product_id, skill_id) VALUES (?,?)", productId, skillId); }
  listMounts(productId: string): string[] { return this.conn.all<{ skill_id: string }>("SELECT skill_id FROM product_skill_mounts WHERE product_id = ? ORDER BY skill_id", productId).map((r) => r.skill_id); }
}
