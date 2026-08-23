"""M3 index builder tests: classification, source revision, atomic build."""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

from fastwork_ai_worker.rag.index_builder import IndexBuilder, source_revision
from fastwork_ai_worker.rag.index_repository import IndexRepository
from fastwork_ai_worker.rag.mock_embedding_provider import MockEmbeddingProvider
from rag_helpers import make_entry


class TestIndexBuilder(unittest.TestCase):
    def _provider(self, entries):
        mapping = {}
        for i, e in enumerate(entries):
            mapping[e["question"]] = {"type": "cosine", "cosine": 0.5, "basis": i + 1}
        return MockEmbeddingProvider(1024, mapping=mapping)

    def test_build_global_common_products(self):
        entries = [
            make_entry("e1", "c-q", "c-a", "1"),
            make_entry("e2", "p-q", "p-a", "P1"),
            make_entry("e3", "g-q", "g-a", ""),
        ]
        with tempfile.TemporaryDirectory() as root:
            provider = self._provider(entries)
            b = IndexBuilder(provider, {})
            built = b.build_full(entries, root)
            repo = IndexRepository(root)
            repo.swap_in(built["staging"])
            st = repo.status()
            self.assertEqual(st.global_count, 3)
            self.assertEqual(st.common_count, 1)
            self.assertEqual(st.product_index_count, 1)

    def test_source_revision_deterministic(self):
        entries = [make_entry("e1", "q", "a", "1"), make_entry("e2", "q2", "a2", "P1")]
        self.assertEqual(source_revision(entries), source_revision(list(reversed(entries))))
        import copy

        changed = copy.deepcopy(entries)
        changed[0]["answer"] = "different"
        self.assertNotEqual(source_revision(entries), source_revision(changed))

    def test_dimension_mismatch_raises(self):
        entries = [make_entry("e1", "q", "a", "1")]
        provider = MockEmbeddingProvider(dimension=32, mapping={"q": {"type": "basis", "index": 0}})
        b = IndexBuilder(provider, {"embedding_dim": 1024})
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(Exception):
                b.build_full(entries, root)


if __name__ == "__main__":
    unittest.main()
