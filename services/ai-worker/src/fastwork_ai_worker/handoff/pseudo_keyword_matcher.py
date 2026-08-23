"""Pseudo-keyword matcher (M9, clean-room). Only spec/fixture-supported pseudo keywords."""
from __future__ import annotations

import re
from typing import Optional
from .types import EvaluationContext

PHONE_RE = re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)")


def match_pseudo_keyword(keyword: str, ctx: EvaluationContext) -> Optional[dict]:
    """Return a match descriptor or None. Unknown pseudo-keywords never silently match.

    Descriptor fields: reason (optional), operator (optional for similarity lt boundary).
    """
    kw = keyword.strip()
    if kw == "【任何消息都转接】":
        return {"reason": "any"}
    if kw == "【已下单】":
        return {"reason": "ordered"} if ctx.order_state == "已下单" else {"operator": "order_mismatch"}
    if kw == "【未下单】":
        return {"reason": "not_ordered"} if ctx.order_state == "未下单" else {"operator": "order_mismatch"}
    if kw == "【手机号】":
        if PHONE_RE.search(ctx.question + " " + ctx.ai_reply):
            return {"reason": "phone"}
        return None
    if kw == "【图片消息】":
        if "图片消息" in ctx.question:
            return {"reason": "image"}
        return None
    m = re.match(r"^【相似度小于([0-9.]+)】$", kw)
    if m:
        threshold = float(m.group(1))
        if ctx.highest_sim < threshold:
            return {"reason": "similarity_lt", "operator": "lt"}
        return {"operator": "lt"}  # boundary not matched: strict <
    return None  # unknown pseudo-keyword: no silent match
