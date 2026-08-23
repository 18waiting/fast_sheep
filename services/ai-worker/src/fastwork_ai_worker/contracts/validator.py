"""Minimal generic JSON-Schema validator for the clean-room contract layer.

Clean-room implementation. Derived only from public/project behavioral
specifications and frozen contracts. No RPC server, no business logic.

Supports the JSON Schema Draft 2020-12 subset used by the 59 clean-room
contract schemas: type, enum, const, properties, required,
additionalProperties, items, minItems/maxItems, minLength/maxLength,
minimum/maximum, anyOf/allOf/oneOf, $ref, and the date-time format.

`validate_contract(schema, instance, registry)` returns (ok: bool, errors: list[str]).
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

_DATE_TIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")

_FORMATS: Dict[str, Any] = {"date-time": _DATE_TIME_RE}


def load_schema(path: str | Path) -> Dict[str, Any]:
    """Load a JSON Schema file."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_registry(schemas_root: str | Path) -> Dict[str, Dict[str, Any]]:
    """Load every *.schema.json under schemas_root into an {$id: schema} map."""
    root = Path(schemas_root)
    registry: Dict[str, Dict[str, Any]] = {}
    for p in sorted(root.rglob("*.schema.json")):
        s = load_schema(p)
        sid = s.get("$id")
        if sid:
            registry[sid] = s
    return registry


class _Ctx:
    def __init__(self, registry: Dict[str, Dict[str, Any]]):
        self.registry = registry


def _type_of(v: Any) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, int):
        return "integer"
    if isinstance(v, float):
        return "number"
    if isinstance(v, str):
        return "string"
    if isinstance(v, list):
        return "array"
    if isinstance(v, dict):
        return "object"
    return "unknown"


def _check(schema: Dict[str, Any], inst: Any, ctx: _Ctx, path: str, errors: List[str]) -> None:
    # $ref
    ref = schema.get("$ref")
    if isinstance(ref, str):
        target = ctx.registry.get(ref)
        if target is None:
            errors.append(f"{path}: unresolved $ref {ref}")
            return
        _check(target, inst, ctx, path, errors)
        return
    # type
    t = schema.get("type")
    if isinstance(t, str):
        if t == "number" and _type_of(inst) in ("integer", "number"):
            pass
        elif t != "integer" and _type_of(inst) != t:
            errors.append(f"{path}: expected {t}, got {_type_of(inst)}")
            return
        elif t == "integer" and _type_of(inst) != "integer":
            errors.append(f"{path}: expected integer, got {_type_of(inst)}")
            return
    elif isinstance(t, list):
        actual = _type_of(inst)
        ok = False
        for tt in t:
            if tt == "number" and actual in ("integer", "number"):
                ok = True
            elif actual == tt:
                ok = True
        if not ok:
            errors.append(f"{path}: expected one of {t}, got {actual}")
            return
    # enum / const
    if "enum" in schema and inst not in schema["enum"]:
        errors.append(f"{path}: value not in enum")
        return
    if "const" in schema and inst != schema["const"]:
        errors.append(f"{path}: expected const {schema['const']!r}")
        return
    # string facets
    if isinstance(inst, str):
        if "minLength" in schema and len(inst) < schema["minLength"]:
            errors.append(f"{path}: shorter than minLength")
        if "maxLength" in schema and len(inst) > schema["maxLength"]:
            errors.append(f"{path}: longer than maxLength")
        if "pattern" in schema and not re.search(schema["pattern"], inst):
            errors.append(f"{path}: pattern mismatch")
        if "format" in schema:
            fmt = schema["format"]
            if fmt in _FORMATS and not _FORMATS[fmt].search(inst):
                errors.append(f"{path}: format {fmt} mismatch")
    # numeric facets
    if isinstance(inst, (int, float)) and not isinstance(inst, bool):
        if "minimum" in schema and inst < schema["minimum"]:
            errors.append(f"{path}: below minimum")
        if "maximum" in schema and inst > schema["maximum"]:
            errors.append(f"{path}: above maximum")
    # object
    if isinstance(inst, dict):
        props = schema.get("properties")
        if isinstance(props, dict):
            for k, sub in props.items():
                if k in inst:
                    _check(sub, inst[k], ctx, f"{path}.{k}", errors)
        req = schema.get("required")
        if isinstance(req, list):
            for k in req:
                if k not in inst:
                    errors.append(f"{path}: missing required {k}")
        if schema.get("additionalProperties") is False:
            known = set(props.keys()) if isinstance(props, dict) else set()
            for k in inst:
                if k not in known:
                    errors.append(f"{path}: additional property {k}")
    # array
    if isinstance(inst, list):
        items = schema.get("items")
        if isinstance(items, dict):
            for i, item in enumerate(inst):
                _check(items, item, ctx, f"{path}[{i}]", errors)
        if "minItems" in schema and len(inst) < schema["minItems"]:
            errors.append(f"{path}: fewer items than minItems")
        if "maxItems" in schema and len(inst) > schema["maxItems"]:
            errors.append(f"{path}: more items than maxItems")
    # combinators
    if "allOf" in schema:
        for i, sub in enumerate(schema["allOf"]):
            _check(sub, inst, ctx, f"{path}.allOf[{i}]", errors)
    if "anyOf" in schema:
        ok = False
        for i, sub in enumerate(schema["anyOf"]):
            e: List[str] = []
            _check(sub, inst, ctx, f"{path}.anyOf[{i}]", e)
            if not e:
                ok = True
                break
        if not ok:
            errors.append(f"{path}: no anyOf branch matched")
    if "oneOf" in schema:
        matched = 0
        for i, sub in enumerate(schema["oneOf"]):
            e: List[str] = []
            _check(sub, inst, ctx, f"{path}.oneOf[{i}]", e)
            if not e:
                matched += 1
        if matched != 1:
            errors.append(f"{path}: oneOf matched {matched} branches")


def validate_contract(
    schema: Dict[str, Any],
    instance: Any,
    registry: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Tuple[bool, List[str]]:
    """Validate instance against schema. Returns (ok, errors)."""
    errors: List[str] = []
    _check(schema, instance, _Ctx(registry or {}), "$", errors)
    return (len(errors) == 0, errors)


def main(argv: Optional[List[str]] = None) -> int:
    """CLI: validate a corpus file.

    corpus file shape: {"schemas_root": "...", "cases": [{"case_id", "schema_id",
    "payload", "expected_valid"}]}
    Outputs one JSON line per case: {"case_id", "schema_id", "expected_valid",
    "valid", "errors"}.
    """
    import sys as _sys
    argv = argv if argv is not None else _sys.argv[1:]
    if len(argv) < 1:
        print("usage: python -m fastwork_ai_worker.contracts.validator <corpus.json>", file=_sys.stderr)
        return 2
    corpus_path = Path(argv[0])
    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    schemas_root = (corpus_path.parent / corpus.get("schemas_root", ".")).resolve()
    registry = build_registry(schemas_root)
    results = []
    for case in corpus["cases"]:
        schema = registry.get(case["schema_id"])
        if schema is None:
            results.append({"case_id": case["case_id"], "schema_id": case["schema_id"],
                            "expected_valid": case.get("expected_valid"),
                            "valid": False, "errors": [f"unknown schema {case['schema_id']}"]})
            continue
        ok, errors = validate_contract(schema, case.get("payload"), registry)
        results.append({"case_id": case["case_id"], "schema_id": case["schema_id"],
                        "expected_valid": case.get("expected_valid"), "valid": ok, "errors": errors})
    for r in results:
        print(json.dumps(r, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
