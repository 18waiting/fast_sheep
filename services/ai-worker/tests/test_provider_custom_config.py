"""M4 custom model configuration tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.providers.provider_router import ProviderRouter
from fastwork_ai_worker.providers.credential_resolver import CredentialResolver, FakeSecretStore


def router_for_custom():
    return ProviderRouter(credential_resolver=CredentialResolver(FakeSecretStore()))


class TestCustomConfig(unittest.TestCase):
    def test_id_and_protocol_are_sufficient(self):
        route = router_for_custom().route({"mode": "custom", "custom": {"id": "c1", "protocol": "chat_completions"}})
        self.assertIsNone(route["error"])
        self.assertEqual(route["model_ref"], "c1")
        self.assertEqual(route["provider"], "openai_compatible")

    def test_protocol_defaults_to_chat_completions(self):
        route = router_for_custom().route({"mode": "custom", "custom": {"id": "c2"}})
        self.assertIsNone(route["error"])
        self.assertEqual(route["protocol"], "chat_completions")

    def test_api_url_empty_is_invalid(self):
        route = router_for_custom().route({"mode": "custom", "custom": {"id": "bad", "api_url": ""}})
        self.assertEqual(route["error"]["category"], "config")
        self.assertEqual(route["error"]["retryable"], False)

    def test_model_name_empty_is_invalid(self):
        route = router_for_custom().route({"mode": "custom", "custom": {"id": "bad", "model_name": ""}})
        self.assertEqual(route["error"]["category"], "config")
        self.assertEqual(route["error"]["retryable"], False)

    def test_unknown_api_format_is_unknown_api_format(self):
        route = router_for_custom().route({"mode": "custom", "custom": {"id": "c3", "api_format": "weird"}})
        self.assertEqual(route["error"]["category"], "config")
        self.assertEqual(route["error"]["code"], "unknown_api_format")
        self.assertEqual(route["error"]["retryable"], False)

    def test_api_format_without_mode_is_validated_early(self):
        route = router_for_custom().route({"mode": "快答专家", "custom": {"api_format": "weird"}})
        self.assertEqual(route["error"]["category"], "config")
        self.assertEqual(route["error"]["code"], "unknown_api_format")


if __name__ == "__main__":
    unittest.main()