"""Environment whitelisting for sandbox subprocesses."""
from __future__ import annotations

import os
from typing import Any, Dict, Iterable, Mapping, Optional

_SECRET_KEY_MARKERS = (
    "secret",
    "password",
    "passwd",
    "auth",
    "token",
    "api_key",
    "apikey",
    "credential",
    "authorization",
    "private_key",
    "access_key",
)


def _looks_secret(key: str, value: Any) -> bool:
    """Return True when an environment key/value should never leave the worker."""
    lowered = str(key).lower()
    if any(marker in lowered for marker in _SECRET_KEY_MARKERS):
        return True
    if not isinstance(value, str):
        return False
    stripped = value.strip()
    if "-----BEGIN" in stripped or stripped.startswith("sk-"):
        return True
    return False


def build_whitelist_env(
    base: Optional[Mapping[str, str]] = None,
    allowed_keys: Iterable[str] = (),
) -> Dict[str, str]:
    """Return only whitelisted environment keys, with secrets always dropped."""
    source: Mapping[str, str] = os.environ if base is None else base
    allowed = tuple(allowed_keys or ())
    result: Dict[str, str] = {}
    for key in allowed:
        if key not in source:
            continue
        value = source[key]
        if _looks_secret(key, value):
            continue
        result[key] = value
    return result



