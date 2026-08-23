// M10 persistence job repository adapter (clean-room). Main single-writer.
import type { JobRecord } from "../types.js";
import type { JobRepositoryPort } from "../ports/job-repository-port.js";

export class PersistenceJobRepository implements JobRepositoryPort {
  constructor(private readonly repo: {
    create(j: JobRecord): void; update(j: JobRecord): void; get(id: string): JobRecord | null | undefined;
    list(type?: string, limit?: number): JobRecord[]; listByState(state: string): JobRecord[];
  }) {}
  create(job: JobRecord): void { this.repo.create(job); }
  update(job: JobRecord): void { this.repo.update(job); }
  get(jobId: string): JobRecord | null { return this.repo.get(jobId) ?? null; }
  list(type?: string, limit?: number): JobRecord[] { return this.repo.list(type, limit); }
  listByState(state: string): JobRecord[] { return this.repo.listByState(state); }
}
