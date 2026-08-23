"""Legacy secret policy (M11, clean-room). Worker-side mirror: detects secret
field names (never values); provider secrets SKIP by default and move to a
credential_ref only on explicit consent. Seller auth material is never imported.
"""
from __future__ import annotations

from typing import Any, Dict, List

SELLER_SECRET_FIELDS = ("cookie", "cookies", "session", "session_token", "token", "password", "passwd", "auth", "authorization", "device_fingerprint", "license", "login_state", "credential")
PROVIDER_SECRET_FIELDS = ("api_key", "apikey", "secret", "secret_key", "access_key", "app_secret")


def detect_secrets(obj: Any, depth: int = 0) -> Dict[str, List[str]]:
    out: Dict[str, List[str]] = {"secret_fields_detected": [], "seller_secrets_detected": [], "provider_secrets_detected": []}
    if depth > 32 or obj is None:
        return out
    if isinstance(obj, list):
        for item in obj:
            r = detect_secrets(item, depth + 1)
            for k in out:
                for v in r[k]:
                    if v not in out[k]:
                        out[k].append(v)
        return out
    if isinstance(obj, dict):
        for key, value in obj.items():
            lower = str(key).lower()
            if any(s in lower for s in SELLER_SECRET_FIELDS):
                out["secret_fields_detected"].append(str(key))
                out["seller_secrets_detected"].append(str(key))
            elif any(s in lower for s in PROVIDER_SECRET_FIELDS):
                out["secret_fields_detected"].append(str(key))
                out["provider_secrets_detected"].append(str(key))
            r = detect_secrets(value, depth + 1)
            for k in out:
                for v in r[k]:
                    if v not in out[k]:
                        out[k].append(v)
    return out


def provider_secret_decision(options: Dict[str, Any], provider_key: str) -> Dict[str, Any]:
    if options.get("import_provider_secret") is True:
        return {"action": "store_ref", "ref": "cred_" + provider_key.lower().replace(" ", "_")}
    return {"action": "skip"}
