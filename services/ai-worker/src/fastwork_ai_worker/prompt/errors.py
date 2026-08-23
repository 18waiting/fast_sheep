"""Normalized prompt-assembly errors (TASK-019 M4).

Codes map externally to normalized RPC/validation envelopes. No raw tracebacks
or provider data ever reach public responses.
"""
from __future__ import annotations


class PromptError(Exception):
    def __init__(self, code: str, message: str, category: str = "prompt", retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.category = category
        self.retryable = retryable
        self.message = message

    def to_rpc_error(self) -> dict:
        return {
            "code": self.code,
            "category": self.category,
            "message": self.message,
            "retryable": self.retryable,
        }


CODE_INVALID_CONFIG = "prompt.invalid_config"
CODE_INVALID_BUDGET = "prompt.invalid_budget"
CODE_ASSEMBLY_FAILED = "prompt.assembly_failed"


def invalid_config(detail: str = "invalid prompt configuration") -> PromptError:
    return PromptError(CODE_INVALID_CONFIG, detail, category="validation", retryable=False)


def invalid_budget(detail: str = "invalid prompt budget") -> PromptError:
    return PromptError(CODE_INVALID_BUDGET, detail, category="validation", retryable=False)


def assembly_failed(detail: str = "prompt assembly failed") -> PromptError:
    return PromptError(CODE_ASSEMBLY_FAILED, detail, category="internal", retryable=True)
