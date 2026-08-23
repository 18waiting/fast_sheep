import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Learning frequency analyzer (M10): gte threshold + singleton fallback."""
import unittest
from fastwork_ai_worker.learning.candidate_frequency import frequency_groups


class _Emb:
    def __init__(self, sims):
        self.sims = sims  # sims[i] = cosine of q_i to q0

    def embed(self, texts):
        out = []
        for i in range(len(texts)):
            if i == 0:
                out.append([1.0, 0.0])
            else:
                c = self.sims.get(i, 0.0)
                s = (1.0 - c * c) ** 0.5
                out.append([c, s])
        return out


class TestFrequency(unittest.TestCase):
    def test_gte_boundary_groups(self):
        # q1 at 0.9 -> same group; q2 at 0.85 -> separate -> 1 high-frequency group
        r = frequency_groups(["a", "b", "c"], _Emb({1: 0.9, 2: 0.85}), 0.9)
        self.assertEqual(r["groups"], 1)
        self.assertEqual(r["members"], 2)
        self.assertEqual(r["threshold_operator"], "gte")

    def test_below_threshold_singletons(self):
        r = frequency_groups(["a", "b"], _Emb({1: 0.899}), 0.9)
        self.assertEqual(r["groups"], 2)


if __name__ == "__main__":
    unittest.main()
