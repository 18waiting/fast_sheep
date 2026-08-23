// @fastwork/background-jobs public surface (M10 clean-room).
export { JobManager, type JobManagerOptions } from "./job-manager.js";
export { JobRegistry, type JobFn } from "./job-registry.js";
export { JobProgress } from "./job-progress.js";
export { JobCancellation } from "./job-cancellation.js";
export { recoverJob, recoverAll, type RecoveryDecision } from "./job-recovery.js";
export { JOB_ERROR_CODES, JobError, type JobErrorCode } from "./errors.js";
export type { JobType, JobState, JobRecord, JobStateChangedEvent, CancelJobRequest, JobRunContext } from "./types.js";
export type { JobRepositoryPort } from "./ports/job-repository-port.js";
export type { WorkerJobClientPort } from "./ports/worker-job-client.js";
export type { Clock } from "./ports/event-bus.js";
export type { JobEventBus } from "./ports/event-bus.js";
export { SystemClock, FakeClock, NoopJobEventBus, RecordingJobEventBus } from "./ports/event-bus.js";
export { PersistenceJobRepository } from "./adapters/persistence-job-repository.js";
export { WorkerJobClient } from "./adapters/worker-job-client.js";
