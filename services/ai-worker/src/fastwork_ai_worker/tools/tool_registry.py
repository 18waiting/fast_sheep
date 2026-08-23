"""In-memory registry for declarative skills and built-in tools."""
from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional

from .tool_definition_builder import from_skill
from .types import ToolDefinition


class ToolRegistry:
    """Store tool definitions and (for built-ins) their callable handlers."""

    def __init__(self) -> None:
        self._tools: Dict[str, ToolDefinition] = {}
        self._handlers: Dict[str, Callable[[Dict[str, Any]], Any]] = {}

    def register_skill(self, skill: Dict[str, Any]) -> ToolDefinition:
        """Register a declarative skill.

        A skill dict may additionally carry a ``handler`` callable used by
        tests and built-ins; the handler is stored alongside the definition.
        """
        definition = from_skill(skill)
        if not definition.name:
            raise ValueError("skill is missing a name")
        self._tools[definition.name] = definition
        handler = skill.get("handler") if isinstance(skill, dict) else None
        if callable(handler):
            self._handlers[definition.name] = handler
        return definition

    def register_builtin(
        self,
        name: str,
        handler: Callable[[Dict[str, Any]], Any],
        description: str = "",
    ) -> ToolDefinition:
        """Register an in-process built-in tool handler."""
        if not callable(handler):
            raise TypeError("handler must be callable")
        definition = ToolDefinition(
            name=name,
            description=description,
            skill_type="builtin",
            body=description,
        )
        self._tools[name] = definition
        self._handlers[name] = handler
        return definition

    def get(self, name: str) -> Optional[ToolDefinition]:
        return self._tools.get(name)

    def names(self) -> List[str]:
        return list(self._tools.keys())

    def get_handler(self, name: str) -> Optional[Callable[[Dict[str, Any]], Any]]:
        return self._handlers.get(name)

