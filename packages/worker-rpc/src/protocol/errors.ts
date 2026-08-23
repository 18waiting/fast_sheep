// Clean-room implementation (TASK-017 M2). Normalized RPC error model.
// Wire `code` values match the frozen GF-RPC fixtures (version.unsupported, method.unknown,
// payload.oversize, cancelled, timeout). Categories are drawn from the canonical
// fastwork:error schema enum so every error response stays schema-valid.

export const RPC_ERROR_CODES = {
  NOT_READY: "not_ready",
  TIMEOUT: "timeout",
  CANCELLED: "cancelled",
  WORKER_CRASHED: "worker_crashed",
  PROTOCOL_ERROR: "protocol_error",
  VERSION_UNSUPPORTED: "version.unsupported",
  METHOD_NOT_FOUND: "method.unknown",
  BACKPRESSURE: "backpressure",
  FRAME_TOO_LARGE: "payload.oversize",
  SHUTDOWN: "shutdown",
  STARTUP_TIMEOUT: "startup_timeout",
} as const;

export type RpcErrorCode = (typeof RPC_ERROR_CODES)[keyof typeof RPC_ERROR_CODES];

/** Canonical error categories from schemas/errors/error.schema.json. */
export type RpcErrorCategory =
  | "validation"
  | "config"
  | "credentials"
  | "provider"
  | "retrieval"
  | "tool"
  | "timeout"
  | "network"
  | "internal"
  | "cancelled"
  | "unknown";

export interface RpcErrorShape {
  code: string;
  category: RpcErrorCategory;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
  correlation_id?: string;
}

interface ErrorSpec {
  category: RpcErrorCategory;
  retryable: boolean;
  message: string;
}

const SPECS: Record<RpcErrorCode, ErrorSpec> = {
  [RPC_ERROR_CODES.NOT_READY]: { category: "internal", retryable: true, message: "worker is not ready" },
  [RPC_ERROR_CODES.TIMEOUT]: { category: "timeout", retryable: true, message: "request timed out" },
  [RPC_ERROR_CODES.CANCELLED]: { category: "cancelled", retryable: false, message: "request cancelled" },
  [RPC_ERROR_CODES.WORKER_CRASHED]: { category: "internal", retryable: true, message: "worker process crashed" },
  [RPC_ERROR_CODES.PROTOCOL_ERROR]: { category: "validation", retryable: false, message: "protocol error" },
  [RPC_ERROR_CODES.VERSION_UNSUPPORTED]: { category: "validation", retryable: false, message: "unsupported protocol version" },
  [RPC_ERROR_CODES.METHOD_NOT_FOUND]: { category: "validation", retryable: false, message: "unknown method" },
  [RPC_ERROR_CODES.BACKPRESSURE]: { category: "internal", retryable: true, message: "backpressure: in-flight limit reached" },
  [RPC_ERROR_CODES.FRAME_TOO_LARGE]: { category: "validation", retryable: false, message: "frame exceeds maximum size" },
  [RPC_ERROR_CODES.SHUTDOWN]: { category: "internal", retryable: false, message: "worker is shutting down" },
  [RPC_ERROR_CODES.STARTUP_TIMEOUT]: { category: "timeout", retryable: true, message: "worker failed to become ready in time" },
};

/** Normalized RPC error. */
export class RpcError extends Error {
  readonly code: string;
  readonly category: RpcErrorCategory;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;
  readonly correlationId?: string;

  constructor(code: string, message?: string, opts?: { category?: RpcErrorCategory; retryable?: boolean; details?: Record<string, unknown>; correlationId?: string }) {
    const spec = SPECS[code as RpcErrorCode] ?? { category: (opts?.category ?? "unknown") as RpcErrorCategory, retryable: opts?.retryable ?? false, message: message ?? code };
    super(message ?? spec.message);
    this.name = "RpcError";
    this.code = code;
    this.category = opts?.category ?? spec.category;
    this.retryable = opts?.retryable ?? spec.retryable;
    this.details = opts?.details;
    this.correlationId = opts?.correlationId;
  }

  toShape(): RpcErrorShape {
    const shape: RpcErrorShape = { code: this.code, category: this.category, message: this.message, retryable: this.retryable };
    if (this.details) shape.details = this.details;
    if (this.correlationId) shape.correlation_id = this.correlationId;
    return shape;
  }
}

/** Wrap an arbitrary thrown value into a normalized RpcErrorShape (no stack traces leaked). */
export function toRpcError(e: unknown, fallbackCode: string = RPC_ERROR_CODES.PROTOCOL_ERROR): RpcErrorShape {
  if (e instanceof RpcError) return e.toShape();
  const code = e && typeof e === "object" && "code" in (e as Record<string, unknown>) && typeof (e as Record<string, unknown>).code === "string" ? ((e as Record<string, unknown>).code as string) : fallbackCode;
  const message = e instanceof Error ? e.message : String(e);
  return new RpcError(code, message).toShape();
}
