"""M5 ConversationEngine (TASK-020): composes M3 RAG + M4 Prompt/Provider/Tool via DI.

No HandoffPolicyEngine (only a HandoffDecisionPort); no forbidden filtering here
(Main pre-send owns it); no real platform/provider calls.
"""
from .conversation_engine import ConversationEngine
from .composition import build_default_engine

__all__ = ["ConversationEngine", "build_default_engine"]
