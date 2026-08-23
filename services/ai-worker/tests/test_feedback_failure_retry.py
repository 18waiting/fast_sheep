import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Feedback failure/retry (M9): worker failure -> recoverable; retry idempotent."""
import unittest
from fastwork_ai_worker.feedback.knowledge_feedback_service import KnowledgeFeedbackService
from fastwork_ai_worker.feedback.types import FeedbackApplyRequest
from fastwork_ai_worker.persistence.in_memory import InMemoryKnowledgeRepository


class _FailingRepo:
    def __init__(self, inner):
        self.inner = inner
        self.fail = True
    def upsert(self, entry):
        if self.fail:
            raise RuntimeError("boom")
        self.inner.upsert(entry)
    def list(self, *a):
        return self.inner.list(*a)


class TestFailureRetry(unittest.TestCase):
    def test_failure_then_recover(self):
        inner = InMemoryKnowledgeRepository()
        repo = _FailingRepo(inner)
        svc = KnowledgeFeedbackService(repo)
        r1 = svc.apply(FeedbackApplyRequest(record_id="r1", class_name="AUTO", question="q", answer="a"))
        self.assertFalse(r1.ok)
        repo.fail = False
        r2 = svc.apply(FeedbackApplyRequest(record_id="r1", class_name="AUTO", question="q", answer="a"))
        self.assertTrue(r2.ok)
        # exactly one logical effect (idempotent)
        self.assertEqual(len(inner.list()), 1)

if __name__ == "__main__":
    unittest.main()
