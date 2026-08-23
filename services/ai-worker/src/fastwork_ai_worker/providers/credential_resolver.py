"""Credential resolution (TASK-019 M4).

The clean-room worker never stores or logs credential values.  It only resolves
credential references through an injected secret store.  The included fake store
returns synthetic values and can simulate the missing-credential condition.
"""
from __future__ import annotations

from typing import Dict, Optional


class FakeSecretStore:
    """Deterministic fake store.

    ``missing=True`` makes every lookup fail.  When ``missing`` is false, any
    unknown ref also receives a synthetic value so offline provider tests can
    pass the credential check without hardcoding or leaking real secrets.
    """

    def __init__(self, secrets: Optional[Dict[str, str]] = None, missing: bool = False):
        self.secrets = dict(secrets or {})
        self.missing = bool(missing)

    def get(self, ref: str) -> Optional[str]:
        if self.missing:
            return None
        if ref in self.secrets:
            return self.secrets[ref]
        return "fake-super-secret-value"


class CredentialResolver:
    """Resolve credential_ref strings into secret-store values."""

    def __init__(self, secret_store):
        self.secret_store = secret_store

    def resolve(self, credential_ref: str) -> Optional[str]:
        if not credential_ref:
            return None
        getter = getattr(self.secret_store, "get", None)
        if getter is None:
            return None
        return getter(credential_ref)