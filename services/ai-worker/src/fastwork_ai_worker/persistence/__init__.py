"""Clean-room persistence layer for the AI worker (M1).

Clean-room implementation. Derived only from public/project behavioral
specifications and frozen contracts. The worker owns the knowledge aggregates
(knowledge_entries, knowledge_candidates) and NEVER runs authoritative
migrations — it verifies the database schema version before writing.
"""
from .database import open_worker_db, resolve_data_root
from .schema import worker_schema_version, SUPPORTED_DB_SCHEMA_VERSION, is_schema_supported
from .errors import PersistenceError, ERROR_CODES
from .knowledge_repository import KnowledgeRepository
from .knowledge_candidate_repository import KnowledgeCandidateRepository
from .in_memory import InMemoryKnowledgeRepository, InMemoryKnowledgeCandidateRepository

__all__ = [
    "open_worker_db",
    "resolve_data_root",
    "worker_schema_version",
    "SUPPORTED_DB_SCHEMA_VERSION",
    "is_schema_supported",
    "PersistenceError",
    "ERROR_CODES",
    "KnowledgeRepository",
    "KnowledgeCandidateRepository",
    "InMemoryKnowledgeRepository",
    "InMemoryKnowledgeCandidateRepository",
]
