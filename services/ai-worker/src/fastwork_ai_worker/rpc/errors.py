"""Normalized RPC errors for the M2 worker. No stack traces are placed in public responses."""
from __future__ import annotations

from typing import Any, Dict, Optional


class WorkerRpcError(Exception):
    """Structured RPC error with a canonical wire code and category."""

    def __init__(
        self,
        code: str,
        message: Optional[str] = None,
        category: str = "internal",
        retryable: bool = False,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message or code)
        self.code = code
        self.category = category
        self.retryable = retryable
        self.details = details

    def to_dict(self) -> Dict[str, Any]:
        out: Dict[str, Any] = {
            "code": self.code,
            "category": self.category,
            "message": str(self),
            "retryable": self.retryable,
        }
        if self.details:
            out["details"] = self.details
        return out


def error_response(request_id: str, err: WorkerRpcError) -> Dict[str, Any]:
    """Build a normalized error response envelope."""
    return {
        "request_id": request_id,
        "ok": False,
        "result": None,
        "error": err.to_dict(),
        "metadata": {},
    }


def ok_response(request_id: str, result: Any) -> Dict[str, Any]:
    """Build a normalized success response envelope."""
    return {
        "request_id": request_id,
        "ok": True,
        "result": result,
        "error": None,
        "metadata": {},
    }
