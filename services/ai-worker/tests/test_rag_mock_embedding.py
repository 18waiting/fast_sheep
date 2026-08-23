"""M3 mock embedding provider tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import numpy as np

from fastwork_ai_worker.rag.errors import RagError
from fastwork_ai_worker.rag.mock_embedding_provider import MockEmbeddingProvider
from fastwork_ai_worker.rag.vector_math import cosine


class TestMockEmbedding(unittest.TestCase):
    def test_basis_vector_shape_and_norm(self):
        p = MockEmbeddingProvider(dimension=1024)
        v = p.basis(0)
        self.assertEqual(v.shape, (1024,))
        self.assertAlmostEqual(float(np.linalg.norm(v)), 1.0, places=6)

    def test_cosine_vector_exact(self):
        p = MockEmbeddingProvider(dimension=1024)
        q = p.basis(0)
        v = p.cosine_vector(0.8, 1)
        self.assertAlmostEqual(cosine(q, v), 0.8, places=6)

    def test_embed_mapping(self):
        p = MockEmbeddingProvider(
            dimension=1024,
            mapping={"q": {"type": "basis", "index": 0}, "e": {"type": "cosine", "cosine": 0.7, "basis": 1}},
        )
        out = p.embed(["q", "e"])
        self.assertEqual(len(out), 2)
        self.assertAlmostEqual(cosine(out[0], out[1]), 0.7, places=6)

    def test_failure_injection(self):
        p = MockEmbeddingProvider(dimension=1024, mapping={"q": {"type": "basis", "index": 0}})
        p.set_error("provider_unavailable")
        with self.assertRaises(RagError) as ctx:
            p.embed(["q"])
        self.assertEqual(ctx.exception.code, "rag.embedding_failed")


if __name__ == "__main__":
    unittest.main()
