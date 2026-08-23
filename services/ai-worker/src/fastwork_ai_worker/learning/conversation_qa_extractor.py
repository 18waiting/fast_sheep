"""Learning conversation QA extractor (M10): [买家]/[客服] lines -> QA pairs; short/image exclusions."""
from __future__ import annotations

import re
from typing import List, Tuple

LINE_PATTERN = re.compile(r"\[(买家|客服)\](.*)")
IMAGE_PLACEHOLDERS = ("【图片消息】", "【图片消息，，", "【图片")


def extract_qa(chat: str, min_chars: int = 5) -> Tuple[List[dict], List[str]]:
    """Extract (问题, 答案) pairs from a normalized conversation transcript.

    - Lines must look like `[买家]...` / `[客服]...`.
    - Buyer questions shorter than `min_chars` chars are excluded (GF-LEARN-006).
    - Image placeholders are excluded (GF-LEARN-007).
    Returns (qa_pairs, excluded_questions).
    """
    qa: List[dict] = []
    excluded: List[str] = []
    buyer_q = None
    for line in (chat or "").splitlines():
        m = LINE_PATTERN.match(line.strip())
        if not m:
            continue
        role, content = m.group(1), m.group(2).strip()
        if not content:
            continue
        if any(p in content for p in IMAGE_PLACEHOLDERS):
            excluded.append(content)
            continue
        if role == "买家":
            buyer_q = content
        elif role == "客服" and buyer_q is not None:
            if len(buyer_q) < min_chars:
                excluded.append(buyer_q)
            else:
                qa.append({"问题": buyer_q, "答案": content})
            buyer_q = None
    return qa, excluded
