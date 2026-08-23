"""M3 retriever tests: tier order, quality threshold boundary, product isolation."""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

from fastwork_ai_worker.rag.mock_embedding_provider import MockEmbeddingProvider
from fastwork_ai_worker.rag.retriever import Retriever
from rag_helpers import build_and_load, make_entry


def _provider_for(mapping):
    return MockEmbeddingProvider(1024, mapping=mapping)


class TestRetriever(unittest.TestCase):
    def _retrieve(self, entries, mapping, product_id="P1", config=None):
        with tempfile.TemporaryDirectory() as root:
            repo = build_and_load(root, entries, _provider_for(mapping), config=config or {})
            q = _provider_for(mapping).embed_one("query")
            return Retriever(repo, config or {}).retrieve(q, product_id, 5, knowledge_isolation=(config or {}).get("product_isolation"))

    def test_tier_order_common_first(self):
        entries = [
            make_entry("c1", "c-q", "c-a", "1"),
            make_entry("p1", "p-q", "p-a", "P1"),
            make_entry("g1", "g-q", "g-a", ""),
        ]
        mapping = {
            "query": {"type": "basis", "index": 0},
            "c-q": {"type": "cosine", "cosine": 0.8, "basis": 1},
            "p-q": {"type": "cosine", "cosine": 0.7, "basis": 2},
            "g-q": {"type": "cosine", "cosine": 0.6, "basis": 3},
        }
        tr = self._retrieve(entries, mapping)
        self.assertEqual(tr.tier_used, "common")
        self.assertEqual(tr.decisions, [
            {"tier": "common", "used": True},
            {"tier": "product", "used": False},
            {"tier": "global", "used": False},
        ])

    def test_tier_product_then_global_fill(self):
        entries = [
            make_entry("p1", "p-q", "p-a", "P1"),
            make_entry("g1", "g-q", "g-a", ""),
        ]
        mapping = {
            "query": {"type": "basis", "index": 0},
            "p-q": {"type": "cosine", "cosine": 0.75, "basis": 1},
            "g-q": {"type": "cosine", "cosine": 0.6, "basis": 2},
        }
        tr = self._retrieve(entries, mapping)
        self.assertEqual(tr.decisions, [
            {"tier": "common", "used": False},
            {"tier": "product", "used": True},
            {"tier": "global", "used": True},
        ])

    def test_quality_threshold_boundary(self):
        r = Retriever(None, {"product_quality_threshold": 0.6})  # type: ignore[arg-type]
        self.assertEqual(r.quality_decision(0.599), [{"product_used": False, "reason": "below_quality_threshold"}])
        self.assertEqual(r.quality_decision(0.6), [{"product_used": True, "operator": "gte"}])
        self.assertEqual(r.quality_decision(0.61), [{"product_used": True}])

    def test_product_isolation_disables_global(self):
        entries = [make_entry("p1", "p-q", "p-a", "P1")]
        mapping = {
            "query": {"type": "basis", "index": 0},
            "p-q": {"type": "cosine", "cosine": 0.5, "basis": 1},
        }
        tr = self._retrieve(entries, mapping, config={"product_isolation": True})
        self.assertEqual(tr.decisions, [{"tier": "global", "used": False, "reason": "product_isolation"}])

    def test_global_fill_last(self):
        entries = [make_entry("g1", "g-q", "g-a", "")]
        mapping = {
            "query": {"type": "basis", "index": 0},
            "g-q": {"type": "cosine", "cosine": 0.55, "basis": 1},
        }
        tr = self._retrieve(entries, mapping, product_id="P1")
        self.assertEqual(tr.decisions, [{"tier": "global", "used": True, "fill": True}])


if __name__ == "__main__":
    unittest.main()
