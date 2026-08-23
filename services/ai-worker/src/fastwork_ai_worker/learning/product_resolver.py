"""Learning product resolver (M10): extract product ids from normalized chat."""
from __future__ import annotations

import re
from typing import List

PRODUCT_PATTERN = re.compile(r"===商品id(\d+)[=]?")


def resolve_products(chat: str) -> List[str]:
    products: List[str] = []
    seen = set()
    for m in PRODUCT_PATTERN.finditer(chat or ""):
        pid = m.group(1)
        if pid and pid not in seen:
            seen.add(pid)
            products.append(pid)
    return products
