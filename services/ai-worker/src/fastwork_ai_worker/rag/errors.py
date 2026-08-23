"""Normalized RAG errors (TASK-018 M3).

Codes map externally to normalized RPC/retrieval error envelopes. No raw
faiss/sqlite/numpy exceptions or tracebacks ever reach public responses.
"""
from __future__ import annotations


class RagError(Exception):
    def __init__(self, code: str, message: str, category: str = "retrieval", retryable: bool = False):
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


CODE_EMBEDDING_FAILED = "rag.embedding_failed"
CODE_INDEX_NOT_READY = "rag.index_not_ready"
CODE_INVALID_DIMENSION = "rag.invalid_dimension"
CODE_INDEX_CORRUPT = "rag.index_corrupt"
CODE_RERANK_FAILED = "rag.rerank_failed"
CODE_INVALID_REQUEST = "rag.invalid_request"


def embedding_failed(detail: str = "embedding provider failed") -> RagError:
    return RagError(CODE_EMBEDDING_FAILED, detail, category="retrieval", retryable=True)


def index_not_ready(detail: str = "derived index is not ready") -> RagError:
    return RagError(CODE_INDEX_NOT_READY, detail, category="internal", retryable=True)


def invalid_dimension(detail: str = "invalid embedding dimension") -> RagError:
    return RagError(CODE_INVALID_DIMENSION, detail, category="validation", retryable=False)


def index_corrupt(detail: str = "derived index is corrupt") -> RagError:
    return RagError(CODE_INDEX_CORRUPT, detail, category="internal", retryable=True)


def rerank_failed(detail: str = "rerank provider failed") -> RagError:
    return RagError(CODE_RERANK_FAILED, detail, category="internal", retryable=True)


def invalid_request(detail: str = "invalid retrieval request") -> RagError:
    return RagError(CODE_INVALID_REQUEST, detail, category="validation", retryable=False)
