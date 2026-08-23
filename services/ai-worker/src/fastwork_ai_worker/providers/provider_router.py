"""Provider routing (TASK-019 M4).

Deterministic mode -> provider selection with the frozen GF-PROV-* decisions.
X5/X10 model names are deliberately synthetic fixture ids because the real
cloud-injected model names are reference-unknown.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .credential_resolver import CredentialResolver, FakeSecretStore
from .errors import (
    ProviderError,
    config_error,
    credentials_error,
    unknown_api_format,
)
from .types import VALID_API_FORMATS, empty_route_result


QUICK_MODE = "快答专家"
X5_MODE = "X5"
X10_MODE = "X10"
CUSTOM_MODE = "custom"

DOUBAO_PROVIDER = "doubao"
SILICONFLOW_PROVIDER = "siliconflow"
OPENAI_COMPATIBLE_PROVIDER = "openai_compatible"

DOUBAO_FIXTURE_MODEL = "<fixture-doubao>"
SILICONFLOW_DEEPSEEK_V3 = "deepseek-ai/DeepSeek-V3"
SILICONFLOW_QWEN = "Qwen/Qwen2.5-Coder-7B-Instruct"

X5_FIXTURE_MODEL = "fixture-x5"
X10_FIXTURE_MODEL = "fixture-x10"


class ProviderRouter:
    """Routes a GenerationRequest-shaped route request to a provider decision.

    ``config`` may contain ``provider`` state under ``config["provider"]``, for
    example ``{"doubao": {"error": "unavailable"}}`` to exercise the frozen
    fallback fixture GF-PROV-012.
    """

    def __init__(
        self,
        config: Optional[Dict[str, Any]] = None,
        call_log: Optional[list] = None,
        credential_resolver: Optional[CredentialResolver] = None,
    ):
        self.config = dict(config or {})
        self.call_log = call_log if call_log is not None else []
        if credential_resolver is None:
            credential_resolver = CredentialResolver(FakeSecretStore())
        self.credential_resolver = credential_resolver

    # ---- public API ----------------------------------------------------

    def route(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Return a ProviderRouteResult-shaped dict."""
        route_result, _ = self._decide(request)
        self.call_log.append(("route", dict(request)))
        return route_result

    def route_decision(self, request: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Return the frozen fixture-shaped decision list."""
        _, decisions = self._decide(request)
        self.call_log.append(("route_decision", dict(request)))
        return decisions

    # ---- internal -------------------------------------------------------

    def _provider_has_error(self, provider: str) -> bool:
        provider_state = self.config.get("provider", {})
        if not isinstance(provider_state, dict):
            return False
        state = provider_state.get(provider, {})
        if not isinstance(state, dict):
            return False
        return bool(state.get("error"))

    def _credential_ok(self, credential_ref: str) -> bool:
        return self.credential_resolver.resolve(credential_ref) is not None

    def _decide(self, request: Dict[str, Any]) -> tuple:
        req = dict(request or {})
        mode = req.get("mode")
        custom = req.get("custom")
        if mode is None:
            # GF-PROV-014 has only a custom api_format and no mode.  Treat the
            # presence of custom fields as the custom request shape.
            mode = CUSTOM_MODE if isinstance(custom, dict) and custom else QUICK_MODE

        route = empty_route_result()
        trace = route["trace"]

        # Early validation of api_format when present, independent of mode, so
        # GF-PROV-014 (custom-only input) yields config/unknown_api_format.
        if isinstance(custom, dict) and "api_format" in custom:
            api_format = custom.get("api_format")
            if api_format not in VALID_API_FORMATS:
                err = unknown_api_format(api_format)
                route["error"] = err.to_dict()
                return route, []

        if mode == CUSTOM_MODE:
            return self._decide_custom(req, custom, route)

        if mode == X5_MODE:
            return self._decide_x5(req, route)

        if mode == X10_MODE:
            return self._decide_x10(req, route)

        # Default/unknown modes follow the 快答专家 free-tier decision table.
        return self._decide_quick(req, route)

    def _decide_custom(self, req: Dict[str, Any], custom: Any, route: Dict[str, Any]) -> tuple:
        if not isinstance(custom, dict):
            err = config_error("custom config must be an object", retryable=False)
            route["error"] = err.to_dict()
            return route, []

        for field in ("api_url", "model_name"):
            if field in custom and not str(custom.get(field) or "").strip():
                err = config_error(f"custom {field} must not be empty", retryable=False)
                route["error"] = err.to_dict()
                return route, []

        protocol = custom.get("protocol") or custom.get("api_format") or "chat_completions"
        if protocol not in VALID_API_FORMATS:
            err = unknown_api_format(protocol)
            route["error"] = err.to_dict()
            return route, []

        model_ref = str(custom.get("id") or custom.get("model_name") or "")
        if not model_ref:
            err = config_error("custom id/model_name must not be empty", retryable=False)
            route["error"] = err.to_dict()
            return route, []
        credential_ref = custom.get("credential_ref") or f"custom:{model_ref}"
        if not self._credential_ok(credential_ref):
            err = credentials_error(f"missing credential for custom model {model_ref!r}")
            route["error"] = err.to_dict()
            return route, []

        route.update(
            provider=OPENAI_COMPATIBLE_PROVIDER,
            protocol=protocol,
            model_ref=model_ref,
            multiplier=1.0,
            tools=True,
        )
        route["trace"].append(
            {
                "requested_tier": CUSTOM_MODE,
                "effective_tier": CUSTOM_MODE,
                "provider": OPENAI_COMPATIBLE_PROVIDER,
                "model": model_ref,
                "fallback_reason": None,
                "downgrade_reason": None,
            }
        )
        decisions = [{"provider": OPENAI_COMPATIBLE_PROVIDER, "model_ref": model_ref}]
        return route, decisions

    def _decide_x5(self, req: Dict[str, Any], route: Dict[str, Any]) -> tuple:
        points = int(req.get("points") or 0)
        if points < 1:
            route.update(downgrade="X5->快答", selected=QUICK_MODE)
            route["trace"].append(
                {
                    "requested_tier": X5_MODE,
                    "effective_tier": QUICK_MODE,
                    "provider": None,
                    "model": None,
                    "fallback_reason": None,
                    "downgrade_reason": "points < 1",
                }
            )
            return route, [{"downgrade": "X5->快答", "selected": QUICK_MODE}]

        if not self._credential_ok("deepseek"):
            err = credentials_error("missing deepseek credential for X5")
            route["error"] = err.to_dict()
            return route, []

        route.update(
            provider=OPENAI_COMPATIBLE_PROVIDER,
            protocol="chat_completions",
            model=X5_FIXTURE_MODEL,
            multiplier=1.5,
            tools=True,
        )
        route["trace"].append(
            {
                "requested_tier": X5_MODE,
                "effective_tier": X5_MODE,
                "provider": OPENAI_COMPATIBLE_PROVIDER,
                "model": X5_FIXTURE_MODEL,
                "fallback_reason": None,
                "downgrade_reason": None,
            }
        )
        return route, [{"provider": OPENAI_COMPATIBLE_PROVIDER, "protocol": "chat_completions", "tools": True}]

    def _decide_x10(self, req: Dict[str, Any], route: Dict[str, Any]) -> tuple:
        points = int(req.get("points") or 0)
        if points < 2:
            route.update(downgrade="X10->X5", selected=X5_MODE)
            route["trace"].append(
                {
                    "requested_tier": X10_MODE,
                    "effective_tier": X5_MODE,
                    "provider": None,
                    "model": None,
                    "fallback_reason": None,
                    "downgrade_reason": "points < 2",
                }
            )
            return route, [{"downgrade": "X10->X5", "selected": X5_MODE}]

        if not self._credential_ok("deepseek"):
            err = credentials_error("missing deepseek credential for X10")
            route["error"] = err.to_dict()
            return route, []

        route.update(
            provider=OPENAI_COMPATIBLE_PROVIDER,
            protocol="chat_completions",
            model=X10_FIXTURE_MODEL,
            multiplier=2.0,
            tools=True,
        )
        route["trace"].append(
            {
                "requested_tier": X10_MODE,
                "effective_tier": X10_MODE,
                "provider": OPENAI_COMPATIBLE_PROVIDER,
                "model": X10_FIXTURE_MODEL,
                "fallback_reason": None,
                "downgrade_reason": None,
            }
        )
        return route, [{"provider": OPENAI_COMPATIBLE_PROVIDER, "multiplier": 2.0}]

    def _decide_quick(self, req: Dict[str, Any], route: Dict[str, Any]) -> tuple:
        daily_count = int(req.get("daily_count") or 0)
        if daily_count < 20000:
            provider = DOUBAO_PROVIDER
            model = DOUBAO_FIXTURE_MODEL
            protocol = "doubao_ark"
            credential_ref = DOUBAO_PROVIDER
        elif daily_count < 40000:
            provider = SILICONFLOW_PROVIDER
            model = SILICONFLOW_DEEPSEEK_V3
            protocol = "siliconflow"
            credential_ref = SILICONFLOW_PROVIDER
        else:
            provider = SILICONFLOW_PROVIDER
            model = SILICONFLOW_QWEN
            protocol = "siliconflow"
            credential_ref = SILICONFLOW_PROVIDER

        # GF-PROV-012: doubao unavailable -> fallback to siliconflow.
        if provider == DOUBAO_PROVIDER and self._provider_has_error(DOUBAO_PROVIDER):
            if not self._credential_ok(SILICONFLOW_PROVIDER):
                err = credentials_error("missing siliconflow credential for fallback")
                route["error"] = err.to_dict()
                return route, []
            route.update(
                provider=SILICONFLOW_PROVIDER,
                protocol="siliconflow",
                model=SILICONFLOW_DEEPSEEK_V3,
                multiplier=1.0,
                tools=False,
                fallback="doubao->siliconflow",
            )
            route["trace"].append(
                {
                    "requested_tier": QUICK_MODE,
                    "effective_tier": QUICK_MODE,
                    "provider": SILICONFLOW_PROVIDER,
                    "model": SILICONFLOW_DEEPSEEK_V3,
                    "fallback_reason": "doubao unavailable",
                    "downgrade_reason": None,
                }
            )
            return route, [{"fallback": "doubao->siliconflow"}]

        if not self._credential_ok(credential_ref):
            err = credentials_error(f"missing credential for {provider}")
            route["error"] = err.to_dict()
            return route, []

        route.update(
            provider=provider,
            protocol=protocol,
            model=model,
            multiplier=1.0,
            tools=False,
        )
        route["trace"].append(
            {
                "requested_tier": QUICK_MODE,
                "effective_tier": QUICK_MODE,
                "provider": provider,
                "model": model,
                "fallback_reason": None,
                "downgrade_reason": None,
            }
        )
        return route, [{"provider": provider, "model": model}]