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
│   ├── rollout_mode (OFF | SHADOW | HUMAN_CONFIRM | AUTO)
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

## 5. Format A/B/C 迁移路径

> 本节说明 AI 输入格式的演进策略

### 5.1 三个格式定义

| 格式 | 名称 | 状态 | 用途 |
|------|------|------|------|
| **Format A** | ConversationEngineRequest | ✅ 当前生产 | 当前 AI Worker 接收的输入格式 |
| **Format B** | generation-request | ❌ 已废弃 | 历史格式，文档中有残留 |
| **Format C** | ContextEnvelope | 🎯 未来演进 | 结构化输入，包含 IdentityLock、Facts、Knowledge、Unknowns |

### 5.2 当前状态（2026-09）

- **Format A** 是唯一生产环境使用的格式
- **Format C** Schema 已定义（SHEEP-306 Phase 1 完成）
- **Format B** 已废弃，不应使用

### 5.3 迁移计划

#### Phase 2 (SHEEP-306): Builder 实现
- 实现 ContextEnvelopeBuilder
- Format A 和 C **并行存在**
- Builder 构建 ContextEnvelope，但 Worker 仍然接收 Format A
- 通过 adapter 在两者之间转换
- **不改变生产流程**

#### Phase 3 (SHEEP-307): Worker 支持 ContextEnvelope
- AI Worker 开始接收 Format C
- Format A 作为 **fallback 保留**
- 双格式支持期间

#### Phase 4 (未来): 完全切换到 Format C
- Format A 废弃
- 需要数据迁移脚本
- 所有代码路径切换到 Format C

### 5.4 并行策略

在 Phase 2-3 期间：
1. Orchestrator 同时维护 Format A 和 Format C
2. Worker 优先使用 Format C，失败时 fallback 到 Format A
3. 监控两种格式的生成质量和性能
4. 收集足够数据后决定完全切换时间点

### 5.5 迁移检查清单

- [ ] ContextEnvelopeBuilder 实现并测试
- [ ] SceneClassifier 实现并测试
- [ ] Orchestrator 集成 Builder
- [ ] Worker 支持 ContextEnvelope 输入
- [ ] 并行运行监控
- [ ] 性能对比报告
- [ ] 迁移脚本编写
- [ ] Format A 废弃计划

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

---

## 9. SHEEP-306 Implementation Status (Updated 2026-09-29)

### Phase 1: Contract Definition ✅ COMPLETE

- ContextEnvelope schema defined (`packages/domain/src/context-envelope.ts`)
- ReplyPlan schema defined (`packages/domain/src/reply-plan.ts`)
- TypeScript types mirror JSON Schema definitions
- Contract Schema types use snake_case (JSON-compatible)
- Domain Layer types use richer type information (IdentityResolution<T> wrapper, camelCase)

### Phase 2: Builder + Verifier Implementation ✅ COMPLETE

**Builder (P1-6):**
- `ContextEnvelopeBuilder` service implemented (`apps/desktop/src/main/services/context-envelope-builder.ts`)
- Sub-components:
  - `MinimalSceneClassifier` (scene classification)
  - `StoreKnowledgeRetrievalPort` (knowledge retrieval)
  - `AuthoritativeFactsPort` (fact gathering)
  - `UnknownIdentifier` (explicit unknown marking)
- `SceneEnvelopeAdapter` (P1-7) bridges InboundTurn → Builder input
- `ContextEnvelopeIntegration` (P1-6f) provides shadow-mode integration

**Verifier (P2-8):**
- `ReplyPlanVerifierPort` interface defined (`apps/desktop/src/main/ports/reply-plan-verifier-port.ts`)
- Sub-verifiers:
  - `verifyIdentityLock()` (P2-8b): IdentityLock completeness and validity
  - `verifyFactFreshness()` (P2-8c): Fact reference existence and source validation
