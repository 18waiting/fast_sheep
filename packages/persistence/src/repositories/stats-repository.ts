// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
export interface StatsRepository { set(key: string, value: unknown): void; get(key: string): unknown | undefined; }
