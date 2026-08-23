"""M4 provider fallback tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.providers.provider_router import ProviderRouter
from fastwork_ai_worker.providers.credential_resolver import CredentialResolver, FakeSecretStore


def router(config=None, missing=False):
    store = FakeSecretStore(missing=missing)
    return ProviderRouter(config=config, credential_resolver=CredentialResolver(store))


class TestFallback(unittest.TestCase):
    def test_doubao_unavailable_falls_back_to_siliconflow(self):
        r = router(config={"provider": {"doubao": {"error": "unavailable"}}})
        route = r.route({"mode": "快答专家", "daily_count": 100})
        self.assertIsNone(route["error"])
        self.assertEqual(route["fallback"], "doubao->siliconflow")
        self.assertEqual(route["provider"], "siliconflow")
        self.assertEqual(route["model"], "deepseek-ai/DeepSeek-V3")
        self.assertEqual(r.route_decision({"mode": "快答专家", "daily_count": 100}), [{"fallback": "doubao->siliconflow"}])

    def test_fallback_trace_records_reason(self):
        r = router(config={"provider": {"doubao": {"error": "unavailable"}}})
        route = r.route({"mode": "快答专家", "daily_count": 100})
        self.assertEqual(route["trace"][0]["fallback_reason"], "doubao unavailable")

    def test_missing_fallback_credential_is_credentials_error(self):
        r = router(config={"provider": {"doubao": {"error": "unavailable"}}}, missing=True)
        route = r.route({"mode": "快答专家", "daily_count": 100})
        self.assertEqual(route["error"]["category"], "credentials")

    def test_high_daily_siliconflow_does_not_fallback(self):
        r = router(config={"provider": {"doubao": {"error": "unavailable"}}})
        decision = r.route_decision({"mode": "快答专家", "daily_count": 40000})
        self.assertEqual(decision, [{"provider": "siliconflow", "model": "Qwen/Qwen2.5-Coder-7B-Instruct"}])


if __name__ == "__main__":
    unittest.main()