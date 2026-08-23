"""Learning candidate builder (M10): dedup + frequency grouping.

Canonical implementations live in candidate_deduplicator.py and
candidate_frequency.py; this module re-exports them for compatibility.
"""
from .candidate_deduplicator import dedup_qa  # noqa: F401
from .candidate_frequency import frequency_groups  # noqa: F401
