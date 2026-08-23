"""JSONL framing for the M2 RPC worker: UTF-8, newline-delimited, bounded frame size.

stdout carries protocol frames only; stderr carries logs/diagnostics only.
"""
from __future__ import annotations

import json
import sys
from typing import Any, Optional

from .constants import DEFAULT_MAX_FRAME_BYTES
from .errors import WorkerRpcError


def encode_frame(obj: Any, max_frame_bytes: int = DEFAULT_MAX_FRAME_BYTES) -> str:
    """Serialize one protocol frame (single UTF-8 JSON line). Raises WorkerRpcError if oversized."""
    line = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    size = len(line.encode("utf-8"))
    if size > max_frame_bytes:
        raise WorkerRpcError("payload.oversize", f"frame exceeds maximum size ({size} > {max_frame_bytes})")
    return line


def write_frame(stream: Any, obj: Any, max_frame_bytes: int = DEFAULT_MAX_FRAME_BYTES) -> None:
    """Write one protocol frame to a stdout-like stream (protocol channel only)."""
    line = encode_frame(obj, max_frame_bytes)
    stream.write(line)
    stream.write("\n")
    stream.flush()


def log_stderr(message: str) -> None:
    """Write a diagnostic line to stderr (never stdout)."""
    try:
        sys.stderr.write(message.rstrip("\n") + "\n")
        sys.stderr.flush()
    except Exception:
        pass


def parse_line(line: str) -> Optional[Any]:
    """Parse one JSONL line. Returns None for malformed JSON (caller logs + skips)."""
    if not line.strip():
        return None
    try:
        return json.loads(line)
    except json.JSONDecodeError:
        return None
