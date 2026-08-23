// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1 (TASK-016): explicit PRAGMA configuration. Values recorded in m1 reports.
import type { SqliteConnection } from "./sqlite-driver.js";

export interface Pragmas {
  busyTimeoutMs: number;
  synchronous: "OFF" | "NORMAL" | "FULL" | "EXTRA";
}

export const PRAGMAS: Pragmas = { busyTimeoutMs: 5000, synchronous: "NORMAL" };

export function applyPragmas(conn: SqliteConnection, opts: Partial<Pragmas> = {}): Pragmas {
  const p: Pragmas = { ...PRAGMAS, ...opts };
  conn.exec("PRAGMA foreign_keys = ON");
  conn.exec("PRAGMA journal_mode = WAL");
  conn.exec(`PRAGMA busy_timeout = ${Math.max(0, Math.floor(p.busyTimeoutMs))}`);
  conn.exec(`PRAGMA synchronous = ${p.synchronous}`);
  return p;
}
