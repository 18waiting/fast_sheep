// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
export interface JobRecord { job_id: string; type: string; state: string; progress: number; message: string; started_at?: string | null; finished_at?: string | null; cancellation_token?: string | null; error?: unknown | null; result?: unknown | null; }
export interface JobRepository { create(j: JobRecord): void; update(j: JobRecord): void; get(id: string): JobRecord | undefined; list(state?: string): JobRecord[]; }
