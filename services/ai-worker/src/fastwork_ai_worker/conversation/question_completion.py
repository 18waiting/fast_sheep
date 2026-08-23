"""Question-completion boundary (TASK-020 M5): port + deterministic mock. No live model."""
from __future__ import annotations

from typing import Any, Dict, List, Optional


class QuestionCompletionPort:
    def complete(self, question: str, history: Optional[List[Dict[str, Any]]] = None) -> str:
        return question


class MockQuestionCompletionPort(QuestionCompletionPort):
    def __init__(self, completed_question: Optional[str] = None):
        self.completed_question = completed_question

    def complete(self, question: str, history: Optional[List[Dict[str, Any]]] = None) -> str:
        return self.completed_question or question
