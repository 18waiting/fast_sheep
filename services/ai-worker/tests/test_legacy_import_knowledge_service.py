import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Legacy knowledge import service (M11)."""
import unittest
from fastwork_ai_worker.legacy_import.knowledge_import_service import KnowledgeImportService
from fastwork_ai_worker.persistence.in_memory import InMemoryKnowledgeRepository, InMemoryKnowledgeCandidateRepository


class TestKnowledgeService(unittest.TestCase):
    def setUp(self):
        self.knowledge = InMemoryKnowledgeRepository()
        self.candidates = InMemoryKnowledgeCandidateRepository()

    def test_apply_a_library_auto(self):
        svc = KnowledgeImportService(self.knowledge, self.candidates)
        result = svc.apply("sel", "it", [{"question": "q", "answer": "a", "product_id": "10001", "tags": []}], "A库")
        self.assertEqual(result.inserted, 1)
        self.assertEqual(len(self.knowledge.list()), 1)
        self.assertEqual(self.knowledge.list()[0]["trust_level"], "AUTO")

    def test_apply_pending_to_candidates(self):
        svc = KnowledgeImportService(self.knowledge, self.candidates)
        result = svc.apply("sel", "it", [{"question": "q", "answer": "a", "product_id": "", "tags": []}], "待审核")
        self.assertEqual(result.candidates, 1)
        self.assertEqual(len(self.knowledge.list()), 0)

    def test_validate(self):
        svc = KnowledgeImportService(self.knowledge, self.candidates)
        r = svc.validate([{"question": "q", "answer": "a"}, {"question": "", "answer": ""}])
        self.assertEqual(r["ok"], False)
        self.assertEqual(r["rows"], 1)


if __name__ == "__main__":
    unittest.main()
