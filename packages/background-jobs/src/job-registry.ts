// M10 job registry (clean-room): job type -> runner factory.
import type { JobRunContext, JobType } from "./types.js";
export type JobFn = (ctx: JobRunContext) => Promise<Record<string, unknown> | void>;
export class JobRegistry {
  private readonly runners = new Map<JobType, JobFn>();
  register(type: JobType, fn: JobFn): void { this.runners.set(type, fn); }
  get(type: JobType): JobFn | undefined { return this.runners.get(type); }
  has(type: JobType): boolean { return this.runners.has(type); }
  types(): JobType[] { return [...this.runners.keys()]; }
}
