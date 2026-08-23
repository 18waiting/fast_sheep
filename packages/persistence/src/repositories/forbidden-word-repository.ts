// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
export interface ForbiddenWordRecord { id?: number; term: string; replacement: string; enabled: boolean; sort_order: number; }
export interface ForbiddenWordRepository { list(): ForbiddenWordRecord[]; save(w: ForbiddenWordRecord): void; remove(id: number): void; }
