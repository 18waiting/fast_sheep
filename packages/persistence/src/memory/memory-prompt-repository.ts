// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { PromptRepository, PromptRecord } from "../repositories/prompt-repository.js";
export class InMemoryPromptRepository implements PromptRepository {
  private map = new Map<string, PromptRecord>();
  list(): PromptRecord[] { return [...this.map.values()].map((p) => ({ ...p, mounted_skills: [...p.mounted_skills] })); }
  get(id: string): PromptRecord | undefined { const p = this.map.get(id); return p ? { ...p, mounted_skills: [...p.mounted_skills] } : undefined; }
  save(p: PromptRecord): void { this.map.set(p.id, { ...p, mounted_skills: [...p.mounted_skills] }); }
  remove(id: string): void { this.map.delete(id); }
}
