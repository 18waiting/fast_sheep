"""Handoff rule model (M9, clean-room). Parses rule dicts into HandoffRule."""
from __future__ import annotations

from typing import Any, Dict
from .types import HandoffRule


def normalize_keyword_separators(value: str) -> str:
    return value.replace("，", ",").replace("＆", "&").replace("&", "&")


def parse_rule(row: Dict[str, Any]) -> HandoffRule:
    """Build a HandoffRule from a rule dict (CSV row or DB transfer_rules row)."""
    keyword = str(row.get("keyword") or row.get("转接关键字") or "")
    transfer_to = str(row.get("transfer_to") or row.get("转接到") or row.get("target") or "")
    transfer_message = str(row.get("transfer_message") or row.get("转接时发条消息") or "")
    work_hours = str(row.get("work_hours") or row.get("工作时间") or "")
    source_agent = str(row.get("source_agent") or row.get("来源客服") or "")
    status = str(row.get("status") or row.get("状态") or "生效")
    order_state = str(row.get("order_state") or row.get("生效下单状态") or "")
    shops = str(row.get("applicable_shops") or row.get("适用店铺") or "")
    try:
        sort_order = int(row.get("sort_order") or row.get("sortOrder") or 0)
    except (TypeError, ValueError):
        sort_order = 0
    enabled = bool(row.get("enabled", True))
    return HandoffRule(
        keyword=keyword,
        transfer_to=transfer_to,
        transfer_message=transfer_message,
        work_hours=work_hours,
        source_agent=source_agent,
        status=status,
        order_state=order_state,
        applicable_shops=shops,
        sort_order=sort_order,
        enabled=enabled,
    )
