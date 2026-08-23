// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { SqliteConnection } from "../db/sqlite-driver.js";
import type { JobRepository, JobRecord } from "../repositories/job-repository.js";
import { runInTransaction } from "../db/transaction.js";

function mapJob(r: any): JobRecord { return { job_id: r.job_id, type: r.type, state: r.state, progress: r.progress, message: r.message, started_at: r.started_at, finished_at: r.finished_at, cancellation_token: r.cancellation_token, error: r.error ? JSON.parse(r.error) : null, result: r.result ? JSON.parse(r.result) : null }; }

export class SqliteJobRepository implements JobRepository {
  constructor(private conn: SqliteConnection) {}
  create(j: JobRecord): void { this.conn.run("INSERT INTO background_jobs (job_id, type, state, progress, message, started_at, finished_at, cancellation_token, error, result) VALUES (?,?,?,?,?,?,?,?,?,?)", j.job_id, j.type, j.state, j.progress, j.message, j.started_at ?? null, j.finished_at ?? null, j.cancellation_token ?? null, j.error !== undefined ? JSON.stringify(j.error) : null, j.result !== undefined ? JSON.stringify(j.result) : null); }
  update(j: JobRecord): void { runInTransaction(this.conn, () => { this.conn.run("UPDATE background_jobs SET state=?, progress=?, message=?, finished_at=?, cancellation_token=?, error=?, result=? WHERE job_id=?", j.state, j.progress, j.message, j.finished_at ?? null, j.cancellation_token ?? null, j.error !== undefined ? JSON.stringify(j.error) : null, j.result !== undefined ? JSON.stringify(j.result) : null, j.job_id); }); }
  get(id: string): JobRecord | undefined { const r = this.conn.get("SELECT job_id, type, state, progress, message, started_at, finished_at, cancellation_token, error, result FROM background_jobs WHERE job_id = ?", id); return r ? mapJob(r) : undefined; }
  list(state?: string): JobRecord[] { return state ? this.conn.all("SELECT job_id, type, state, progress, message, started_at, finished_at, cancellation_token, error, result FROM background_jobs WHERE state = ? ORDER BY started_at", state).map(mapJob) : this.conn.all("SELECT job_id, type, state, progress, message, started_at, finished_at, cancellation_token, error, result FROM background_jobs ORDER BY started_at").map(mapJob); }
}
