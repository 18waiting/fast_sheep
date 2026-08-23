import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""M5: duplicate-cache hit/expiry (GF-CONV-002/014)."""
from fastwork_ai_worker.conversation.duplicate_cache import DuplicateCache
from fastwork_ai_worker.conversation.test_doubles import FakeClock


class TestDuplicateCache(unittest.TestCase):
    def test_hit(self):
        clock = FakeClock()
        c = DuplicateCache(clock=clock, ttl_ms=60000)
        c.put("k", "cached")
        r = c.check("k")
        self.assertTrue(r["hit"])
        self.assertEqual(r["reply"], "cached")

    def test_miss(self):
        c = DuplicateCache(clock=FakeClock(), ttl_ms=60000)
        r = c.check("nope")
        self.assertFalse(r["hit"])
        self.assertFalse(r["expired"])

    def test_expiry(self):
        clock = FakeClock()
        c = DuplicateCache(clock=clock, ttl_ms=60000)
        c.put("k", "old")
        clock.advance(60001)
        r = c.check("k")
        self.assertFalse(r["hit"])
        self.assertTrue(r["expired"])


if __name__ == "__main__":
    unittest.main()
