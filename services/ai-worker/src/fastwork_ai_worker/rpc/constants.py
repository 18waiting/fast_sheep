"""Infrastructure constants for the M2 stdio JSONL RPC worker. No business constants."""

RPC_PROTOCOL_VERSION = 1
READY_EVENT = "worker.ready"

DEFAULT_MAX_FRAME_BYTES = 1024 * 1024  # 1 MiB (ADR-002 clean-room DESIGN value)
DEFAULT_MAX_INFLIGHT = 8

METHOD_HEALTH = "system.health"
METHOD_CANCEL = "system.cancel"
METHOD_SHUTDOWN = "system.shutdown"

# Wire error codes (match frozen GF-RPC fixtures)
CODE_NOT_READY = "not_ready"
CODE_TIMEOUT = "timeout"
CODE_CANCELLED = "cancelled"
CODE_WORKER_CRASHED = "worker_crashed"
CODE_PROTOCOL_ERROR = "protocol_error"
CODE_VERSION_UNSUPPORTED = "version.unsupported"
CODE_METHOD_NOT_FOUND = "method.unknown"
CODE_BACKPRESSURE = "backpressure"
CODE_PAYLOAD_OVERSIZE = "payload.oversize"
CODE_SHUTDOWN = "shutdown"

TEST_MODE_ENV = "FASTWORK_RPC_TEST_MODE"
