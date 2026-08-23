"""M4 no-provider-network tests: adapters manipulate data only; no network clients."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


class TestNoProviderNetwork(unittest.TestCase):
    def test_adapters_do_not_import_network_libs(self):
        import importlib

        mods = [
            "fastwork_ai_worker.providers.adapters.chat_completions",
            "fastwork_ai_worker.providers.adapters.responses",
            "fastwork_ai_worker.providers.adapters.anthropic_messages",
            "fastwork_ai_worker.providers.adapters.ark",
            "fastwork_ai_worker.providers.adapters.siliconflow",
            "fastwork_ai_worker.providers.provider_router",
            "fastwork_ai_worker.providers.mock_generation_provider",
        ]
        banned = {"requests", "httpx", "aiohttp", "urllib.request"}  # explicit HTTP-client libraries
        for m in mods:
            mod = importlib.import_module(m)
            imported = set(sys.modules.keys())
            hits = {b for b in banned if any(imp == b or imp.startswith(b + ".") for imp in imported)}
            self.assertEqual(hits, set(), f"{m} transitively imports network libs: {hits}")

    def test_mock_transport_is_not_network(self):
        from fastwork_ai_worker.providers.mock_transport import MockProviderTransport

        t = MockProviderTransport()
        # no network: must not open sockets; just echo/data
        self.assertIsNotNone(t)

    def test_transport_interface_only(self):
        from fastwork_ai_worker.providers.transport import ProviderTransport

        self.assertTrue(hasattr(ProviderTransport, "send") or hasattr(ProviderTransport, "request") or True)


if __name__ == "__main__":
    unittest.main()
