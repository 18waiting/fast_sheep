// M10 job recovery (clean-room). Crash recovery never blindly replays non-idempotent
// mutation jobs; a RUNNING/CANCELLING job found after restart is marked FAILED with a
// recovery decision (replay only if the job declared idempotent).
import type { JobRecord, JobState } from "./types.js";
import type { JobRepositoryPort } from "./ports/job-repository-port.js";

export interface RecoveryDecision {
  job_id: string;
  state: JobState;
  automatic_replay: boolean;
  duplicate_mutation: boolean;
}

export function recoverJob(job: JobRecord): RecoveryDecision {
  if (job.state === "RUNNING" || job.state === "CANCELLING") {
    const idempotent = job.result?.includes("idempotent") ?? false;
    const decision: RecoveryDecision = {
      job_id: job.job_id,
      state: idempotent ? "QUEUED" : "FAILED",
      automatic_replay: idempotent,
      duplicate_mutation: false,
    };
    if (!idempotent) {
      job.state = "FAILED";
      job.error = "interrupted; not auto-replayed (non-idempotent)";
    }
    return decision;
  }
  return { job_id: job.job_id, state: job.state, automatic_replay: false, duplicate_mutation: false };
}

export function recoverAll(repository: JobRepositoryPort): RecoveryDecision[] {
  const decisions: RecoveryDecision[] = [];
  for (const job of repository.listByState("RUNNING")) decisions.push(recoverJob(job));
  for (const job of repository.listByState("CANCELLING")) decisions.push(recoverJob(job));
  for (const d of decisions) {
    const job = repository.get(d.job_id);
    if (job) repository.update(job);
  }
  return decisions;
}
