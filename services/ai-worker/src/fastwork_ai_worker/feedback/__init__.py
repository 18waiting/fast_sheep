"""M9 feedback package (TASK-024): worker-side knowledge effect application."""
from .knowledge_feedback_service import KnowledgeFeedbackService
from .effect_mapper import map_effect, entry_for, KnowledgeEffect
from .types import FeedbackApplyRequest, FeedbackApplyResult
from .errors import FeedbackError

__all__ = ["KnowledgeFeedbackService", "map_effect", "entry_for", "KnowledgeEffect", "FeedbackApplyRequest", "FeedbackApplyResult", "FeedbackError"]
