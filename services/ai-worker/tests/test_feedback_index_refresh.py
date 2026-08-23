import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Index refresh (M9): incremental for correction/audit, deferred for restore."""
import unittest
from fastwork_ai_worker.feedback.knowledge_feedback_service import KnowledgeFeedbackService
from fastwork_ai_worker.feedback.index_refresh_port import RecordingIndexRefreshPort
from fastwork_ai_worker.feedback.types import FeedbackApplyRequest
from fastwork_ai_worker.persistence.in_memory import InMemoryKnowledgeRepository

class TestIndexRefresh(unittest.TestCase):
    def test_correction_incremental(self):
        idx = RecordingIndexRefreshPort()
        svc = KnowledgeFeedbackService(InMemoryKnowledgeRepository(), idx)
        svc.apply(FeedbackApplyRequest(record_id="c1", class_name="CORRECTION", question="q", answer="a"))
        self.assertIn(("refresh", "incremental"), idx.calls)

    def test_restore_deferred(self):
        idx = RecordingIndexRefreshPort()
        svc = KnowledgeFeedbackService(InMemoryKnowledgeRepository(), idx)
        svc.apply(FeedbackApplyRequest(record_id="r1", class_name="RESTORE", question="q", answer="a"))
        self.assertIn(("mark_rebuild", None), idx.calls)

if __name__ == "__main__":
    unittest.main()
