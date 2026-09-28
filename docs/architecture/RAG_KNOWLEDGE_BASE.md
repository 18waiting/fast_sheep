# RAG Knowledge Base Architecture

**Status:** APPROVED
**Created:** 2026-09-28
**Decision:** Merge store_knowledge into RAGEngine

---

## 1. Architecture Overview

### Current State (Before Merge)
```
knowledge_entries (商品知识)
    ↓
KnowledgeRepository → IndexBuilder → FAISS
    ↓
RAGEngine (向量检索)

store_knowledge (店铺规则)
    ↓
StoreKnowledgeRepository (关键词检索)
    ↓
未接入 AI 流程
```

### Target State (After Merge)
```
knowledge_entries (商品知识)
    ↓
    ↓ 合并构建
    ↓
store_knowledge (店铺规则)
    ↓
IndexBuilder → FAISS (统一索引)
    ↓
RAGEngine (向量检索 + 类型过滤)
    ↓
ConversationEngine
```

---

## 2. Design Decisions

### Decision 1: Embedding Text
**Decision:** Use `title + content` for store_knowledge embedding

```python
embedding_text = f"{title}：{content}"
# Example: "发货时间规则：48小时内发货，偏远地区除外"
```

**Rationale:** Most complete context, better retrieval quality

### Decision 2: Knowledge Type in Mapping
**Decision:** Add `knowledge_type` field to FAISS mapping

```python
mapping.append({
    "knowledge_id": entry["id"],
    "knowledge_type": "STORE_RULE",  # or "PRODUCT_KNOWLEDGE"
    "store_knowledge_type": "SHIPPING_TIME",  # if STORE_RULE
    "question": "...",
    "answer": "...",
    ...
})
```

**Rationale:** Clear semantics, aligns with DEC-008 layered architecture

### Decision 3: Retrieval Filtering
**Decision:** Add filter parameters to RAGEngine.retrieve()

```python
engine.retrieve({
    "query": "发货时间",
    "knowledge_type": "STORE_RULE",
    "store_knowledge_type": "SHIPPING_TIME"
})
```

**Rationale:** Efficient (filter during retrieval, not after), clear semantics

---

## 3. Implementation Plan

### Phase 1: Extend IndexBuilder
- Read both `knowledge_entries` and `store_knowledge`
- Embed store_knowledge with `title + content`
- Add `knowledge_type` to mapping
- Build unified FAISS index

### Phase 2: Extend RAGEngine
- Add `knowledge_type` filter parameter to retrieve()
- Add `store_knowledge_type` filter parameter
- Return knowledge_type in results

### Phase 3: Integrate with ConversationEngine
- Call RAGEngine in generate()
- Filter by knowledge_type based on scene
- Merge results into context

---

## 4. Knowledge Type Mapping

| Scene | Knowledge Type | Store Knowledge Type |
|-------|---------------|---------------------|
| SHIPPING_TIME | STORE_RULE | SHIPPING_TIME |
| RETURN_POLICY | STORE_RULE | RETURN_POLICY |
| PRODUCT_INQUIRY | PRODUCT_KNOWLEDGE | - |
| FAQ | STORE_RULE | FAQ |

---

## 5. Migration Strategy

### Backward Compatibility
- Existing `knowledge_entries` workflow unchanged
- New `store_knowledge` workflow added
- Both build into same FAISS index

### Rollout Plan
1. Extend IndexBuilder (non-breaking)
2. Extend RAGEngine (non-breaking, new optional params)
3. Integrate with ConversationEngine (non-breaking)
4. Add tests for store_knowledge retrieval
