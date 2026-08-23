"""Provider subsystem (TASK-019 M4).

Offline, deterministic provider routing, adapters, mock generation, and
normalization.  No network clients or sockets.
"""
from .generation_provider import GenerationProvider
from .mock_generation_provider import MockGenerationProvider, fingerprint
from .provider_router import ProviderRouter
from .credential_resolver import CredentialResolver, FakeSecretStore
from .result_normalizer import normalize
from .usage_calculator import calculate
from .transport import ProviderTransport
from .mock_transport import MockProviderTransport

__all__ = [
    "GenerationProvider",
    "MockGenerationProvider",
    "fingerprint",
    "ProviderRouter",
    "CredentialResolver",
    "FakeSecretStore",
    "normalize",
    "calculate",
    "ProviderTransport",
    "MockProviderTransport",
]