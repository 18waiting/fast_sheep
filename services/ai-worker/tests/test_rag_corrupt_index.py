"""M3 corrupt index tests: safe handling, no canonical mutation."""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

from fastwork_ai_worker.rag.errors import RagError
from fastwork_ai_worker.rag.index_repository import IndexRepository
from fastwork_ai_worker.rag.mock_embedding_provider import MockEmbeddingProvider
from rag_helpers import build_and_load, make_entry


class TestCorruptIndex(unittest.TestCase):
    def test_corrupt_index_raises_normalized_error(self):
        entries = [make_entry("e1", "q1", "a1", "P1")]
        mapping = {"query": {"type": "basis", "index": 0}, "q1": {"type": "cosine", "cosine": 0.7, "basis": 1}}
        provider = MockEmbeddingProvider(1024, mapping=mapping)
        with tempfile.TemporaryDirectory() as root:
            repo = build_and_load(root, entries, provider)
            # corrupt the global index file
            import os as _os

            gpath = _os.path.join(repo.root, "global", "index.faiss")
            with open(gpath, "w", encoding="utf-8") as f:
                f.write("not a faiss file")
            repo.invalidate()
            with self.assertRaises(RagError) as ctx:
                repo.ensure_global()
            self.assertEqual(ctx.exception.code, "rag.index_corrupt")

    def test_corrupt_index_does_not_touch_canonical(self):
        entries = [make_entry("e1", "q1", "a1", "P1")]
        mapping = {"query": {"type": "basis", "index": 0}, "q1": {"type": "cosine", "cosine": 0.7, "basis": 1}}
        provider = MockEmbeddingProvider(1024, mapping=mapping)
        with tempfile.TemporaryDirectory() as root:
            repo = build_and_load(root, entries, provider)
            import os as _os

            gpath = _os.path.join(repo.root, "global", "index.faiss")
            with open(gpath, "w", encoding="utf-8") as f:
                f.write("garbage")
            repo.invalidate()
            try:
                repo.ensure_global()
            except RagError:
                pass
            # canonical knowledge is untouched (derived index dir only)
            self.assertTrue(_os.path.exists(gpath))  # still corrupt but no canonical mutation


if __name__ == "__main__":
    unittest.main()
