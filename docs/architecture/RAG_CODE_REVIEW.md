# RAG System Code Review

**Date:** 2026-09-28
**Reviewer:** Codex
**Purpose:** Understand existing RAG architecture before extending for store_knowledge

---

## 1. File Overview

| File | Lines | Responsibility |
|------|-------|----------------|
| index_builder.py | 168 | Build FAISS indexes from knowledge entries |
| index_repository.py | 227 | Load/cache/search FAISS indexes |
| rag_engine.py | 103 | Orchestrate RAG flow (embed -> retrieve -> dedupe -> rerank -> filter) |
| retriever.py | 115 | Tiered retrieval (common -> product -> global) |

---

## 2. Data Flow

```
knowledge_entries (SQLite)
    ↓
KnowledgeRepository.list()
    ↓
IndexBuilder.build_full(entries, data_root)
    ↓
FAISS Indexes (global/common/product)
    ↓
IndexRepository (load + cache)
    ↓
Retriever.retrieve(query_vector, product_id, top_k)
    ↓
RAGEngine.retrieve(request)
    ↓
ConversationEngine
```

---

## 3. Key Structures

### 3.1 Knowledge Entry (from knowledge_entries table)
```python
{
    "id": str,
    "question": str,      # Used for embedding
    "answer": str,        # Used for display
    "product_id": str,    # "1" = common, other = product-specific
    "tags": list,
    "source": str,
    "trust_level": str,
    "created_at": str,
    "updated_at": str
}
```

### 3.2 FAISS Mapping
```python
{
    "faiss_id": int,
    "entry_id": str,
    "question": str,
    "answer": str,
    "product_id": str,
    "source": str,
    "tags": list
}
```

### 3.3 RawHit (retrieval result)
```python
{
    "entry_id": str,
    "question": str,
    "answer": str,
    "product_id": str,
    "source": str,
    "tags": list,
    "faiss_id": int,
    "raw_similarity": float,
    "tier": str  # "common" | "product" | "global"
}
```

---

## 4. Index Types

| Type | Scope | Product ID | Use Case |
|------|-------|------------|----------|
| global | All entries | All | Fallback when common/product empty |
| common | Shared entries | "1" | General knowledge |
| product | Product-specific | Specific ID | Product-specific knowledge |

---

## 5. Retrieval Strategy

1. **Common tier**: Search common index (product_id == "1")
2. **Product tier**: Search product index (if product_id exists and != "1")
3. **Global tier**: Search global index (if not isolated)
4. **Merge & dedupe**: Merge all hits, dedupe by entry_id

---

## 6. Extension Points for Store Knowledge

### 6.1 IndexBuilder
- ✅ Can extend `_build_into` to classify store_knowledge entries
- ✅ Can extend mapping structure to add `knowledge_type` field
- ⚠️ Need to maintain backward compatibility

### 6.2 IndexRepository
- ✅ Can extend `search` to filter by knowledge_type
- ✅ Can extend `resolve_entry` to return knowledge_type
- ⚠️ Need to maintain backward compatibility

### 6.3 Retriever
- ✅ Can extend `_search_tier` to filter by knowledge_type
- ✅ Can extend `retrieve` to accept knowledge_type parameter
- ✅ Can extend RawHit to include knowledge_type
- ⚠️ Need to maintain backward compatibility

### 6.4 RAGEngine
- ✅ Can extend `retrieve` to accept knowledge_type filter
- ✅ Can pass knowledge_type to Retriever
- ⚠️ Need to maintain backward compatibility

---

## 7. Backward Compatibility Strategy

1. **New fields are optional**: knowledge_type defaults to "PRODUCT_KNOWLEDGE"
2. **New parameters are optional**: knowledge_type filter is optional
3. **Existing logic unchanged**: product_id logic remains the same
4. **Store knowledge uses special product_id**: "STORE_RULE" marker

---

## 8. Implementation Plan

### Phase 1: Extend IndexBuilder
1. Add store_knowledge_adapter.py (✅ DONE)
2. Modify index_builder.py to load store_knowledge
3. Extend mapping structure with knowledge_type field
4. Classify store_knowledge entries separately

### Phase 2: Extend Retriever
1. Add knowledge_type parameter to retrieve()
2. Filter mapping by knowledge_type in _search_tier()
3. Add knowledge_type to RawHit structure

### Phase 3: Extend RAGEngine
1. Add knowledge_type parameter to retrieve()
2. Pass knowledge_type to Retriever
3. Update request schema

### Phase 4: Integration Test
1. Test store_knowledge indexing
2. Test store_knowledge retrieval
3. Test backward compatibility
