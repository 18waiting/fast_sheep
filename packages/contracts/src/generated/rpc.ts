// GENERATED TYPE MIRRORS — keep in sync with rebuild/packages/contracts/schemas/rpc/*.schema.json.
// Clean-room implementation. JSON Schema (Draft 2020-12) is the single source of truth;
// these TS types mirror the M2 RPC payload schemas for static typing only.
// Do not add business logic here.

export interface WorkerReadyPayload {
  version?: number;
  worker_version: string;
  protocol_versions: number[];
  pid: number;
  python_version: string;
  capabilities: string[];
}

export interface HealthResult {
  status: "ok" | "degraded" | "unhealthy";
  worker_version: string;
  protocol_version: number;
  pid: number;
  uptime_ms: number;
}

export interface CancelPayload {
  target_request_id: string;
  reason?: string;
}

export interface CancelResult {
  request_id: string;
  cancelled: boolean;
  already_completed?: boolean;
}

export interface ShutdownResult {
  ok: boolean;
  exit_code: number;
  reason?: string;
}

export interface ProtocolErrorPayload {
  reason: string;
  code?: string;
  frame_bytes?: number;
  max_frame_bytes?: number;
  correlation_id?: string;
}
