"""System, RAG, and test-only method registrars for the M2/M3 RPC worker."""
from .system import SystemMethods
from .rag import RagMethods
from .test_only import TestOnlyMethods

__all__ = ["SystemMethods", "RagMethods", "TestOnlyMethods"]
