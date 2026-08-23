import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Platform policy (M9): xianyu skip + capability gate."""
import unittest
from fastwork_ai_worker.handoff.platform_policy import is_xianyu_agent, platform_transfer_allowed

class TestPlatformPolicy(unittest.TestCase):
    def test_xianyu_agent(self):
        self.assertTrue(is_xianyu_agent("闲鱼-小店"))
        self.assertFalse(is_xianyu_agent("pdd-客服"))

    def test_capability_gate(self):
        self.assertFalse(platform_transfer_allowed("xianyu", {}))
        self.assertTrue(platform_transfer_allowed("pdd", {}))
        self.assertFalse(platform_transfer_allowed("doudian", {"transfer": False}))

if __name__ == "__main__":
    unittest.main()
