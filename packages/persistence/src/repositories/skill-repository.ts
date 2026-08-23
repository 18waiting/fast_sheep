// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
export interface SkillRecord { skill_id: string; name: string; enabled: boolean; asset_path: string; signature?: string | null; metadata?: Record<string, unknown>; }
export interface SkillRepository { list(): SkillRecord[]; get(id: string): SkillRecord | undefined; save(s: SkillRecord): void; remove(id: string): void; mountToProduct(productId: string, skillId: string): void; listMounts(productId: string): string[]; }
