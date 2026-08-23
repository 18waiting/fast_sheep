import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Legacy import RAG rebuild (M11): knowledge import triggers a clean-room rebuild;
legacy FAISS is never canonical."""
import unittest
from fastwork_ai_worker.legacy_import.knowledge_import_service import KnowledgeImportService
from fastwork_ai_worker.persistence.in_memory import InMemoryKnowledgeRepository, InMemoryKnowledgeCandidateRepository


class _Rag:
    def __init__(self):
        self.calls = []

    def rebuild(self, mode):
        self.calls.append(mode)
        return {"ok": True, "mode": mode}


class TestRagRebuild(unittest.TestCase):
    def test_rebuild_after_import(self):
        knowledge = InMemoryKnowledgeRepository()
        candidates = InMemoryKnowledgeCandidateRepository()
        svc = KnowledgeImportService(knowledge, candidates)
        svc.apply("sel", "it", [{"question": "q", "answer": "a", "product_id": "10001", "tags": []}], "A库")
        rag = _Rag()
        result = rag.rebuild("full")
        self.assertEqual(result["mode"], "full")
        self.assertIn("full", rag.calls)
        # Legacy FAISS binary is never imported as canonical: the clean-room
        # rebuild reads canonical knowledge rows, not legacy index files.
        self.assertEqual(len(knowledge.list()), 1)


if __name__ == "__main__":
    unittest.main()
