"""Tool signature verification policy."""
from __future__ import annotations

from typing import Any, Dict, Iterable, Optional


class SignaturePolicy:
    """Reject unsigned tools when signature verification is required."""

    def __init__(
        self,
        require_signed: bool = True,
        allowlist: Optional[Iterable[str]] = None,
    ) -> None:
        self.require_signed = bool(require_signed)
        self.allowlist = set(allowlist or ())

    def check(self, skill: Dict[str, Any]) -> Dict[str, Any]:
        if not self.require_signed:
            return {"rejected": False}

        if isinstance(skill, dict):
            signature = skill.get("signature")
            name = skill.get("name") or skill.get("id")
        else:
            signature = getattr(skill, "signature", None)
            name = getattr(skill, "name", None)

        if signature:
            return {"rejected": False}
        if name and name in self.allowlist:
            return {"rejected": False}
        return {"rejected": True, "reason": "unsigned"}
