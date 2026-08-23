"""Contract validation wrapper + envelope construction for the M2 RPC worker.

Uses the canonical JSON Schemas from @fastwork/contracts (rebuild/packages/contracts/schemas).
No schema definitions are duplicated here.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ..contracts.validator import build_registry, validate_contract
from .constants import RPC_PROTOCOL_VERSION
from .errors import WorkerRpcError


def _schemas_root() -> Path:
    """Locate the canonical contract schema directory.

    Resolution: FASTWORK_CONTRACTS_SCHEMAS_DIR env, then the monorepo anchor
    (rebuild/packages/contracts/schemas relative to this source tree).
    """
    env = os.environ.get("FASTWORK_CONTRACTS_SCHEMAS_DIR")
    if env:
        return Path(env)
    anchor = Path(__file__).resolve().parents[5]  # .../rebuild
    candidate = anchor / "packages" / "contracts" / "schemas"
    if candidate.is_dir():
        return candidate
    raise FileNotFoundError("contract schema directory not found")


_REGISTRY: Optional[Dict[str, Dict[str, Any]]] = None


def _registry() -> Dict[str, Dict[str, Any]]:
    global _REGISTRY
    if _REGISTRY is None:
        _REGISTRY = build_registry(_schemas_root())
    return _REGISTRY


def validate_rpc_envelope(schema_id: str, instance: Any) -> Tuple[bool, List[str]]:
    """Validate instance against a canonical schema by $id."""
    schema = _registry().get(schema_id)
    if schema is None:
        return False, [f"schema not found: {schema_id}"]
    return validate_contract(schema, instance, _registry())


def validate_request(req: Any) -> Tuple[bool, List[str]]:
    return validate_rpc_envelope("fastwork:rpc:request", req)


def validate_response(res: Any) -> Tuple[bool, List[str]]:
    return validate_rpc_envelope("fastwork:rpc:response", res)


def validate_event(ev: Any) -> Tuple[bool, List[str]]:
    return validate_rpc_envelope("fastwork:rpc:event", ev)


def validate_ready_payload(payload: Any) -> Tuple[bool, List[str]]:
    return validate_rpc_envelope("fastwork:rpc:worker-ready-payload", payload)


def validate_health_result(result: Any) -> Tuple[bool, List[str]]:
    return validate_rpc_envelope("fastwork:rpc:health-result", result)


def validate_cancel_payload(payload: Any) -> Tuple[bool, List[str]]:
    return validate_rpc_envelope("fastwork:rpc:cancel-payload", payload)


def validate_protocol_error_payload(payload: Any) -> Tuple[bool, List[str]]:
    return validate_rpc_envelope("fastwork:rpc:protocol-error-payload", payload)


def assert_version_supported(req: Dict[str, Any]) -> None:
    """Reject requests with an unsupported protocol version before dispatch."""
    version = req.get("version")
    if version != RPC_PROTOCOL_VERSION:
        raise WorkerRpcError("version.unsupported", f"unsupported protocol version: {version!r}")