- `ReplyPlanVerifier` service class orchestrates sub-verifiers (P2-8d)
- `ReplyPlanVerificationIntegration` provides shadow-mode integration (P2-8e)

**Testing (P2-13):**
- 63 test cases across 5 test files
- Full coverage of Builder, Verifier, and Integration components
- Tests require Node.js v22+ to run (`--experimental-strip-types`)

**MVP Simplifications:**
- Verifier runs in shadow mode (does not block AI reply flow)
- Mock ReplyPlan used (Worker does not yet generate ReplyPlan)
- No timestamp freshness validation (Phase 9 future work)
- No cross-shop consistency checks (Phase 9 future work)

### Phase 3: Worker Integration (Future - SHEEP-307)

- AI Worker accepts ContextEnvelope as input (Format C)
- Worker generates ReplyPlan (replaces Mock ReplyPlan)
- Verifier validates real ReplyPlan before execution
- Format A remains as fallback during transition

### Format Migration Status

| Format | Status | Usage |
|--------|--------|-------|
| Format A (ConversationEngineRequest) | ✅ Active | Current production AI input |
| Format B (generation-request) | ❌ Deprecated | Historical, removed from codebase |
| Format C (ContextEnvelope) | ✅ Implemented | Shadow mode, not yet in production flow |

### Key Architecture Decisions

**D1: Builder/Verifier in Main Process (not Orchestrator package)**
- Orchestrator is a shared package; cannot depend on apps/desktop
- Builder/Verifier integration happens in Main process
- Avoids circular dependencies

**D2: Shadow Mode Integration**
- Builder/Verifier run in shadow mode (fire-and-forget)
- Does not block existing AI reply flow
- Emits events for diagnostics and monitoring
- Allows safe parallel operation during migration

**D3: Port + Adapter Pattern**
- Ports define abstraction boundaries
- Adapters provide concrete implementations
- Pure functions for verifiers (easy to test)
- Dependency injection for testability

**D4: Mock ReplyPlan (MVP)**
- Worker does not yet generate ReplyPlan
- Mock ReplyPlan used for Verifier testing
- Future: Worker generates real ReplyPlan

### File Inventory

**Ports:**
- `apps/desktop/src/main/ports/store-knowledge-retrieval-port.ts`
- `apps/desktop/src/main/ports/authoritative-facts-port.ts`
- `apps/desktop/src/main/ports/reply-plan-verifier-port.ts`

**Adapters:**
- `apps/desktop/src/main/adapters/rpc-store-knowledge-retrieval.ts`
- `apps/desktop/src/main/adapters/stub-authoritative-facts.ts`

**Services:**
- `apps/desktop/src/main/services/context-envelope-builder.ts`
- `apps/desktop/src/main/services/scene-envelope-adapter.ts`
- `apps/desktop/src/main/services/context-envelope-integration.ts`
- `apps/desktop/src/main/services/identity-lock-verifier.ts`
- `apps/desktop/src/main/services/fact-freshness-verifier.ts`
- `apps/desktop/src/main/services/reply-plan-verifier.ts`
- `apps/desktop/src/main/services/reply-plan-verification-integration.ts`
- `apps/desktop/src/main/services/unknown-identifier.ts`

**Tests:**
- `apps/desktop/tests/context-envelope-builder.test.ts` (7 cases)
- `apps/desktop/tests/identity-lock-verifier.test.ts` (15 cases)
- `apps/desktop/tests/fact-freshness-verifier.test.ts` (13 cases)
- `apps/desktop/tests/reply-plan-verifier.test.ts` (12 cases)
- `apps/desktop/tests/context-envelope-integration.test.ts` (16 cases)

### Next Steps

1. **SHEEP-307:** Worker accepts ContextEnvelope, generates ReplyPlan
2. **Phase 9:** Full freshness validation (timestamps, value_snapshot consistency)
3. **Phase 10:** Orchestrator core flow integration (Verifier before sendSuggestion)
4. **Future:** Format A deprecation and cutover to Format C
