// Clean-room implementation (TASK-017 M2). Transport-level TS types only.
// Domain types are owned by @fastwork/contracts; do not duplicate them here.

export interface RpcContext {
  shop_id: string;
  correlation_id: string;
  cancellation_token?: string;
}

export interface RpcRequest {
  version: number;
  request_id: string;
  method: string;
  payload: Record<string, unknown>;
  context?: RpcContext;
  cancellation_token?: string;
}

export interface RpcErrorShape {
  code: string;
  category: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
  correlation_id?: string;
}

export interface RpcResponse {
  request_id: string;
  ok: boolean;
  result: unknown;
  error: RpcErrorShape | null;
  metadata?: Record<string, unknown>;
}

export interface RpcEvent {
  event: string;
  payload: Record<string, unknown>;
  correlation_id?: string;
}

export interface WorkerReadyPayload {
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

export interface WorkerSpawn {
  executable: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface RequestOptions {
  timeoutMs?: number;
  context?: Partial<RpcContext>;
  signal?: AbortSignal;
}

/** Frame decode outcome emitted by JsonlDecoder. */
export type DecodeOutcome =
  | { kind: "frame"; frame: unknown }
  | { kind: "malformed"; line: string; frameBytes: number }
  | { kind: "oversize"; frameBytes: number; maxFrameBytes: number };
