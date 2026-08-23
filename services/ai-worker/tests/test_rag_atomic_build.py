"""M3 atomic build tests: failure injection preserves old index; read during build."""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

from fastwork_ai_worker.rag.index_builder import IndexBuilder
from fastwork_ai_worker.rag.index_repository import IndexRepository
from fastwork_ai_worker.rag.mock_embedding_provider import MockEmbeddingProvider
from rag_helpers import build_and_load, make_entry


class TestAtomicBuild(unittest.TestCase):
    def _provider(self, entries, fail_on=None):
        mapping = {}
        for i, e in enumerate(entries):
            mapping[e["question"]] = {"type": "cosine", "cosine": 0.7, "basis": i + 1}
        p = MockEmbeddingProvider(1024, mapping=mapping)
        if fail_on:
            p.set_error(fail_on)
        return p

    def test_failed_build_preserves_old_index(self):
        entries = [make_entry("e1", "q1", "a1", "P1")]
        with tempfile.TemporaryDirectory() as root:
            repo = build_and_load(root, entries, self._provider(entries))
            old_count = repo.status().global_count
            # force a failure build (embedding error injection)
            bad = [make_entry("e2", "missing-text", "a2", "P1")]
            bad_provider = MockEmbeddingProvider(1024, mapping={"q1": {"type": "basis", "index": 0}, "missing-text": {"type": "basis", "index": 0}})
            bad_provider.set_error("provider_unavailable")
            builder = IndexBuilder(bad_provider, {})
            with self.assertRaises(Exception):
                builder.build_full(bad, root)
            # old index still active + valid
            repo.invalidate()
            self.assertEqual(repo.status().global_count, old_count)

    def test_read_during_build_uses_old_active_index(self):
        entries = [make_entry("e1", "q1", "a1", "P1")]
        with tempfile.TemporaryDirectory() as root:
            repo = build_and_load(root, entries, self._provider(entries))
            # begin a new build (staging only); old index remains readable
            new_entries = [make_entry("e1", "q1", "a1", "P1"), make_entry("e2", "q2", "a2", "P1")]
            builder = IndexBuilder(self._provider(new_entries), {})
            built = builder.build_full(new_entries, root)
            self.assertEqual(repo.status().global_count, 1)  # old still active
            repo.swap_in(built["staging"])
            self.assertEqual(repo.status().global_count, 2)  # new active after promote


if __name__ == "__main__":
    unittest.main()
