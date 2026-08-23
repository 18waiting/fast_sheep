"""Shared dataclasses for the tool and sandbox subsystem."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class ToolDefinition:
    """Declarative skill/tool definition."""

    name: str
    description: str = ""
    skill_type: str = "instruction"
    body: str = ""
    run: Optional[Dict[str, Any]] = None
    signature: Optional[str] = None
    enabled: bool = True


@dataclass
class SandboxResult:
    """Result of a subprocess sandbox execution."""

    ok: bool = True
    returncode: int = 0
    stdout: str = ""
    stderr: str = ""
    timed_out: bool = False
    killed: bool = False
    error: Optional[str] = None
