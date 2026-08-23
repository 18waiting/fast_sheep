// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { JobRepository, JobRecord } from "../repositories/job-repository.js";
export class InMemoryJobRepository implements JobRepository {
  private map = new Map<string, JobRecord>();
  create(j: JobRecord): void { this.map.set(j.job_id, { ...j }); }
  update(j: JobRecord): void { this.map.set(j.job_id, { ...j }); }
  get(id: string): JobRecord | undefined { const j = this.map.get(id); return j ? { ...j } : undefined; }
  list(state?: string): JobRecord[] { return [...this.map.values()].filter((j) => !state || j.state === state).map((j) => ({ ...j })); }
}
