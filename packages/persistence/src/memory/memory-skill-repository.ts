// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { SkillRepository, SkillRecord } from "../repositories/skill-repository.js";
export class InMemorySkillRepository implements SkillRepository {
  private map = new Map<string, SkillRecord>();
  private mounts = new Map<string, Set<string>>();
  list(): SkillRecord[] { return [...this.map.values()].map((s) => ({ ...s })); }
  get(id: string): SkillRecord | undefined { const s = this.map.get(id); return s ? { ...s } : undefined; }
  save(s: SkillRecord): void { this.map.set(s.skill_id, { ...s }); }
  remove(id: string): void { this.map.delete(id); this.mounts.delete(id); }
  mountToProduct(productId: string, skillId: string): void { if (!this.mounts.has(productId)) this.mounts.set(productId, new Set()); this.mounts.get(productId)!.add(skillId); }
  listMounts(productId: string): string[] { return [...(this.mounts.get(productId) ?? [])].sort(); }
}
