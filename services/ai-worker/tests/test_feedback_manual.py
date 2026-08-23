import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""MANUAL feedback (M9): append with HUMAN_CONFIRMED trust."""
import unittest
from fastwork_ai_worker.feedback.knowledge_feedback_service import KnowledgeFeedbackService
from fastwork_ai_worker.feedback.types import FeedbackApplyRequest
from fastwork_ai_worker.persistence.in_memory import InMemoryKnowledgeRepository

class TestManual(unittest.TestCase):
    def test_manual_append(self):
        repo = InMemoryKnowledgeRepository()
        svc = KnowledgeFeedbackService(repo)
        r = svc.apply(FeedbackApplyRequest(record_id="m1", class_name="MANUAL", question="q", answer="a"))
        self.assertEqual(r.knowledge_op, "append")
        self.assertEqual(repo.list()[0]["trust_level"], "HUMAN_CONFIRMED")

if __name__ == "__main__":
    unittest.main()
