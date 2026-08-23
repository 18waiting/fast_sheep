// M11 durable import session (clean-room). Backed by legacy_import_sessions +
// legacy_import_items (0004). Idempotent resume: re-running the same session
// continues from its durable state instead of duplicating mutations.
import { randomUUID } from "node:crypto";
import type { ImportSession, SessionState, ImportPhase } from "./types.js";

export interface ImportSessionStorePort {
  create(session: ImportSession): void;
  get(sessionId: string): ImportSession | null;
  updateState(sessionId: string, state: SessionState, phase?: ImportPhase, error?: string | null): void;
  appendPhase(sessionId: string, phase: ImportPhase): void;
  listRecent(limit?: number): ImportSession[];
}

export class SqliteImportSessionStore implements ImportSessionStorePort {
  constructor(private readonly conn: { run(sql: string, ...params: unknown[]): void; get<T>(sql: string, ...params: unknown[]): T | undefined; all<T>(sql: string, ...params: unknown[]): T[] }) {}

  create(session: ImportSession): void {
    this.conn.run(
      "INSERT OR REPLACE INTO legacy_import_sessions (session_id, selection_id, plan_sha256, state, phases_json, started_at, completed_at, backup_id, error) VALUES (?,?,?,?,?,?,?,?,?)",
      session.session_id, session.selection_id, session.plan_sha256, session.state,
      JSON.stringify(session.phases), session.started_at, session.completed_at ?? null,
      session.backup_id ?? null, session.error ?? null,
    );
  }

  get(sessionId: string): ImportSession | null {
    const row = this.conn.get<Record<string, unknown>>(
      "SELECT session_id, selection_id, plan_sha256, state, phases_json, started_at, completed_at, backup_id, error FROM legacy_import_sessions WHERE session_id = ?", sessionId);
    if (!row) return null;
    return mapSession(row);
  }

  updateState(sessionId: string, state: SessionState, phase?: ImportPhase, error?: string | null): void {
    const completedAt = state === "COMPLETED" ? new Date().toISOString() : null;
    this.conn.run("UPDATE legacy_import_sessions SET state = ?, completed_at = COALESCE(?, completed_at), error = ? WHERE session_id = ?", state, completedAt, error ?? null, sessionId);
    if (phase) this.appendPhase(sessionId, phase);
  }

  appendPhase(sessionId: string, phase: ImportPhase): void {
    const session = this.get(sessionId);
    if (!session) return;
    if (session.phases.includes(phase)) return;
    const phases = [...session.phases, phase];
    this.conn.run("UPDATE legacy_import_sessions SET phases_json = ? WHERE session_id = ?", JSON.stringify(phases), sessionId);
  }

  listRecent(limit = 20): ImportSession[] {
    return this.conn.all<Record<string, unknown>>(
      "SELECT session_id, selection_id, plan_sha256, state, phases_json, started_at, completed_at, backup_id, error FROM legacy_import_sessions ORDER BY started_at DESC LIMIT ?", limit).map(mapSession);
  }
}

function mapSession(row: Record<string, unknown>): ImportSession {
  return {
    session_id: String(row.session_id),
    selection_id: String(row.selection_id),
    plan_sha256: String(row.plan_sha256),
    state: String(row.state) as SessionState,
    phases: JSON.parse(String(row.phases_json ?? "[]")),
    started_at: String(row.started_at),
    completed_at: row.completed_at ? String(row.completed_at) : null,
    backup_id: row.backup_id ? String(row.backup_id) : null,
    error: row.error ? String(row.error) : null,
  };
}

export function createSession(selectionId: string, planFingerprint: string): ImportSession {
  return {
    session_id: "sess-" + randomUUID().slice(0, 8),
    selection_id: selectionId,
    plan_sha256: planFingerprint,
    state: "MAIN_PREPARED",
    phases: ["APPLY_REQUEST"],
    started_at: new Date().toISOString(),
    completed_at: null,
    backup_id: null,
    error: null,
  };
}
