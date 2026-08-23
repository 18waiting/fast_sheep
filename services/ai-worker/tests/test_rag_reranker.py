"""M3 reranker tests: skip rules, composite scoring, fallback, NO_CALL."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.rag.mock_rerank_provider import MockRerankProvider
from fastwork_ai_worker.rag.reranker import Reranker
from fastwork_ai_worker.rag.types import RerankCandidate, RawHit


def _hit(i, sim):
    return RawHit(entry_id="e%d" % i, question="q%d" % i, answer="a%d" % i, product_id="P1", source="s", tags=[], faiss_id=i, raw_similarity=sim, tier="product")


class TestReranker(unittest.TestCase):
    def test_skip_top_sim_high_no_call(self):
        cfg = {"rerank_high_similarity_skip": 0.85}
        call_log = []
        r = Reranker(MockRerankProvider(call_log=call_log), cfg, call_log=call_log)
        self.assertEqual(r.skip_decision(0.85, 4), {"rerank": False, "reason": "top_sim_high"})
        r.rerank("q", [RerankCandidate(hit=_hit(i, 0.9)) for i in range(4)])
        self.assertEqual(len([c for c in call_log if c[0] == "rerank"]), 0)

    def test_skip_few_candidates_no_call(self):
        cfg = {"rerank_skip_candidate_count": 3}
        call_log = []
        r = Reranker(MockRerankProvider(call_log=call_log), cfg, call_log=call_log)
        self.assertEqual(r.skip_decision(0.5, 3), {"rerank": False, "reason": "few_candidates"})
        r.rerank("q", [RerankCandidate(hit=_hit(i, 0.5)) for i in range(3)])
        self.assertEqual(len([c for c in call_log if c[0] == "rerank"]), 0)

    def test_rerank_runs_with_4_candidates_below_085(self):
        cfg = {"rerank_skip_candidate_count": 3, "rerank_high_similarity_skip": 0.85}
        call_log = []
        r = Reranker(MockRerankProvider(scores={0: 0.9, 1: 0.8, 2: 0.7, 3: 0.6}, call_log=call_log), cfg, call_log=call_log)
        self.assertEqual(r.skip_decision(0.84, 4), {"rerank": True})
        out = r.rerank("q", [RerankCandidate(hit=_hit(i, 0.84 - 0.01 * i)) for i in range(4)])
        self.assertEqual(len([c for c in call_log if c[0] == "rerank"]), 1)

    def test_composite_base(self):
        r = Reranker(None, {"similarity_weight": 0.4, "rerank_weight": 0.6})
        self.assertAlmostEqual(r.composite_score(0.5, 0.7), 0.62, places=6)

    def test_composite_raw_protection(self):
        r = Reranker(None, {"similarity_weight": 0.4, "rerank_weight": 0.6, "raw_protection_threshold": 0.7})
        self.assertAlmostEqual(r.composite_score(0.7, 0.5), 0.65, places=6)

    def test_composite_low_rerank_penalty(self):
        r = Reranker(None, {"similarity_weight": 0.4, "rerank_weight": 0.6, "low_rerank_penalty": 0.1})
        self.assertAlmostEqual(r.composite_score(0.6, 0.099), 0.23952, places=6)

    def test_composite_clamp(self):
        r = Reranker(None, {"similarity_weight": 0.4, "rerank_weight": 0.6, "composite_clamp": 1.0})
        self.assertEqual(r.composite_score(0.99, 0.99), 1.0)

    def test_rerank_failure_fallback(self):
        cfg = {"rerank_skip_candidate_count": 3, "rerank_high_similarity_skip": 0.85}
        call_log = []
        provider = MockRerankProvider(call_log=call_log)
        provider.set_error("timeout")
        r = Reranker(provider, cfg, call_log=call_log)
        out = r.rerank("q", [RerankCandidate(hit=_hit(i, 0.8 - 0.01 * i)) for i in range(4)])
        self.assertEqual(len(out), 4)
        self.assertEqual(len([c for c in call_log if c[0] == "rerank_fallback"]), 1)


if __name__ == "__main__":
    unittest.main()
