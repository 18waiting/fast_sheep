"""Legacy knowledge CSV parser (M11, clean-room).

Parses the canonical 4-column knowledge row 问题,答案,商品ID,标签 using the
standard csv module (quoted commas / BOM / empty rows). Malformed rows are
auto-repaired when possible (GF-STORE-010): a row with too few cells is padded,
extra cells beyond the 4 canonical columns are joined back into 标签.
"""
from __future__ import annotations

import csv
import io as _io
from typing import Any, Dict, List

CANONICAL_HEADERS = ("问题", "答案", "商品ID", "标签")


def parse_knowledge_csv(content: str) -> Dict[str, Any]:
    text = content.lstrip("\ufeff")
    reader = csv.reader(_io.StringIO(text))
    rows: List[List[str]] = [r for r in reader if any(cell.strip() for cell in r)]
    if not rows:
        return {"headers": [], "rows": [], "auto_repair": False, "skipped": 0}
    headers = [h.strip() for h in rows[0]]
    if not headers or headers[0] not in CANONICAL_HEADERS:
        # Treat the first row as a header row with canonical names when it only
        # contains canonical-like tokens; otherwise quarantine.
        if headers[0] in ("问题", "question"):
            headers = list(CANONICAL_HEADERS)
        else:
            return {"headers": [], "rows": [], "auto_repair": False, "skipped": len(rows) - 1, "quarantine": True}
    auto_repair = False
    parsed: List[Dict[str, str]] = []
    skipped = 0
    for raw in rows[1:]:
        cells = [c.strip() for c in raw]
        if len(cells) < 4:
            # auto-repair: pad missing 标签/商品ID
            while len(cells) < 4:
                cells.append("")
            auto_repair = True
        elif len(cells) > 4:
            # join extra cells back into 标签 (never silently drop data)
            cells = cells[:3] + [",".join(cells[3:])]
            auto_repair = True
        if not cells[0] and not cells[1]:
            skipped += 1
            continue
        parsed.append({
            "问题": cells[0], "答案": cells[1], "商品ID": cells[2], "标签": cells[3],
        })
    return {"headers": list(CANONICAL_HEADERS), "rows": parsed, "auto_repair": auto_repair, "skipped": skipped}
