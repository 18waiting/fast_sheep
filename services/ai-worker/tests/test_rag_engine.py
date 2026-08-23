"""M3 RAGEngine tests: end-to-end RetrievalResult, fast return, embedding failure."""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

from fastwork_ai_worker.rag.errors import RagError
from fastwork_ai_worker.rag.index_repository import IndexRepository
from fastwork_ai_worker.rag.mock_embedding_provider import MockEmbeddingProvider
from fastwork_ai_worker.rag.rag_engine import RAGEngine
from rag_helpers import build_and_load, make_entry


class TestRAGEngine(unittest.TestCase):
    def _engine(self, root, entries, mapping, provider=None):
        provider = provider or MockEmbeddingProvider(1024, mapping=mapping)
        repo = build_and_load(root, entries, provider)
        return RAGEngine(repo, provider, rerank_provider=None)

    def test_retrieve_result_shape(self):
        entries = [
            make_entry("c1", "这个多少钱", "99元", "1"),
            make_entry("p1", "有货吗", "有", "P1"),
        ]
        mapping = {
            "query": {"type": "basis", "index": 0},
            "这个多少钱": {"type": "cosine", "cosine": 0.8, "basis": 1},
            "有货吗": {"type": "cosine", "cosine": 0.7, "basis": 2},
        }
        with tempfile.TemporaryDirectory() as root:
            engine = self._engine(root, entries, mapping)
            result = engine.retrieve({"query": "query", "product_id": "P1"})
            self.assertIn("query", result)
            self.assertIn("hits", result)
            self.assertIn("fast_return", result)
            self.assertIn("tier_used", result)
            for h in result["hits"]:
                self.assertIn("question", h)
                self.assertIn("answer", h)
                self.assertIn("source", h)
                self.assertIn("raw_similarity", h)
                self.assertIn("composite", h)
            self.assertFalse(result["fast_return"])

    def test_fast_return_short_circuit(self):
        entries = [make_entry("p1", "这个多少钱", "99元", "P1")]
        mapping = {"query": {"type": "basis", "index": 0}, "这个多少钱": {"type": "cosine", "cosine": 0.95, "basis": 1}}
        with tempfile.TemporaryDirectory() as root:
            engine = self._engine(root, entries, mapping)
            result = engine.retrieve({"query": "query", "product_id": "P1"})
            self.assertTrue(result["fast_return"])
            self.assertEqual(len(result["hits"]), 1)

    def test_embedding_failure_normalized(self):
        entries = [make_entry("p1", "q", "a", "P1")]
        mapping = {"query": {"type": "basis", "index": 0}, "q": {"type": "cosine", "cosine": 0.9, "basis": 1}}
        provider = MockEmbeddingProvider(1024, mapping=mapping)
        provider.set_error("provider_unavailable")
        with tempfile.TemporaryDirectory() as root:
            repo = build_and_load(root, entries, MockEmbeddingProvider(1024, mapping=mapping))
            engine = RAGEngine(repo, provider, rerank_provider=None)
            with self.assertRaises(RagError) as ctx:
                engine.retrieve({"query": "query", "product_id": "P1"})
            self.assertEqual(ctx.exception.code, "rag.embedding_failed")
            self.assertTrue(ctx.exception.retryable)

    def test_index_not_ready(self):
        provider = MockEmbeddingProvider(1024, mapping={"query": {"type": "basis", "index": 0}})
        with tempfile.TemporaryDirectory() as root:
            repo = IndexRepository(root)
            engine = RAGEngine(repo, provider, rerank_provider=None)
            with self.assertRaises(RagError) as ctx:
                engine.retrieve({"query": "query", "product_id": "P1"})
            self.assertEqual(ctx.exception.code, "rag.index_not_ready")


if __name__ == "__main__":
    unittest.main()
