// M10 BackgroundJobService (clean-room). Main owns background_jobs; the Worker
// only executes job work. Wraps @fastwork/background-jobs JobManager with the
// persistence JobRepository adapter and broadcasts typed events.
import {
  JobManager,
  JobRegistry,
  PersistenceJobRepository,
  recoverAll,
  type JobRecord,
  type JobType,
  type JobFn,
  type JobRepositoryPort,
} from "@fastwork/background-jobs";
import type { JobRepository as PersistenceJobRepositoryPort } from "@fastwork/persistence";

export interface BackgroundJobEventSink {
  (channel: string, payload: unknown): void;
}

export interface BackgroundJobServiceOptions {
  /** Main-owned persistence JobRepository (SqliteJobRepository). */
  jobRepository: PersistenceJobRepositoryPort;
  /** Broadcast sink for typed IPC events (jobs.changed / progress). */
  eventSink?: BackgroundJobEventSink;
  now?: () => number;
  jobIdFactory?: () => string;
}

export class BackgroundJobService {
  private readonly registry = new JobRegistry();
  private readonly repository: JobRepositoryPort;
  private readonly manager: JobManager;
  private readonly sink: BackgroundJobEventSink;
  private readonly pendingRequests = new Map<string, Record<string, unknown>>();

  constructor(options: BackgroundJobServiceOptions) {
    this.sink = options.eventSink ?? (() => {});
    this.repository = new PersistenceJobRepository({
      create: (j) => options.jobRepository.create(j as never),
      update: (j) => options.jobRepository.update(j as never),
      get: (id) => (options.jobRepository.get(id) as unknown as JobRecord | undefined) ?? null,
      list: (type, limit) => {
        const all = (options.jobRepository.list() as unknown as JobRecord[]);
        const filtered = type ? all.filter((j) => j.type === type) : all;
        return limit !== undefined ? filtered.slice(0, limit) : filtered;
      },
      listByState: (state) => (options.jobRepository.list(state) as unknown as JobRecord[]),
    });
    this.manager = new JobManager({
      registry: this.registry,
      repository: this.repository,
      clock: { now: options.now ?? (() => Date.now()) },
      jobIdFactory: options.jobIdFactory,
      eventBus: {
        emit: (event, payload) => {
          if (event === "JobStateChanged" || event === "JobProgress") {
            this.sink("jobs.changed", { event, payload });
          }
        },
      },
    });
  }

  /** Register a job runner for a domain type (worker executes the work). */
  register(type: JobType, fn: JobFn): void {
    this.registry.register(type, fn);
  }

  create(type: JobType, request: Record<string, unknown>, options?: { idempotent?: boolean; cancellationToken?: string }): JobRecord {
    const job = this.manager.create(type, request, options);
    this.pendingRequests.set(job.job_id, request);
    return job;
  }

  get(jobId: string): JobRecord | null { return this.manager.get(jobId); }
  list(type?: string, limit?: number): JobRecord[] { return this.manager.list(type, limit); }
  async run(jobId: string): Promise<JobRecord> { return this.manager.run(jobId); }
  cancel(jobId: string): JobRecord { return this.manager.cancel(jobId); }
  recover(): ReturnType<typeof recoverAll> { return recoverAll(this.repository); }
  requestFor(jobId: string): Record<string, unknown> { return this.pendingRequests.get(jobId) ?? {}; }
  /** Remove the pending request map entry after the job finishes. */
  forget(jobId: string): void { this.pendingRequests.delete(jobId); }
}

