"""Subprocess runner with timeout, capture and bounded output."""
from __future__ import annotations

import os
import subprocess
from typing import Iterable, List, Optional

from ..types import SandboxResult
from .environment import build_whitelist_env

_DEFAULT_OUTPUT_LIMIT = 65536

_DEFAULT_ENV_KEYS = (
    "SYSTEMROOT",
    "WINDIR",
    "PATH",
    "PATHEXT",
    "COMSPEC",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "HOME",
    "LANG",
    "LC_ALL",
)


def _truncate(text: str, limit: int = _DEFAULT_OUTPUT_LIMIT) -> str:
    if not text:
        return ""
    return text[:limit]


def run_process(
    argv: List[str],
    timeout_ms: int,
    env_whitelist: Optional[Iterable[str]] = None,
    workdir: Optional[str] = None,
) -> SandboxResult:
    """Run ``argv`` as a subprocess with no shell.

    stdout and stderr are captured as text and bounded. A timeout kills the
    child and returns ``SandboxResult(timed_out=True, killed=True,
    error="tool.timeout")``.
    """
    if isinstance(argv, str) or not isinstance(argv, (list, tuple)):
        raise TypeError("argv must be a list/tuple of arguments")

    timeout_s = max(0.001, float(timeout_ms) / 1000.0)
    if env_whitelist is None:
        env = build_whitelist_env(os.environ, _DEFAULT_ENV_KEYS)
    else:
        env = build_whitelist_env(os.environ, env_whitelist)

    try:
        completed = subprocess.run(
            list(argv),
            capture_output=True,
            text=True,
            timeout=timeout_s,
            env=env,
            cwd=workdir,
            shell=False,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        return SandboxResult(
            ok=False,
            returncode=-1,
            stdout=_truncate(exc.stdout or ""),
            stderr=_truncate(exc.stderr or ""),
            timed_out=True,
            killed=True,
            error="tool.timeout",
        )

    stdout = _truncate(completed.stdout or "")
    stderr = _truncate(completed.stderr or "")
    ok = completed.returncode == 0
    return SandboxResult(
        ok=ok,
        returncode=completed.returncode,
        stdout=stdout,
        stderr=stderr,
        timed_out=False,
        killed=False,
        error=None if ok else "tool.crashed",
    )

