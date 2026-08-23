// M10 job ports (clean-room).
import type { JobRecord } from "../types.js";
export interface JobRepositoryPort {
  create(job: JobRecord): void;
  update(job: JobRecord): void;
  get(jobId: string): JobRecord | null;
  list(type?: string, limit?: number): JobRecord[];
  listByState(state: string): JobRecord[];
}
