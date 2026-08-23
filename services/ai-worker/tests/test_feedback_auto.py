import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""AUTO feedback (M9): append with AUTO trust."""
import unittest
from fastwork_ai_worker.feedback.knowledge_feedback_service import KnowledgeFeedbackService
from fastwork_ai_worker.feedback.types import FeedbackApplyRequest
from fastwork_ai_worker.persistence.in_memory import InMemoryKnowledgeRepository

class TestAuto(unittest.TestCase):
    def test_auto_append(self):
        repo = InMemoryKnowledgeRepository()
        svc = KnowledgeFeedbackService(repo)
        r = svc.apply(FeedbackApplyRequest(record_id="a1", class_name="AUTO", question="q", answer="a"))
        self.assertEqual(r.knowledge_op, "append")
        self.assertEqual(repo.list()[0]["trust_level"], "AUTO")

if __name__ == "__main__":
    unittest.main()
