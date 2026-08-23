"""Golden fixture execution for all GF-PROMPT-* parity cases (TASK-019 M4)."""
import json
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.prompt.prompt_assembler import assemble
from fastwork_ai_worker.prompt.prompt_budgeter import budget_decide
from fastwork_ai_worker.prompt.prompt_selector import select_profile_decision
from fastwork_ai_worker.prompt.skill_mount_resolver import resolve_decision

_FIXTURES_DIR = os.path.join(
    os.path.dirname(__file__),
    "..",
    "..",
    "..",
    "..",
    "parity-tests",
    "fixtures",
    "prompt",
)


def _matches(expected, actual, mode="EXACT"):
    if isinstance(expected, dict) and isinstance(actual, dict):
        if set(expected.keys()) != set(actual.keys()):
            return False
        return all(_matches(expected[k], actual[k], mode) for k in expected)
    if isinstance(expected, list) and isinstance(actual, list):
        if mode == "UNORDERED_SET":
            return len(expected) == len(actual) and set(expected) == set(actual)
        if len(expected) != len(actual):
            return False
        return all(_matches(x, y, mode) for x, y in zip(expected, actual))
    return expected == actual


def run_prompt_fixture(fx):
    case = fx.get("case_id", "")
    cfg = fx.get("config", {})
    inp = fx.get("input", {})
    mode = fx.get("comparison", {}).get("mode", "EXACT")

    if case in ("GF-PROMPT-001", "GF-PROMPT-002"):
        actual = select_profile_decision(inp.get("order_state", "未下单"), cfg)
        return actual, mode

    if case == "GF-PROMPT-003":
        profiles = {"p1": {"mounted_skills": ["skill-a"]}}
        actual = {"mounted_skills": resolve_decision("p1", None, profiles, {})["mounted_skills"]}
        return actual, mode

    if case == "GF-PROMPT-004":
        product_skills = {"10001": ["skill-b"]}
        actual = {"mounted_skills": resolve_decision(None, "10001", {}, product_skills)["mounted_skills"]}
        return actual, mode

    if case == "GF-PROMPT-005":
        profiles = {"p1": {"mounted_skills": ["skill-a", "skill-c"]}}
        product_skills = {"10001": ["skill-b", "skill-c"]}
        actual = {"mounted_skills": resolve_decision("p1", "10001", profiles, product_skills)["mounted_skills"]}
        return actual, mode

    if case == "GF-PROMPT-006":
        out = assemble({"profile_id": "p1", "skip_skill_context": True}, {"p1": {"mounted_skills": []}}, {})
        return {"skill_context_included": out["skill_context_included"]}, mode

    if case == "GF-PROMPT-007":
        out = assemble(
            {"profile_id": "p1", "message_has_image": True, "product_has_image": True},
            {"p1": {"mounted_skills": []}},
            {},
        )
        return {"image_rule": out["image_rule"]}, mode

    if case == "GF-PROMPT-008":
        out = assemble(
            {"profile_id": "p1", "product_info": "<PRODUCT_INFO>", "history": "<HISTORY>", "reference_content": "<REFERENCE>"},
            {"p1": {"mounted_skills": []}},
            {},
        )
        return {"slots": out["slots"], "order": out["order"]}, mode

    if case in ("GF-PROMPT-009", "GF-PROMPT-010", "GF-PROMPT-011", "GF-PROMPT-012"):
        budget = cfg.get("prompt_budget", {})
        contents = {
            "reference": int(budget.get("reference_chars", 0)),
            "history": int(budget.get("history_chars", 0)),
            "product": int(budget.get("product_chars", 0)),
            "head": int(budget.get("head_chars", 0)),
        }
        out = budget_decide(contents, budget, question_len=300)
        if case == "GF-PROMPT-009":
            return [{"truncate_order": out["truncate_order"]}], mode
        if case == "GF-PROMPT-012":
            return [{"truncate_order_last": out["truncate_order"][-1]}], mode
        return [{"truncate": out["truncate"], "cut": out["cut"]}], mode

    raise AssertionError("unexpected fixture case: " + case)


class TestPromptGoldenFixtures(unittest.TestCase):
    def test_all_prompt_fixtures_pass(self):
        self.assertTrue(os.path.isdir(_FIXTURES_DIR), "fixtures dir missing: " + _FIXTURES_DIR)
        cases = sorted(Path(_FIXTURES_DIR).glob("GF-PROMPT-*.json"))
        self.assertGreaterEqual(len(cases), 12, "expected all GF-PROMPT fixtures on disk")
        failures = []
        for path in cases:
            with path.open("r", encoding="utf-8") as fh:
                fx = json.load(fh)
            expected = fx.get("expected", {})
            expected = expected.get("decisions", expected.get("result", expected.get("trace", {})))
            actual, mode = run_prompt_fixture(fx)
            with self.subTest(case_id=fx.get("case_id")):
                ok = _matches(expected, actual, mode)
                if not ok:
                    failures.append(
                        fx.get("case_id") + " expected=" + json.dumps(expected, ensure_ascii=False)
                        + " actual=" + json.dumps(actual, ensure_ascii=False)
                    )
                self.assertTrue(ok, "fixture failed: " + str(failures[-1] if failures else ""))
        self.assertEqual(len(failures), 0, "failing fixtures: " + "; ".join(failures))


if __name__ == "__main__":
    unittest.main()

