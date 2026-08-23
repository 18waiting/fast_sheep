// M10 background-job types (clean-room).
export type JobType = "learning" | "review" | "audit" | "optimization" | "index_rebuild";
export type JobState = "QUEUED" | "RUNNING" | "CANCELLING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface JobRecord {
  job_id: string;
  type: JobType;
  state: JobState;
  progress: number;
  message: string;
  started_at?: string | null;
  finished_at?: string | null;
  cancellation_token?: string | null;
  error?: string | null;
  result?: string | null;
}

export interface JobStateChangedEvent {
  job_id: string;
  state: JobState;
  progress: number;
  message?: string;
}

export interface CancelJobRequest {
  job_id: string;
}

export interface JobRunContext {
  jobId: string;
  type: JobType;
  signal: { cancelled: boolean; token: string | null };
  checkCancelled(): boolean;
  report(progress: number, message?: string): void;
}
