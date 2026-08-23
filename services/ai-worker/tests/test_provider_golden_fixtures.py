"""M4 golden fixture execution: all discovered GF-PROV-* fixtures must pass."""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.providers.provider_router import ProviderRouter
from fastwork_ai_worker.providers.credential_resolver import CredentialResolver, FakeSecretStore

_FIXTURES_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "..", "parity-tests", "fixtures", "prov"
)


def _val_eq(a, b):
    if isinstance(a, dict) and isinstance(b, dict):
        if set(a.keys()) != set(b.keys()):
            return False
        return all(_val_eq(a[k], b[k]) for k in a)
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        if len(a) != len(b):
            return False
        return all(_val_eq(x, y) for x, y in zip(a, b))
    if isinstance(a, float) or isinstance(b, float):
        try:
            return abs(float(a) - float(b)) <= 1e-9
        except (TypeError, ValueError):
            return False
    return a == b


def _subset(actual, expected):
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return False
        for key, value in expected.items():
            if key not in actual:
                return False
            if not _subset(actual[key], value):
                return False
        return True
    if isinstance(expected, list):
        if not isinstance(actual, list) or len(actual) != len(expected):
            return False
        return all(_subset(a, e) for a, e in zip(actual, expected))
    return _val_eq(expected, actual)


def _run_fixture(fx):
    inp = fx.get("input", {})
    mocks = fx.get("mocks", {})
    comparison = fx.get("comparison", {}).get("mode", "EXACT")

    store = FakeSecretStore(
        secrets={"p1": "fake-super-secret-value"},
        missing=bool(mocks.get("secrets", {}).get("resolve", {}).get("missing")),
    )
    router = ProviderRouter(config=mocks, credential_resolver=CredentialResolver(store))
    req = {
        "mode": inp.get("mode", "custom" if "custom" in inp else "快答专家"),
        "daily_count": inp.get("daily_count", 0),
        "points": inp.get("points", 0),
        "custom": inp.get("custom"),
    }

    route = router.route(req)
    if route.get("error") is not None:
        actual = {
            "error": {
                "category": route["error"].get("category"),
                "retryable": route["error"].get("retryable"),
                "code": route["error"].get("code"),
            }
        }
    else:
        actual = router.route_decision(req)

    expected = fx.get("expected", {})
    expected = expected.get("decisions", expected.get("result", expected.get("trace", {})))

    if comparison == "SUBSET":
        passed = _subset(actual, expected)
    else:
        passed = _val_eq(expected, actual)
    return passed, actual


class TestProviderGoldenFixtures(unittest.TestCase):
    def test_all_discovered_fixtures_pass(self):
        self.assertTrue(os.path.isdir(_FIXTURES_DIR), "fixtures dir missing: " + _FIXTURES_DIR)
        discovered = 0
        failed = 0
        failed_ids = []
        for path in sorted(os.listdir(_FIXTURES_DIR)):
            if not path.startswith("GF-PROV-") or not path.endswith(".json"):
                continue
            discovered += 1
            with open(os.path.join(_FIXTURES_DIR, path), encoding="utf-8") as fh:
                fx = json.load(fh)
            try:
                passed, actual = _run_fixture(fx)
            except Exception as exc:  # noqa: BLE001
                passed = False
                actual = f"{type(exc).__name__}: {exc}"
            if not passed:
                failed += 1
                failed_ids.append(fx.get("case_id"))
        self.assertEqual(discovered, 14, "expected 14 GF-PROV fixtures on disk")
        self.assertEqual(failed, 0, "failing fixtures: " + json.dumps(failed_ids, ensure_ascii=False))
        self.assertEqual(discovered - failed, discovered)


if __name__ == "__main__":
    unittest.main()