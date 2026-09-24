# Reply Plan Evolution Path

> Status: LOCKED ARCHITECTURE AUTHORITY
> Document version: 1.0
> Owner: Fast Sheep architecture authority
> SHEEP-306 implementation
> Supersedes: None (this is new architecture)

This document defines the evolution path from current reply structures
(Suggestion, SendCommand) to the governed ContextEnvelope + ReplyPlan
architecture.

---

## 1. Single-Source Principle

The architecture preserves the single-source principle:

**The canonical reply proposal model evolves; it is not duplicated.**

- `ReplyPlan` is the governed evolution/replacement direction of `Suggestion`
- `ActionPlan` is the governed evolution/replacement direction of `SendCommand`
- These are NOT second competing models; they are the canonical evolution path

---

## 2. Current State (Pre-SHEEP-306)

### Suggestion (Current)

```json
{
  "suggestion_id": "...",
  "conversation_id": "...",
  "generation": 0,
  "reply": "纯文本回复",
  "referenced_knowledge": [...],
  "decision": {...},
  "mode": "human_review | full_auto",
  "usage": {...},
  "created_at": "..."
}
```

**Limitations:**
- No identity lock (implicit, not structural)
- No scene classification
- No distinction between facts, knowledge, and inference
- No explicit unknowns
- No verification requirements
- No policy metadata

### SendCommand (Current)

```json
{
  "send_id": "...",
  "conversation_id": "...",
  "shop_id": "...",
  "platform": "...",
  "segments": [...],
  "transfer": {...},
  "idempotency_key": "..."
}
```

**Limitations:**
- No identity lock validation
- No fact validation
- No verification requirements
- No audit trail

---

## 3. Target State (Post-SHEEP-306)

### ContextEnvelope (Input to AI)

```
ContextEnvelope
├── envelope_id
├── conversation_id
├── identity_lock (immutable identity scope)
│   ├── merchant_id
│   ├── store_id
│   ├── platform
│   ├── platform_account_id
│   ├── customer_identity (customerUid for PDD)
│   ├── conversation_id
│   └── trigger_message_id
├── scene (classified scene)
├── trigger_message (inbound message)
├── authoritative_facts
│   ├── shop_facts (provenanced)
│   ├── product_facts (provenanced)
│   ├── order_facts (provenanced)
│   ├── logistics_facts (provenanced)
│   └── knowledge_facts (provenanced, DEC-008 layer 3)
├── retrieved_knowledge (from Store Knowledge, product knowledge)
├── conversation_context (recent turns)
└── explicit_unknowns (blocking unknowns)
```

**Key Properties:**
- Identity lock is structural, not implicit
- Facts carry provenance (source, confidence, retrieval time)
- Knowledge is shop-scoped before multi-shop AUTO
- Unknowns are explicit, not hidden

### ReplyPlan (Output from AI)

```
ReplyPlan
├── plan_id
├── envelope_ref (ContextEnvelope reference)
├── identity_lock (inherited from envelope)
├── scene (inherited from envelope)
├── trigger_message (inherited from envelope)
├── reply_content
│   ├── text
│   ├── language
│   └── segments (structured segments)
├── fact_references (authoritative facts used)
├── knowledge_references (retrieved knowledge used)
├── inference_references (AI inferences, distinguished from facts)
├── policy_metadata
│   ├── rollout_mode (SHADOW | HUMAN_CONFIRM | AUTO)
│   ├── requires_confirmation
│   ├── risk_level
│   └── applicable_policies
├── verification_requirements
│   ├── identity_lock_valid
│   ├── facts_validated
│   └── required_verifications
└── unknowns (affect execution authorization)
```

**Key Properties:**
- Facts, knowledge, and inference are structurally distinguished
- AI inference MUST NOT silently become an authoritative fact
- Verification requirements are explicit
- Policy metadata governs execution path

---

## 4. Evolution Mapping

### Suggestion → ReplyPlan

| Suggestion Field | ReplyPlan Field | Notes |
|------------------|-----------------|-------|
| `suggestion_id` | `plan_id` | Renamed for clarity |
| `conversation_id` | `identity_lock.conversation_id` | Moved into identity lock |
| `generation` | `identity_lock.generation` | Moved into identity lock |
| `reply` | `reply_content.text` | Structured into reply content |
| `referenced_knowledge` | `knowledge_references` | Enhanced with provenance |
| `decision` | `policy_metadata` | Expanded to full policy metadata |
| `mode` | `policy_metadata.rollout_mode` | Renamed and expanded |
| `usage` | (removed) | Not part of reply plan |
| (none) | `identity_lock` | **NEW**: Structural identity scope |
| (none) | `scene` | **NEW**: Scene classification |
| (none) | `trigger_message` | **NEW**: Trigger binding |
| (none) | `fact_references` | **NEW**: Authoritative fact references |
| (none) | `inference_references` | **NEW**: AI inference tracking |
| (none) | `verification_requirements` | **NEW**: Pre-execution verification |
| (none) | `unknowns` | **NEW**: Explicit unknowns |

### SendCommand → ActionPlan (Future)

ActionPlan is the evolution of SendCommand. It will include:
- Identity lock validation
- Fact validation
- Verification requirements
- Audit trail
- Execution result tracking

**Note:** ActionPlan schema is future work (post-SHEEP-306).

---

## 5. Migration Strategy

### Phase 1: Contract Definition (SHEEP-306)

- Define ContextEnvelope schema ✓
- Define ReplyPlan schema ✓
- Establish evolution path documentation ✓
- No runtime changes

### Phase 2: Parallel Operation (Future)

- AI Worker generates both Suggestion and ReplyPlan
- ReplyPlan is validated but not used for execution
- Suggestion remains authoritative for execution
- Compare and validate ReplyPlan correctness

### Phase 3: Cutover (Future)

- ReplyPlan becomes authoritative for execution
- Suggestion is deprecated
- Migration of existing code paths
- Full identity lock and fact validation enforcement

---

## 6. Invariants

1. **Single-Source Principle**: ReplyPlan is the canonical evolution; no competing models
2. **Identity Lock**: Structural, not implicit; validated before execution
3. **Fact/Inference Boundary**: AI inference MUST NOT silently become an authoritative fact
4. **Explicit Unknowns**: Unknowns are explicit, not hidden; they block execution when required
5. **Verification Requirements**: Pre-execution verification is structural, not optional

---

## 7. References

- Architecture: `docs/architecture/AI_CUSTOMER_SERVICE_CORE.md` §5, §6
- Safety: `docs/architecture/REPLY_AND_ACTION_SAFETY.md`
- Knowledge: `docs/architecture/AI_CUSTOMER_SERVICE_CORE.md` §8 (DEC-008)
- SHEEP-305: Store Knowledge Pipeline (DEC-008 layer 3)
- SHEEP-306: ContextEnvelope and ReplyPlan Contract Evolution

---

## 8. Decision Record

**Decision**: Adopt ContextEnvelope + ReplyPlan as the canonical reply architecture

**Rationale**:
- Current Suggestion/SendCommand lack structural identity, fact provenance, and verification
- AI inference must be distinguished from authoritative facts
- Multi-shop AUTO requires explicit identity and scope validation
- Safety invariants require structural enforcement, not implicit assumptions

**Impact**:
- SHEEP-306: Contract definition only (no runtime changes)
- Future phases: Parallel operation, then cutover
- Existing Suggestion/SendCommand remain authoritative until cutover

**Approved by**: Fast Sheep architecture authority
**Date**: 2026-09-24
