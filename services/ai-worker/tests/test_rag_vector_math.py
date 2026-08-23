"""M3 vector math tests: L2 normalization, cosine, dimension validation."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import numpy as np

from fastwork_ai_worker.rag.errors import RagError
from fastwork_ai_worker.rag.vector_math import cosine, inner_product, l2_normalize, validate_dimension


class TestVectorMath(unittest.TestCase):
    def test_l2_normalize_unit_norm(self):
        v = l2_normalize(np.array([3.0, 4.0], dtype=np.float32))
        self.assertAlmostEqual(float(np.linalg.norm(v)), 1.0, places=6)

    def test_l2_normalize_zero_vector_unchanged(self):
        z = np.zeros(4, dtype=np.float32)
        self.assertTrue(np.allclose(l2_normalize(z), z))

    def test_cosine_after_l2_equals_inner_product(self):
        a = np.array([1.0, 0.0, 0.0], dtype=np.float32)
        b = np.array([0.6, 0.8, 0.0], dtype=np.float32)
        self.assertAlmostEqual(cosine(a, b), inner_product(l2_normalize(a), l2_normalize(b)), places=6)
        self.assertAlmostEqual(cosine(a, b), 0.6, places=6)

    def test_dimension_validation(self):
        validate_dimension(np.zeros(1024, dtype=np.float32), 1024)
        with self.assertRaises(RagError) as ctx:
            validate_dimension(np.zeros(10, dtype=np.float32), 1024)
        self.assertEqual(ctx.exception.code, "rag.invalid_dimension")


if __name__ == "__main__":
    unittest.main()
