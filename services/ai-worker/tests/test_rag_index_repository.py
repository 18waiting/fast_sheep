"""M3 FAISS index repository tests: structure, search, mapping, cache, status."""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

import faiss
import numpy as np

from fastwork_ai_worker.rag.index_builder import IndexBuilder
from fastwork_ai_worker.rag.index_repository import IndexRepository
from fastwork_ai_worker.rag.mock_embedding_provider import MockEmbeddingProvider
from rag_helpers import build_and_load, make_entry


def _fixture_entries():
    return [
        make_entry("e1", "这个多少钱", "99元", "1"),
        make_entry("e2", "有货吗", "有", "P1"),
        make_entry("e3", "发货多久", "48小时", ""),
    ]


def _provider():
    return MockEmbeddingProvider(
        1024,
        mapping={
            "这个多少钱": {"type": "basis", "index": 0},
            "有货吗": {"type": "cosine", "cosine": 0.7, "basis": 1},
            "发货多久": {"type": "cosine", "cosine": 0.6, "basis": 2},
        },
    )


class TestIndexRepository(unittest.TestCase):
    def test_faiss_structure_indexidmap2_indexflatip(self):
        with tempfile.TemporaryDirectory() as root:
            repo = build_and_load(root, _fixture_entries(), _provider())
            gi = repo.ensure_global()
            self.assertIsInstance(gi, faiss.IndexIDMap2)
            inner = faiss.downcast_index(gi.index)
            self.assertIsInstance(inner, faiss.IndexFlatIP)
            self.assertEqual(gi.d, 1024)

    def test_cosine_after_l2_inner_product(self):
        with tempfile.TemporaryDirectory() as root:
            repo = build_and_load(root, _fixture_entries(), _provider())
            q = _provider().embed_one("这个多少钱")
            pairs = repo.search("global", q, 3)
            scores = [s for _, s in pairs]
            self.assertGreater(max(scores), 0.99)  # exact basis match
            self.assertAlmostEqual(max(scores), 1.0, places=4)

    def test_mapping_resolves_entry(self):
        with tempfile.TemporaryDirectory() as root:
            repo = build_and_load(root, _fixture_entries(), _provider())
            q = _provider().embed_one("这个多少钱")
            fid, score = repo.search("global", q, 1)[0]
            m = repo.resolve_entry("global", fid)
            self.assertEqual(m["entry_id"], "e1")

    def test_bounded_product_cache(self):
        with tempfile.TemporaryDirectory() as root:
            entries = _fixture_entries() + [
                make_entry("p%d" % i, "q%d" % i, "a%d" % i, "PX%d" % i) for i in range(30)
            ]
            mapping = {
                "这个多少钱": {"type": "basis", "index": 0},
                "有货吗": {"type": "cosine", "cosine": 0.7, "basis": 1},
                "发货多久": {"type": "cosine", "cosine": 0.6, "basis": 2},
            }
            for i in range(30):
                mapping["q%d" % i] = {"type": "cosine", "cosine": 0.5, "basis": 3 + i}
            provider = MockEmbeddingProvider(1024, mapping=mapping)
            repo = build_and_load(root, entries, provider, config={"index_cache_size": 4})
            for i in range(30):
                repo.ensure_product("PX%d" % i)
            self.assertLessEqual(len(repo._cache), 4)  # bounded LRU

    def test_status(self):
        with tempfile.TemporaryDirectory() as root:
            repo = build_and_load(root, _fixture_entries(), _provider())
            st = repo.status()
            self.assertTrue(st.ready)
            self.assertEqual(st.dimension, 1024)
            self.assertEqual(st.metric, "INNER_PRODUCT")
            self.assertEqual(st.global_count, 3)
            self.assertEqual(st.common_count, 1)
            self.assertEqual(st.product_index_count, 1)


if __name__ == "__main__":
    unittest.main()
