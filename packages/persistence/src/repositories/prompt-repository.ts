// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
export interface PromptRecord { id: string; title: string; content: string; order_status_binding: string; mounted_skills: string[]; }
export interface PromptRepository { list(): PromptRecord[]; get(id: string): PromptRecord | undefined; save(p: PromptRecord): void; remove(id: string): void; }
