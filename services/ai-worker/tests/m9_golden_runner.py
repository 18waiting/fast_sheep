"""GF-HANDOFF golden execution (M9). Real HandoffPolicyEngine + legacy marker codec."""
from __future__ import annotations

import glob
import json
import os
import sys
import random
from typing import Any, Dict, List

sys.path.insert(0, os.path.dirname(__file__))
from m9_helpers import run_handoff_case, run_feedback_case  # noqa: E402


def discover(path: str) -> List[str]:
    return sorted(glob.glob(os.path.join(path, "*.json")))


def run_all_handoff_goldens(fixtures_dir: str) -> Dict[str, Any]:
    results = []
    passed = 0
    for f in discover(fixtures_dir):
        fx = json.load(open(f, encoding="utf-8"))
        if not fx.get("case_id", "").startswith("GF-HANDOFF"):
            continue
        result = run_handoff_case(fx)
        results.append({"case_id": fx["case_id"], "result": result})
        if result == "PASS":
            passed += 1
    return {"discovered": len(results), "passed": passed, "failed": len(results) - passed, "results": results}


def run_all_feedback_goldens(fixtures_dir: str) -> Dict[str, Any]:
    results = []
    passed = 0
    for f in discover(fixtures_dir):
        fx = json.load(open(f, encoding="utf-8"))
        if not fx.get("case_id", "").startswith("GF-FB"):
            continue
        result = run_feedback_case(fx)
        results.append({"case_id": fx["case_id"], "result": result})
        if result == "PASS":
            passed += 1
    return {"discovered": len(results), "passed": passed, "failed": len(results) - passed, "results": results}
