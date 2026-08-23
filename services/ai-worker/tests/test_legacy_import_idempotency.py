import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Legacy import idempotency (M11): repeated apply inserts zero duplicate rows."""
import unittest
from fastwork_ai_worker.legacy_import.knowledge_import_service import KnowledgeImportService
from fastwork_ai_worker.persistence.in_memory import InMemoryKnowledgeRepository, InMemoryKnowledgeCandidateRepository


class TestLegacyImportIdempotency(unittest.TestCase):
    def test_second_apply_duplicate_delta_zero(self):
        knowledge = InMemoryKnowledgeRepository()
        candidates = InMemoryKnowledgeCandidateRepository()
        svc = KnowledgeImportService(knowledge, candidates)
        rows = [{"question": "q", "answer": "a", "product_id": "10001", "tags": []}]
        first = svc.apply("sel", "it", rows, "A库")
        second = svc.apply("sel", "it", rows, "A库")
        self.assertEqual(first.inserted, 1)
        self.assertEqual(second.inserted, 0)
        self.assertEqual(second.skipped_duplicates, 1)
        self.assertEqual(len(knowledge.list()), 1)


if __name__ == "__main__":
    unittest.main()
