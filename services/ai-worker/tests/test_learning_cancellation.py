import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Learning cancellation (M10): CANCELLED/FAILED + partial retention."""
import unittest
from fastwork_ai_worker.learning.learning_engine import LearningEngine


class _Pending:
    def __init__(self):
        self.rows = []

    def upsert(self, row):
        self.rows.append(row)


class _Gen:
    def __init__(self, error=False):
        self.error = error

    def generate(self, request):
        if self.error:
            return {"error": {"message": "provider_failure"}}
        return {}


class TestLearningCancellation(unittest.TestCase):
    def test_cancel_command(self):
        eng = LearningEngine()
        res = eng.run({"command": "cancel"})
        self.assertEqual(res["job_state"], "CANCELLED")
        self.assertTrue(res["partial_retained"])

    def test_provider_failure_failed(self):
        p = _Pending()
        eng = LearningEngine(pending_repo=p, generation_provider=_Gen(error=True))
        res = eng.run({"qa": [{"问题": "q", "答案": "a"}]})
        self.assertEqual(res["job_state"], "FAILED")
        self.assertTrue(res["partial_retained"])

    def test_is_cancelled_mid_run(self):
        p = _Pending()
        eng = LearningEngine(pending_repo=p, is_cancelled=lambda: True)
        res = eng.run({"qa": [{"问题": "q1", "答案": "a1"}, {"问题": "q2", "答案": "a2"}]})
        self.assertEqual(res["job_state"], "CANCELLED")
        self.assertTrue(res["partial_retained"])


if __name__ == "__main__":
    unittest.main()
