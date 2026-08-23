import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""KnowledgeFeedbackService (M9): apply + idempotent + single-writer."""
import unittest
from fastwork_ai_worker.feedback.knowledge_feedback_service import KnowledgeFeedbackService
from fastwork_ai_worker.feedback.index_refresh_port import RecordingIndexRefreshPort
from fastwork_ai_worker.feedback.types import FeedbackApplyRequest
from fastwork_ai_worker.persistence.in_memory import InMemoryKnowledgeRepository

def req(cls, **kw):
    return FeedbackApplyRequest(record_id="r1", conversation_id="c1", class_name=cls, question="q", answer="a", product_id="1", **kw)

class TestKnowledgeFeedbackService(unittest.TestCase):
    def test_manual_append(self):
        repo = InMemoryKnowledgeRepository()
        svc = KnowledgeFeedbackService(repo, RecordingIndexRefreshPort())
        r = svc.apply(req("MANUAL"))
        self.assertTrue(r.ok)
        self.assertEqual(r.knowledge_op, "append")
        self.assertEqual(len(repo.list()), 1)

    def test_no_save_zero(self):
        repo = InMemoryKnowledgeRepository()
        idx = RecordingIndexRefreshPort()
        svc = KnowledgeFeedbackService(repo, idx)
        r = svc.apply(req("NO_SAVE"))
        self.assertTrue(r.ok)
        self.assertEqual(r.knowledge_op, "none")
        self.assertEqual(len(repo.list()), 0)
        self.assertEqual(len(idx.calls), 0)

    def test_idempotent_same_record(self):
        repo = InMemoryKnowledgeRepository()
        svc = KnowledgeFeedbackService(repo, RecordingIndexRefreshPort())
        svc.apply(req("AUTO"))
        svc.apply(req("AUTO"))
        self.assertEqual(len(repo.list()), 1)

if __name__ == "__main__":
    unittest.main()
