"""Normalized conversation errors (TASK-020 M5)."""
from __future__ import annotations


class ConversationError(Exception):
    def __init__(self, code: str, message: str, category: str = "internal", retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.category = category
        self.retryable = retryable
        self.message = message

    def to_rpc_error(self) -> dict:
        return {"code": self.code, "category": self.category, "message": self.message, "retryable": self.retryable}


CODE_DUPLICATE = "conversation.duplicate"
CODE_EMBEDDING_FAILED = "rag.embedding_failed"
CODE_PROVIDER_FAILED = "provider.failed"
CODE_INVALID_REQUEST = "conversation.invalid_request"
