import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""NO_SAVE feedback (M9): zero knowledge mutation + zero worker calls."""
import unittest
from fastwork_ai_worker.feedback.knowledge_feedback_service import KnowledgeFeedbackService
from fastwork_ai_worker.feedback.index_refresh_port import RecordingIndexRefreshPort
from fastwork_ai_worker.feedback.types import FeedbackApplyRequest
from fastwork_ai_worker.persistence.in_memory import InMemoryKnowledgeRepository

class TestNoSave(unittest.TestCase):
    def test_no_save_zero(self):
        repo = InMemoryKnowledgeRepository()
        idx = RecordingIndexRefreshPort()
        svc = KnowledgeFeedbackService(repo, idx)
        r = svc.apply(FeedbackApplyRequest(record_id="n1", class_name="NO_SAVE", question="q", answer="a"))
        self.assertEqual(r.knowledge_op, "none")
        self.assertEqual(len(repo.list()), 0)
        self.assertEqual(len(idx.calls), 0)

if __name__ == "__main__":
    unittest.main()
