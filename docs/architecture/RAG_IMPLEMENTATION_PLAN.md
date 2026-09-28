# RAG Implementation Plan for Store Knowledge

**Date:** 2026-09-28
**Status:** IN PROGRESS
**Goal:** Integrate store_knowledge into unified RAG index

---

## Progress Tracking

| Step | Status | Start | End | Notes |
|------|--------|-------|-----|-------|
| 1. Create adapter | ✅ DONE | 2026-09-28 | 2026-09-28 | store_knowledge_adapter.py |
| 2. Extend index_builder | ✅ DONE | 2026-09-28 | 2026-09-28 | Add store_knowledge loading |
| 3. Extend retriever | ✅ DONE | 2026-09-28 | 2026-09-28 | Add knowledge_type filtering |
| 4. Extend rag_engine | ✅ DONE | 2026-09-28 | 2026-09-28 | Add knowledge_type parameter |
| 5. Integration test | ⏳ PENDING | - | - | End-to-end verification |

---

## Step 1: Create Adapter ✅

**Status:** DONE
**File:** `services/ai-worker/src/fastwork_ai_worker/rag/store_knowledge_adapter.py`
**Date:** 2026-09-28

**What was done:**
- Created StoreKnowledgeAdapter class
- Converts store_knowledge to knowledge_entries format
- Embedding text: title + content
- Special marker: product_id = "STORE_RULE"

**Verification:**
- [x] File created
- [x] Syntax check passed
- [ ] Unit test (deferred to Step 5)

**Next step:** Step 2 - Extend index_builder

---

## Step 2: Extend index_builder ✅

**Status:** DONE
**Date:** 2026-09-28
**File:** `services/ai-worker/src/fastwork_ai_worker/rag/index_builder.py`
**Estimated time:** 30 minutes

**What to do:**
1. Add optional parameters to build_full(): conn, merchant_id
2. Load store_knowledge using StoreKnowledgeAdapter
3. Merge store_knowledge with knowledge_entries
4. Extend mapping structure with knowledge_type fields
5. Classify store_knowledge entries (product_id = "STORE_RULE")

**Changes:**
- Line 68-75: Add parameters to build_full()
- Line 85-95: Load and merge store_knowledge
- Line 145-155: Extend mapping structure

**Verification:**
- [ ] Syntax check
- [ ] Type check (if applicable)
- [ ] Unit test (deferred to Step 5)

**Risk:** Low (backward compatible, optional parameters)

**Next step:** Step 3 - Extend retriever

---

## Step 3: Extend retriever ✅

**Status:** DONE
**Date:** 2026-09-28
**File:** `services/ai-worker/src/fastwork_ai_worker/rag/retriever.py`
**Estimated time:** 20 minutes

**What to do:**
1. Add knowledge_type parameter to retrieve()
2. Pass knowledge_type to _search_tier()
3. Filter mapping by knowledge_type in _search_tier()
4. Extend RawHit structure with knowledge_type fields

**Changes:**
- Line 20-30: Extend _search_tier() signature
- Line 35-45: Add knowledge_type filter logic
- Line 55-65: Extend retrieve() signature
- types.py: Extend RawHit dataclass

**Verification:**
- [ ] Syntax check
- [ ] Type check (if applicable)
- [ ] Unit test (deferred to Step 5)

**Risk:** Low (backward compatible, optional parameters)

**Next step:** Step 4 - Extend rag_engine

---

## Step 4: Extend rag_engine ✅

**Status:** DONE
**Date:** 2026-09-28
**File:** `services/ai-worker/src/fastwork_ai_worker/rag/rag_engine.py`
**Estimated time:** 10 minutes

**What to do:**
1. Add knowledge_type parameter to retrieve()
2. Extract knowledge_type from request
3. Pass knowledge_type to Retriever.retrieve()

**Changes:**
- Line 45-55: Extract knowledge_type from request
- Line 60-70: Pass to retriever.retrieve()

**Verification:**
- [ ] Syntax check
- [ ] Type check (if applicable)
- [ ] Unit test (deferred to Step 5)

**Risk:** Low (backward compatible, optional parameters)

**Next step:** Step 5 - Integration test

---

## Step 5: Integration Test ⏳

**Status:** PENDING
**Estimated time:** 30 minutes

**What to do:**
1. Create test store_knowledge entries
2. Build index with both knowledge_entries and store_knowledge
3. Test retrieval with knowledge_type filter
4. Test backward compatibility (no filter)
5. Verify mapping contains knowledge_type fields

**Test cases:**
- [ ] Index building with store_knowledge
- [ ] Retrieval with knowledge_type="STORE_RULE"
- [ ] Retrieval with knowledge_type="PRODUCT_KNOWLEDGE"
- [ ] Retrieval without filter (backward compatibility)
- [ ] Mapping structure verification

**Verification:**
- [ ] All tests pass
- [ ] No regression in existing functionality
- [ ] Store knowledge can be retrieved

**Next step:** Complete - Submit for review

---

## Rollback Plan

If any step fails:
1. Revert the modified file
2. Investigate the issue
3. Fix and retry
4. All changes are backward compatible, so rollback is safe

---

## Success Criteria

1. ✅ Store knowledge can be indexed alongside product knowledge
2. ✅ Store knowledge can be retrieved with knowledge_type filter
3. ✅ Existing functionality remains unchanged
4. ✅ All tests pass
5. ✅ No regression

---

## Notes

- All changes are backward compatible
- New parameters are optional with sensible defaults
- Store knowledge uses special marker (product_id = "STORE_RULE")
- Mapping structure extended with optional fields
