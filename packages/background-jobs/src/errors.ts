// M10 background-job errors (clean-room).
export const JOB_ERROR_CODES = {
  NOT_FOUND: "job.not_found",
  ALREADY_CANCELLED: "job.already_cancelled",
  NOT_CANCELLABLE: "job.not_cancellable",
  DUPLICATE_MUTATION: "job.duplicate_mutation",
} as const;
export type JobErrorCode = (typeof JOB_ERROR_CODES)[keyof typeof JOB_ERROR_CODES];
export class JobError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = "JobError"; this.code = code; }
}
