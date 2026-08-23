"""Tool and sandbox subsystem for the clean-room AI worker (M4).

The tool engine is declarative and deterministic: a skill accepts structured
arguments and returns a structured result. User-provided script code is never
executed in-process; query skills run in a short-lived subprocess through
:mod:`fastwork_ai_worker.tools.sandbox.process_runner`.
"""
from . import errors, types  # noqa: F401

__all__ = ["errors", "types"]

