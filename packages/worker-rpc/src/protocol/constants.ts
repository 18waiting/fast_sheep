// Clean-room implementation (TASK-017 M2). Infrastructure constants only — no business constants.

/** ADR-002 worker RPC protocol version (envelope `version` field). */
export const RPC_PROTOCOL_VERSION = 1;

/** Ready event emitted by the worker as its first protocol frame (ADR-002 / GF-RPC-001). */
export const READY_EVENT = "worker.ready";

/** Default maximum frame size in bytes (clean-room DESIGN value; ADR-002 suggests 1 MiB). */
export const DEFAULT_MAX_FRAME_BYTES = 1024 * 1024;

/** Default bounded in-flight request limit (ADR-002 backpressure; GF-RPC-011). */
export const DEFAULT_MAX_INFLIGHT = 8;

/** Default bounded queued-write frames before immediate backpressure rejection. */
export const DEFAULT_MAX_QUEUED_FRAMES = 32;

/** Default startup (ready handshake) timeout in ms. REBUILD DECISION; configurable. */
export const DEFAULT_STARTUP_TIMEOUT_MS = 10_000;

/** Default per-request timeout in ms. REBUILD DECISION; configurable. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/** Default graceful shutdown deadline in ms before force-kill. REBUILD DECISION; configurable. */
export const DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS = 5_000;

/** Default restart policy (ADR-002: 1s,2s,4s... cap 30s; bounded attempts). */
export const DEFAULT_RESTART_MAX_ATTEMPTS = 3;
export const DEFAULT_RESTART_INITIAL_BACKOFF_MS = 1_000;
export const DEFAULT_RESTART_MAX_BACKOFF_MS = 30_000;

/** Canonical system methods implemented by the M2 worker (production). */
export const SYSTEM_METHODS = ["system.health", "system.cancel", "system.shutdown"] as const;

/** Env keys whitelisted for the worker subprocess (no full parent-env dump). */
export const WORKER_ENV_ALLOWLIST = ["FASTWORK_DATA_DIR", "FASTWORK_RPC_TEST_MODE", "FASTWORK_CONTRACTS_SCHEMAS_DIR", "PYTHONPATH", "PYTHONIOENCODING", "PYTHONUNBUFFERED", "SYSTEMROOT", "PATH", "FAKE_WORKER_MODE", "FAKE_WORKER_MAX_FRAME", "FASTWORK_M5_RAG_ROOT"] as const;
