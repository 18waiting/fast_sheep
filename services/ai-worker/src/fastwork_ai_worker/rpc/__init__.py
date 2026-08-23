"""M2 AI worker RPC package (TASK-017). stdio JSONL v1 transport. No business logic."""
from .constants import RPC_PROTOCOL_VERSION
from .errors import WorkerRpcError
from .server import serve_stdio

__all__ = ["RPC_PROTOCOL_VERSION", "WorkerRpcError", "serve_stdio"]
