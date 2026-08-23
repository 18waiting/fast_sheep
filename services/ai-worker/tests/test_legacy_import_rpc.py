import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Legacy import RPC (M11): narrow knowledge methods only."""
import unittest
from fastwork_ai_worker.rpc.server import RpcServer


class TestLegacyImportRpc(unittest.TestCase):
    def setUp(self):
        self.dispatcher = RpcServer()._dispatcher

    def test_methods_registered(self):
        for m in ("legacy_import.validate_knowledge", "legacy_import.apply_knowledge", "legacy_import.verify_knowledge"):
            self.assertTrue(self.dispatcher.has(m), m)

    def test_no_filesystem_browsing_rpc(self):
        names = self.dispatcher.names()
        self.assertFalse(any("browse" in n or "list_dir" in n or "filesystem" in n for n in names))


if __name__ == "__main__":
    unittest.main()
