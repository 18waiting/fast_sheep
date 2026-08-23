"""Normalized provider errors (TASK-019 M4).

Codes and category/retryable flags are the clean-room provider layer's public
error contract.  No credential values, raw HTTP bodies, or tracebacks ever go
into these envelopes.
"""
from __future__ import annotations

from typing import Any, Dict, Optional


class ProviderError(Exception):
    """A normalized provider error that can be carried through the router."""

    def __init__(
        self,
        code: str,
        message: str,
        category: str = "provider",
        retryable: bool = False,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.category = category
        self.retryable = retryable
        self.details = details or {}

    def to_dict(self) -> Dict[str, Any]:
        out: Dict[str, Any] = {
            "code": self.code,
            "category": self.category,
            "message": self.message,
            "retryable": self.retryable,
        }
        if self.details:
            out["details"] = self.details
        return out


# Public error codes used by fixtures/tests.
CODE_UNKNOWN_API_FORMAT = "unknown_api_format"
CODE_INVALID_CUSTOM_CONFIG = "invalid_custom_config"
CODE_MISSING_CREDENTIAL = "missing_credential"
CODE_UNKNOWN_PROTOCOL = "unknown_protocol"
CODE_PROVIDER_ERROR = "provider.error"
CODE_PROVIDER_TIMEOUT = "provider.timeout"
CODE_INVALID_RESPONSE = "provider.invalid_response"
CODE_NO_CONTENT_OR_TOOLS = "provider.no_content_or_tools"


def error_result(
    code: str,
    category: str,
    message: str,
    retryable: bool = False,
    details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return ProviderError(code, message, category, retryable, details).to_dict()


def config_error(
    message: str,
    code: str = CODE_INVALID_CUSTOM_CONFIG,
    retryable: bool = False,
    details: Optional[Dict[str, Any]] = None,
) -> ProviderError:
    return ProviderError(code, message, category="config", retryable=retryable, details=details)


def credentials_error(
    message: str = "required credential is missing",
    code: str = CODE_MISSING_CREDENTIAL,
    retryable: bool = False,
) -> ProviderError:
    return ProviderError(code, message, category="credentials", retryable=retryable)


def provider_error(
    message: str,
    code: str = CODE_PROVIDER_ERROR,
    retryable: bool = True,
) -> ProviderError:
    return ProviderError(code, message, category="provider", retryable=retryable)


def timeout_error(message: str = "provider call timed out") -> ProviderError:
    return ProviderError(CODE_PROVIDER_TIMEOUT, message, category="timeout", retryable=True)


def invalid_response(message: str = "provider returned an invalid response") -> ProviderError:
    return ProviderError(CODE_INVALID_RESPONSE, message, category="provider", retryable=True)


def no_content_or_tools(message: str = "provider response has no content or tool calls") -> ProviderError:
    return ProviderError(CODE_NO_CONTENT_OR_TOOLS, message, category="provider", retryable=True)


def unknown_api_format(api_format: Any) -> ProviderError:
    return config_error(
        f"unknown api_format: {api_format!r}",
        code=CODE_UNKNOWN_API_FORMAT,
        retryable=False,
    )