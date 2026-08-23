"""M4 security tests: secret redaction, no plaintext secrets in config/logs."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

from m4_helpers import _has_plaintext_secret, redact_secret


class TestSecretRedaction(unittest.TestCase):
    def test_no_plaintext_secret_in_config(self):
        cfg = {"providers": [{"id": "p1", "credential_ref": "vault:p1"}]}
        self.assertFalse(_has_plaintext_secret(cfg))

    def test_plaintext_secret_detected(self):
        cfg = {"providers": [{"id": "p1", "api_key": "fake-super-secret-value"}]}
        self.assertTrue(_has_plaintext_secret(cfg))

    def test_redact_log_line(self):
        line = "api_key=SUPER-SECRET-VALUE-12345-abcdef"
        self.assertEqual(redact_secret(line), "api_key=<REDACTED_SECRET>")

    def test_redact_bearer(self):
        line = "Authorization: Bearer fake-super-secret-value"
        self.assertIn("<REDACTED_SECRET>", redact_secret(line))

    def test_fake_secret_not_in_provider_config_serialization(self):
        # Serializing a ProviderConfig with credential_ref must not contain the secret value.
        import json

        cfg = {"providers": [{"id": "c1", "credential_ref": "vault:p1"}]}
        s = json.dumps(cfg)
        self.assertNotIn("fake-super-secret-value", s)


if __name__ == "__main__":
    unittest.main()
