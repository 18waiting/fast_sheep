# RAG Extension Design for Store Knowledge

**Date:** 2026-09-28
**Status:** APPROVED
**Decision:** Minimal extension to support store_knowledge in unified RAG index

---

## 1. Design Principles

1. **Minimal changes**: Only modify what's necessary
2. **Backward compatible**: Existing functionality must not break
3. **Optional parameters**: New parameters are optional with sensible defaults
4. **Clear separation**: Store knowledge uses special markers (product_id = "STORE_RULE")

---

## 2. Files to Modify

| File | Changes | Risk |
|------|---------|------|
| index_builder.py | Add store_knowledge loading, extend mapping | Low |
| retriever.py | Add knowledge_type filtering | Low |
| rag_engine.py | Add knowledge_type parameter | Low |
| index_repository.py | No changes needed | None |

---

## 3. Files to Add

| File | Purpose |
|------|---------|
| store_knowledge_adapter.py | Adapt store_knowledge to knowledge_entries format (✅ DONE) |

---

## 4. Detailed Changes

### 4.1 index_builder.py

**Change 1: Add store_knowledge loading**
```python
def build_full(
    self,
    entries: List[Dict[str, Any]],
    data_root: str,
    conn: Optional[sqlite3.Connection] = None,  # NEW
    merchant_id: Optional[str] = None,          # NEW
) -> Dict[str, Any]:
    # Load store_knowledge if connection provided
    store_entries = []
    if conn is not None:
        from .store_knowledge_adapter import StoreKnowledgeAdapter
        adapter = StoreKnowledgeAdapter(conn)
        store_entries = adapter.fetch_store_knowledge(merchant_id)
    
    # Merge entries
    all_entries = entries + store_entries
    
    # Continue with existing logic...
```

**Change 2: Extend mapping structure**
```python
mapping.append({
    "faiss_id": int(fid),
    "entry_id": e.get("id"),
    "question": e.get("question", ""),
    "answer": e.get("answer", ""),
    "product_id": e.get("product_id", ""),
    "source": e.get("source", ""),
    "tags": e.get("tags") or [],
    # NEW FIELDS
    "knowledge_type": e.get("knowledge_type", "PRODUCT_KNOWLEDGE"),
    "store_knowledge_type": e.get("store_knowledge_type"),
})
```

**Change 3: Classify store_knowledge separately**
```python
def _build_into(self, staging: str, entries: List[Dict[str, Any]], faiss_mod) -> None:
    common: List[Dict[str, Any]] = []
    by_product: Dict[str, List[Dict[str, Any]]] = {}
    store_rules: List[Dict[str, Any]] = []  # NEW
    
    for e in entries:
        pid = e.get("product_id", "")
        if pid == "STORE_RULE":  # NEW
            store_rules.append(e)
        elif pid == COMMON_PRODUCT_ID:
            common.append(e)
        elif pid:
            by_product.setdefault(pid, []).append(e)
    
    # Build store_rules index (treated as common)
    common = common + store_rules  # Merge into common
    
    # Continue with existing logic...
```

### 4.2 retriever.py

**Change 1: Add knowledge_type parameter**
```python
def retrieve(
    self,
    query_vector: np.ndarray,
    product_id: Optional[str],
    top_k: int,
    knowledge_isolation: Optional[bool] = None,
    knowledge_type: Optional[str] = None,  # NEW
) -> TieredRetrieval:
    # Pass knowledge_type to _search_tier
    common = self._search_tier("common", query_vector, top_k, knowledge_type=knowledge_type)
    # ...
```

**Change 2: Filter by knowledge_type in _search_tier**
```python
def _search_tier(
    self,
    kind: str,
    query_vector: np.ndarray,
    top_k: int,
    product_id: Optional[str] = None,
    knowledge_type: Optional[str] = None,  # NEW
) -> List[RawHit]:
    hits: List[RawHit] = []
    # ... existing search logic ...
    
    for faiss_id, score in pairs:
        # ... existing threshold check ...
        m = self.repo.resolve_entry(kind, faiss_id, product_id=product_id)
        if m is None:
            continue
        
        # NEW: Filter by knowledge_type
        if knowledge_type and m.get("knowledge_type") != knowledge_type:
            continue
        
        hits.append(RawHit(...))
```

**Change 3: Extend RawHit structure**
```python
# In types.py
@dataclass
class RawHit:
    entry_id: str
    question: str
    answer: str
    product_id: str
    source: str
    tags: list
    faiss_id: int
    raw_similarity: float
    tier: str
    # NEW FIELDS
    knowledge_type: str = "PRODUCT_KNOWLEDGE"
    store_knowledge_type: Optional[str] = None
```

### 4.3 rag_engine.py

**Change 1: Add knowledge_type parameter**
```python
def retrieve(self, request: Dict[str, Any]) -> Dict[str, Any]:
    # ... existing validation ...
    
    knowledge_type = request.get("knowledge_type")  # NEW
    
    # Pass to retriever
    tr = self.retriever.retrieve(
        query_vector,
        product_id,
        top_k,
        knowledge_isolation=isolation,
        knowledge_type=knowledge_type,  # NEW
    )
    
    # ... rest of existing logic ...
```

---

## 5. Backward Compatibility

1. **New parameters are optional**: All new parameters default to None
2. **Default knowledge_type**: Defaults to "PRODUCT_KNOWLEDGE" for existing entries
3. **Existing logic unchanged**: product_id logic remains the same
4. **Store knowledge uses marker**: product_id = "STORE_RULE" is a special marker

---

## 6. Testing Strategy

1. **Unit tests**: Test each modified function
2. **Integration tests**: Test end-to-end retrieval
3. **Backward compatibility tests**: Ensure existing functionality works
4. **Store knowledge tests**: Test store_knowledge indexing and retrieval

---

## 7. Rollout Plan

1. **Phase 1**: Extend index_builder.py (non-breaking)
2. **Phase 2**: Extend retriever.py (non-breaking)
3. **Phase 3**: Extend rag_engine.py (non-breaking)
4. **Phase 4**: Add tests
5. **Phase 5**: Deploy and monitor
