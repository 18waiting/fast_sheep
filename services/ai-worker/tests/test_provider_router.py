"""M4 ProviderRouter component tests (quick/X5/X10/custom/fallback)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.providers.provider_router import ProviderRouter
from fastwork_ai_worker.providers.credential_resolver import CredentialResolver, FakeSecretStore


def make_router(missing=False, config=None):
    store = FakeSecretStore(missing=missing)
    return ProviderRouter(config=config, credential_resolver=CredentialResolver(store))


class TestQuickTierBoundaries(unittest.TestCase):
    def test_daily_below_20000_uses_doubao(self):
        router = make_router()
        self.assertEqual(
            router.route_decision({"mode": "快答专家", "daily_count": 0}),
            [{"provider": "doubao", "model": "<fixture-doubao>"}],
        )
        self.assertEqual(
            router.route_decision({"mode": "快答专家", "daily_count": 19999}),
            [{"provider": "doubao", "model": "<fixture-doubao>"}],
        )

    def test_daily_20000_to_39999_uses_deepseek_v3(self):
        router = make_router()
        for daily in (20000, 35000, 39999):
            self.assertEqual(
                router.route_decision({"mode": "快答专家", "daily_count": daily}),
                [{"provider": "siliconflow", "model": "deepseek-ai/DeepSeek-V3"}],
            )

    def test_daily_40000_and_above_uses_qwen(self):
        router = make_router()
        for daily in (40000, 40001):
            self.assertEqual(
                router.route_decision({"mode": "快答专家", "daily_count": daily}),
                [{"provider": "siliconflow", "model": "Qwen/Qwen2.5-Coder-7B-Instruct"}],
            )


class TestX5Routing(unittest.TestCase):
    def test_x5_success(self):
        router = make_router()
        route = router.route({"mode": "X5", "points": 1})
        self.assertIsNone(route["error"])
        self.assertEqual(route["provider"], "openai_compatible")
        self.assertEqual(route["protocol"], "chat_completions")
        self.assertEqual(route["model"], "fixture-x5")
        self.assertEqual(route["multiplier"], 1.5)
        self.assertEqual(
            router.route_decision({"mode": "X5", "points": 100}),
            [{"provider": "openai_compatible", "protocol": "chat_completions", "tools": True}],
        )

    def test_x5_downgrade(self):
        router = make_router()
        route = router.route({"mode": "X5", "points": 0})
        self.assertEqual(route["downgrade"], "X5->快答")
        self.assertEqual(route["selected"], "快答专家")
        self.assertEqual(router.route_decision({"mode": "X5", "points": 0}), [{"downgrade": "X5->快答", "selected": "快答专家"}])


class TestX10Routing(unittest.TestCase):
    def test_x10_success(self):
        router = make_router()
        route = router.route({"mode": "X10", "points": 2})
        self.assertIsNone(route["error"])
        self.assertEqual(route["provider"], "openai_compatible")
        self.assertEqual(route["multiplier"], 2.0)
        self.assertEqual(route["model"], "fixture-x10")
        self.assertEqual(
            router.route_decision({"mode": "X10", "points": 1000}),
            [{"provider": "openai_compatible", "multiplier": 2.0}],
        )

    def test_x10_downgrade_to_x5(self):
        router = make_router()
        route = router.route({"mode": "X10", "points": 1})
        self.assertEqual(route["downgrade"], "X10->X5")
        self.assertEqual(route["selected"], "X5")
        self.assertEqual(router.route_decision({"mode": "X10", "points": 1}), [{"downgrade": "X10->X5", "selected": "X5"}])


class TestCustomRouting(unittest.TestCase):
    def test_valid_custom(self):
        router = make_router()
        route = router.route({"mode": "custom", "custom": {"id": "c1", "protocol": "chat_completions"}})
        self.assertIsNone(route["error"])
        self.assertEqual(route["provider"], "openai_compatible")
        self.assertEqual(route["model_ref"], "c1")
        self.assertEqual(route["protocol"], "chat_completions")
        self.assertEqual(router.route_decision({"mode": "custom", "custom": {"id": "c1", "protocol": "chat_completions"}}), [{"provider": "openai_compatible", "model_ref": "c1"}])

    def test_empty_api_url_is_config_error(self):
        router = make_router()
        route = router.route({"mode": "custom", "custom": {"id": "bad", "api_url": "", "model_name": ""}})
        self.assertEqual(route["error"]["category"], "config")
        self.assertEqual(route["error"]["retryable"], False)

    def test_unknown_api_format_has_code(self):
        router = make_router()
        route = router.route({"mode": "custom", "custom": {"id": "c", "api_format": "weird"}})
        self.assertEqual(route["error"]["category"], "config")
        self.assertEqual(route["error"]["code"], "unknown_api_format")


class TestMissingCredential(unittest.TestCase):
    def test_missing_credential_is_credentials_error(self):
        router = make_router(missing=True)
        route = router.route({"mode": "快答专家", "daily_count": 0})
        self.assertEqual(route["error"]["category"], "credentials")
        self.assertEqual(route["error"]["retryable"], False)


class TestFallback(unittest.TestCase):
    def test_doubao_error_falls_back_to_siliconflow(self):
        router = make_router(config={"provider": {"doubao": {"error": "unavailable"}}})
        route = router.route({"mode": "快答专家", "daily_count": 0})
        self.assertIsNone(route["error"])
        self.assertEqual(route["fallback"], "doubao->siliconflow")
        self.assertEqual(route["provider"], "siliconflow")
        self.assertEqual(router.route_decision({"mode": "快答专家", "daily_count": 0}), [{"fallback": "doubao->siliconflow"}])


class TestTraceShape(unittest.TestCase):
    def test_trace_items_are_populated(self):
        router = make_router()
        route = router.route({"mode": "快答专家", "daily_count": 0})
        self.assertIsInstance(route["trace"], list)
        self.assertEqual(len(route["trace"]), 1)
        self.assertEqual(route["trace"][0]["requested_tier"], "快答专家")
        self.assertEqual(route["trace"][0]["provider"], "doubao")


if __name__ == "__main__":
    unittest.main()