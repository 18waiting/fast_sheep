import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Learning commit policy (M10): PENDING_REVIEW unless auto_commit authorized."""
import unittest
from fastwork_ai_worker.learning.commit_policy import commit_policy


class TestCommitPolicy(unittest.TestCase):
    def test_default_pending(self):
        p = commit_policy({})
        self.assertEqual(p["auto_commit"], False)
        self.assertEqual(p["commit_to"], "PENDING_REVIEW")

    def test_auto_commit_target(self):
        p = commit_policy({"auto_commit": True})
        self.assertEqual(p["auto_commit"], True)
        self.assertEqual(p["commit_to"], "B库人工确认过")


if __name__ == "__main__":
    unittest.main()
