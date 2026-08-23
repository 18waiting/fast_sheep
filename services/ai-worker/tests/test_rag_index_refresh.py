"""M3 index refresh tests: full / incremental / precise_delete primitives."""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

from fastwork_ai_worker.rag.index_refresh import IndexRefresh
from fastwork_ai_worker.rag.mock_embedding_provider import MockEmbeddingProvider
from rag_helpers import build_and_load, make_entry


class TestIndexRefresh(unittest.TestCase):
    def _provider(self, entries):
        mapping = {"query": {"type": "basis", "index": 0}}
        for i, e in enumerate(entries, start=1):
            mapping[e["question"]] = {"type": "cosine", "cosine": 0.7, "basis": i}
        return MockEmbeddingProvider(1024, mapping=mapping)

    def test_full_refresh(self):
        entries = [make_entry("e1", "q1", "a1", "P1"), make_entry("e2", "q2", "a2", "")]
        with tempfile.TemporaryDirectory() as root:
            repo = build_and_load(root, entries, self._provider(entries))
            refresh = IndexRefresh(repo, self._provider(entries))
            out = refresh.full(entries, root)
            self.assertTrue(out["ok"])
            self.assertEqual(out["mode"], "full")
            self.assertEqual(repo.status().global_count, 2)

    def test_incremental_refresh(self):
        entries = [make_entry("e1", "q1", "a1", "P1")]
        new_entries = entries + [make_entry("e2", "q2", "a2", "")]
        with tempfile.TemporaryDirectory() as root:
            repo = build_and_load(root, entries, self._provider(new_entries))
            refresh = IndexRefresh(repo, self._provider(new_entries))
            out = refresh.incremental(new_entries, root)
            self.assertTrue(out["ok"])
            self.assertEqual(repo.status().global_count, 2)

    def test_precise_delete(self):
        entries = [make_entry("e1", "q1", "a1", "P1"), make_entry("e2", "q2", "a2", "")]
        with tempfile.TemporaryDirectory() as root:
            repo = build_and_load(root, entries, self._provider(entries))
            refresh = IndexRefresh(repo, self._provider(entries))
            out = refresh.precise_delete(["e1"], entries, root)
            self.assertTrue(out["ok"])
            self.assertEqual(out["entry_count"], 1)
            self.assertEqual(repo.status().global_count, 1)


if __name__ == "__main__":
    unittest.main()
