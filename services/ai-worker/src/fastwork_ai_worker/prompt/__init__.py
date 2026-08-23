"""M4 prompt subsystem (TASK-019).

Deterministic, offline prompt selection, skill-mount resolution, budget
truncation, and assembly. No provider/LLM calls and no proprietary prompt prose.
"""
from .prompt_engine import PromptEngine
from .prompt_assembler import assemble
from .prompt_budgeter import budget_decide
from .prompt_selector import select_profile, select_profile_decision
from .skill_mount_resolver import resolve_decision, resolve_mounted_skills

__all__ = [
    "PromptEngine",
    "assemble",
    "budget_decide",
    "select_profile",
    "select_profile_decision",
    "resolve_decision",
    "resolve_mounted_skills",
]
