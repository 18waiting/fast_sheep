"""Fastkey legacy mapper (M11, clean-room). Maps GF-STORE-003 Fastkey keys to
canonical config payload keys.
"""
from __future__ import annotations

from typing import Any, Dict

FASTKEY_MAP: Dict[str, str] = {
    "倒计时时间": "countdown_seconds",
    "AI全托管": "full_auto",
    "单线程监听模式开关": "single_thread_listener",
    "发送前检查新消息": "send_precheck",
    "问答相似度阈值": "similarity_threshold",
    "商品级快速返回相似度阈值": "fast_return_similarity_threshold",
}


def map_fastkey(legacy: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for legacy_key, canonical in FASTKEY_MAP.items():
        if legacy_key in legacy:
            value = legacy[legacy_key]
            if legacy_key == "倒计时时间":
                value = int(value)
            elif legacy_key == "AI全托管":
                value = "full_auto" if value is True else "human_review"
            elif legacy_key in ("单线程监听模式开关", "发送前检查新消息"):
                value = bool(value)
            elif legacy_key in ("问答相似度阈值", "商品级快速返回相似度阈值"):
                value = float(value)
            out[canonical] = value
    return out
