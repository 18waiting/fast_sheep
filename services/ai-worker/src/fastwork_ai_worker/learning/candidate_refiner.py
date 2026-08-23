"""Learning candidate refiner (M10): AI QA generation via mock provider; fallback to parsed pairs."""
from __future__ import annotations

from typing import Any, Dict, List

from .conversation_qa_extractor import extract_qa
from .errors import LearningError


def generate_qa(segment: Dict[str, Any], generation_provider: Any) -> List[Dict[str, Any]]:
    content = str(segment.get("content") or "")
    parsed, _ = extract_qa(content)
    qa: List[Dict[str, Any]] = []
    try:
        if hasattr(generation_provider, "generate_reply"):
            result = generation_provider.generate_reply({"task": "qa", "segment": content})
        else:
            result = generation_provider.generate({"prompt": "qa", "segment": content})
        if result is not None and result.get("error"):
            raise LearningError("learning.provider_failure", str(result.get("error")))
        mock_qa = (result or {}).get("qa") or []
        for item in mock_qa:
            qa.append({"问题": str(item.get("q") or "").replace("<标签>", ""), "答案": str(item.get("a") or "")})
    except LearningError:
        raise
    except Exception:
        pass
    if not qa:
        qa = parsed
    return qa
