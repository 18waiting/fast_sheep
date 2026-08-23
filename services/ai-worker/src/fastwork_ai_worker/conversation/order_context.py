"""Order-context resolution (TASK-020 M5): normalized order state + tags (GF-CONV-ORD-*)."""
from __future__ import annotations

from typing import Any, Dict, Optional

TAG_ORDERED = "#已下单"
TAG_NOT_ORDERED = "#未下单"


class OrderContextProvider:
    def resolve(self, request: Dict[str, Any]) -> Dict[str, Any]:
        order_state = request.get("order_state") or "未下单"
        if order_state not in ("未下单", "已下单"):
            order_state = "未下单"
        tags = [TAG_ORDERED] if order_state == "已下单" else [TAG_NOT_ORDERED]
        return {"order_state": order_state, "tags": tags}
