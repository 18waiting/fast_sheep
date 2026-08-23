import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""M5: question-completion port + mock."""
from fastwork_ai_worker.conversation.question_completion import MockQuestionCompletionPort, QuestionCompletionPort


class TestQuestionCompletion(unittest.TestCase):
    def test_port_default_identity(self):
        p = QuestionCompletionPort()
        self.assertEqual(p.complete("q"), "q")

    def test_mock_returns_completed(self):
        p = MockQuestionCompletionPort(completed_question="这件衣服多少钱")
        self.assertEqual(p.complete("这个衣服多少钱"), "这件衣服多少钱")


if __name__ == "__main__":
    unittest.main()
