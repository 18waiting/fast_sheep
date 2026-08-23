"""SignaturePolicy tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.tools.sandbox.signature_policy import SignaturePolicy


class TestToolSignaturePolicy(unittest.TestCase):
    def test_unsigned_rejected_when_required(self):
        p = SignaturePolicy(require_signed=True)
        self.assertEqual(p.check({"name": "x", "signature": None}), {"rejected": True, "reason": "unsigned"})

    def test_signed_allowed(self):
        p = SignaturePolicy(require_signed=True)
        self.assertEqual(p.check({"name": "x", "signature": "sha256:abc"}), {"rejected": False})

    def test_not_required(self):
        p = SignaturePolicy(require_signed=False)
        self.assertEqual(p.check({"name": "x"}), {"rejected": False})

    def test_allowlist(self):
        p = SignaturePolicy(require_signed=True, allowlist=["x"])
        self.assertEqual(p.check({"name": "x"}), {"rejected": False})


if __name__ == "__main__":
    unittest.main()
