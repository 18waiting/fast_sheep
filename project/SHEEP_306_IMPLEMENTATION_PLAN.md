# SHEEP-306 P0-P2 问题解决实施计划

> **Status:** PLANNED  
> **Created:** 2026-09-29  
> **Owner:** Fast Sheep architecture authority  
> **Related:** SHEEP-306, REPLY_PLAN_EVOLUTION.md

---

## 总体策略

```
Phase 1: 治理和文档 (P0) → 2 天
Phase 2: 类型定义 (P1-5) → 1 天
Phase 3: Builder 实现 (P1-6) → 7 天
Phase 4: Verification 实现 (P2-13) → 5.5 天
Phase 5: 集成和测试 → 3 天
总计: 18.5 天
```

---

## Phase 1: 治理和文档（P0）

### 1.1 更新 PROJECT_STATE.json（P0-1）

**目标**：明确 SHEEP-306 的真实状态

**任务**：
1. 修改 `project/PROJECT_STATE.json`
2. 区分三个阶段的状态：
   - `SHEEP-306-Phase1-Contract`: COMPLETE
   - `SHEEP-306-Phase2-Builder`: NOT_STARTED
   - `SHEEP-306-Phase3-Consumer`: NOT_STARTED
3. 更新 `next_action`，说明当前可以开始 Phase 2

**输入**：当前 PROJECT_STATE.json  
**输出**：更新后的 PROJECT_STATE.json  
**验证标准**：
- JSON 格式正确
- 状态描述清晰，无歧义
- next_action 明确指向 Phase 2

**工作量**：0.5 天

---

### 1.2 明确 Format 迁移路径（P0-4）

**目标**：说明 Format A → Format C 的迁移策略

**任务**：
1. 在 `docs/architecture/REPLY_PLAN_EVOLUTION.md` 中添加迁移路径说明
2. 明确：
   - Format A (ConversationEngineRequest) 是当前生产环境使用的格式
   - Format C (ContextEnvelope) 是未来演进方向
   - Format B (generation-request) 已废弃
3. 说明迁移时机：Phase 2 实施时开始并行，Phase 3 完成切换

**输入**：REPLY_PLAN_EVOLUTION.md  
**输出**：更新后的 REPLY_PLAN_EVOLUTION.md  
**验证标准**：
- 迁移路径清晰
- 时间节点明确
- 无歧义

**工作量**：0.5 天

---

### 1.3 统一 RolloutMode 词汇（P1-7）

**目标**：统一到 PDD_MVP_V1.md 的定义

**任务**：
1. 修改 `resources/contracts/schemas/domain/reply-plan.schema.json`
2. 在 `PolicyMetadata.rollout_mode` 的 enum 中添加 `OFF`
3. 在 REPLY_PLAN_EVOLUTION.md 中添加词汇映射表：
   - `human_review` → `HUMAN_CONFIRM`
   - `full_auto` → `AUTO`
   - `off` → `OFF`

**输入**：reply-plan.schema.json, PDD_MVP_V1.md  
**输出**：更新后的 schema 和文档  
**验证标准**：
- Schema 验证通过
- 词汇映射表完整
- 与 PDD_MVP_V1.md 一致

**工作量**：0.5 天

---

### 1.4 统一 knowledge_type 分类（P1-8）

**目标**：统一两层分类体系

**任务**：
1. 修改 `resources/contracts/schemas/domain/context-envelope.schema.json`
2. 在 `RetrievedKnowledge` 中添加 `store_knowledge_type` 字段
3. 修改 `knowledge_type` 的 enum 为 `["PRODUCT_KNOWLEDGE", "STORE_RULE"]`
4. 添加 `store_knowledge_type` 的 enum 为 `["SHIPPING_TIME", "RETURN_POLICY", "FAQ", "OTHER"]`
5. 更新测试用例

**输入**：context-envelope.schema.json, Python RAG 代码  
**输出**：更新后的 schema 和测试  
**验证标准**：
- Schema 验证通过
- 测试用例全部通过
- 与 Python 实现一致

**工作量**：0.5 天

---

## Phase 2: 类型定义（P1-5）

### 2.1 创建 TypeScript 类型定义

**目标**：为 ContextEnvelope 和 ReplyPlan 创建 TypeScript 类型

**任务**：
1. 创建 `packages/contracts/src/generated/context-envelope.ts`
2. 创建 `packages/contracts/src/generated/reply-plan.ts`
3. 从 JSON Schema 镜像 TypeScript 接口
4. 添加 JSDoc 注释

**输入**：context-envelope.schema.json, reply-plan.schema.json  
**输出**：两个 TypeScript 文件  
**验证标准**：
- TypeScript 编译通过
- 类型与 Schema 一致
- JSDoc 注释完整

**工作量**：1 天

---

## Phase 3: Builder 实现（P1-6）

### 3.1 实现 SceneClassifier

**目标**：实现场景分类器

**任务**：
1. 创建 `apps/desktop/src/main/services/scene-classifier.ts`
2. 定义 Scene 枚举：
   - `SHIPPING_TIME` — 发货时间咨询
   - `PRODUCT_INQUIRY` — 商品咨询
   - `ORDER_STATUS` — 订单状态查询
   - `RETURN_POLICY` — 退货政策咨询
   - `GENERAL` — 一般咨询
3. 实现基于规则的分类逻辑（MVP 阶段）
4. 添加单元测试

**输入**：消息文本  
**输出**：Scene 枚举值  
**验证标准**：
- 分类准确率 > 80%
- TypeScript 编译通过
- 单元测试通过

**工作量**：1 天

---

### 3.2 实现 ContextEnvelopeBuilder

**目标**：实现 ContextEnvelope 构建器

**任务**：
1. 创建 `apps/desktop/src/main/services/context-envelope-builder.ts`
2. 实现以下方法：
   - `build(input)` — 主入口
   - `buildIdentityLock(shopId, conversationId, messageId, buyer)` — 构建 IdentityLock
   - `buildAuthoritativeFacts(shopId, productId?)` — 聚合 Facts
   - `buildProductFacts(productId)` — 构建 Product Facts
   - `buildKnowledgeFacts(storeId)` — 构建 Knowledge Facts
   - `identifyUnknowns(lock, facts, scene)` — 判定 Unknowns
3. 依赖注入：
   - PlatformAccountRepository
   - StoreRepository
   - ProductRepository
   - ConversationRepository
   - StoreKnowledgeRepository
   - RagClient（调用 Worker 的 RAG）
   - SceneClassifier
4. 添加单元测试

**输入**：shopId, conversationId, messageId, productId?, message  
**输出**：ContextEnvelope  
**验证标准**：
- 所有字段正确填充
- IdentityLock 完整
- Facts 有 provenance
- Unknowns 正确判定
- TypeScript 编译通过
- 单元测试通过

**工作量**：3 天

---

### 3.3 实现 Unknown 判定逻辑

**目标**：实现 explicit unknowns 的判定规则

**任务**：
1. 在 ContextEnvelopeBuilder 中实现 `identifyUnknowns` 方法
2. 定义判定规则：
   - **missing_identity** — customer_identity 缺失或为 "unknown"
   - **missing_fact** — 必需 fact 缺失（如 PRODUCT_INQUIRY 场景缺少 product_facts）
   - **contradictory_facts** — facts 之间有矛盾（MVP 阶段不实现）
   - **stale_evidence** — evidence 过期（MVP 阶段不实现）
   - **unresolved_scene** — scene 分类置信度低（MVP 阶段不实现）
3. 添加单元测试

**输入**：IdentityLock, AuthoritativeFacts, Scene  
**输出**：ExplicitUnknown[]  
**验证标准**：
- 规则正确实现
- TypeScript 编译通过
- 单元测试通过

**工作量**：1 天

---

### 3.4 集成到 Orchestrator

**目标**：将 Builder 集成到 ConversationOrchestrator

**任务**：
1. 修改 `packages/orchestrator/src/core/conversation-orchestrator.ts`
2. 在 `onInboundMessage` 中调用 Builder
3. 将 ContextEnvelope 传递给 Worker
4. 修改 `GenerateReplyInput`，添加 `context_envelope` 字段
5. 修改 Worker 端的 `conversation.generate` RPC，接收 ContextEnvelope

**输入**：ContextEnvelopeBuilder, ConversationOrchestrator  
**输出**：集成后的 Orchestrator  
**验证标准**：
- Orchestrator 能正确调用 Builder
- ContextEnvelope 能正确传递给 Worker
- TypeScript 编译通过
- 单元测试通过

**工作量**：2 天

---

## Phase 4: Verification 实现（P2-13）

### 4.1 实现 ReplyPlanVerifier

**目标**：实现 ReplyPlan 验证器

**任务**：
1. 创建 `apps/desktop/src/main/services/reply-plan-verifier.ts`
2. 实现以下方法：
   - `verify(plan)` — 主入口
   - `verifyIdentityLock(lock)` — 验证 IdentityLock
   - `verifyFacts(factRefs)` — 验证 Facts
   - `verifyRequirement(req, plan)` — 验证单个 requirement
3. 依赖注入：
   - PlatformAccountRepository
   - StoreRepository
   - ConversationRepository
4. 添加单元测试

**输入**：ReplyPlan  
**输出**：VerificationResult  
**验证标准**：
- IdentityLock 验证正确
- Fact 验证正确
- Requirement 验证正确
- TypeScript 编译通过
- 单元测试通过

**工作量**：2 天

---

### 4.2 实现 IdentityLock 验证

**目标**：实现 IdentityLock 的详细验证逻辑

**任务**：
1. 在 ReplyPlanVerifier 中实现 `verifyIdentityLock` 方法
2. 验证规则：
   - Store 仍然存在
   - PlatformAccount 仍然存在
   - Store 和 PlatformAccount 的关联正确
   - Conversation 仍然存在
   - customer_identity 有效（PDD 的 customerUid）
3. 添加单元测试

**输入**：IdentityLock  
**输出**：{passed: boolean, reason?: string}  
**验证标准**：
- 所有验证规则正确实现
- TypeScript 编译通过
- 单元测试通过

**工作量**：1 天

---

### 4.3 集成到 Orchestrator

**目标**：将 Verifier 集成到 ConversationOrchestrator

**任务**：
1. 修改 `packages/orchestrator/src/core/conversation-orchestrator.ts`
2. 在 `sendSuggestion` 之前调用 Verifier
3. 如果验证失败，根据 blocking 级别决定：
   - blocking = true → 拒绝发送，记录日志
   - blocking = false → 记录警告，继续发送
4. 添加单元测试

**输入**：ReplyPlanVerifier, ConversationOrchestrator  
**输出**：集成后的 Orchestrator  
**验证标准**：
- Orchestrator 能正确调用 Verifier
- 验证失败时能正确处理
- TypeScript 编译通过
- 单元测试通过

**工作量**：1.5 天

---

### 4.4 实现 Fact 验证（MVP 简化版）

**目标**：实现 Fact 的基础验证

**任务**：
1. 在 ReplyPlanVerifier 中实现 `verifyFacts` 方法
2. MVP 阶段只验证 Fact 存在，不验证新鲜度
3. 未来可以添加：Fact 的 retrieved_at 是否过期
4. 添加单元测试

**输入**：FactReference[]  
**输出**：{passed: boolean, reason?: string}  
**验证标准**：
- 基础验证正确实现
- TypeScript 编译通过
- 单元测试通过

**工作量**：0.5 天

---

## Phase 5: 集成和测试

### 5.1 集成测试

**目标**：测试完整的 Builder → Worker → Verifier 流程

**任务**：
1. 创建端到端测试用例
2. 测试场景：
   - 正常流程：Builder 构建 → Worker 生成 → Verifier 验证 → 发送
   - 验证失败：IdentityLock 无效 → 拒绝发送
   - Unknown 场景：缺少 customer_identity → 标记为 blocking unknown
3. 添加集成测试

**输入**：Builder, Worker, Verifier  
**输出**：集成测试用例  
**验证标准**：
- 所有测试场景通过
- TypeScript 编译通过

**工作量**：2 天

---

### 5.2 文档更新

**目标**：更新相关文档

**任务**：
1. 更新 `docs/architecture/REPLY_PLAN_EVOLUTION.md`
   - 说明 Phase 2 已完成
   - 说明 Builder 和 Verifier 的实施细节
2. 更新 `docs/architecture/AI_CUSTOMER_SERVICE_CORE.md`
   - 说明 ContextEnvelope 的实际构建流程
   - 说明 Verification 的实际验证流程
3. 更新 `docs/architecture/REPLY_AND_ACTION_SAFETY.md`
   - 说明 Verification 的实施细节
4. 创建 `docs/architecture/CONTEXT_ENVELOPE_BUILDER.md`
   - 详细说明 Builder 的设计和实施
5. 创建 `docs/architecture/REPLY_PLAN_VERIFIER.md`
   - 详细说明 Verifier 的设计和实施

**输入**：实施过程中的设计决策  
**输出**：更新后的文档  
**验证标准**：
- 文档完整、准确
- 与实施一致

**工作量**：1 天

---

## 依赖关系图

```
Phase 1 (治理和文档)
  ├─ 1.1 更新 PROJECT_STATE.json
  ├─ 1.2 明确 Format 迁移路径
  ├─ 1.3 统一 RolloutMode 词汇
  └─ 1.4 统一 knowledge_type 分类
      ↓
Phase 2 (类型定义)
  └─ 2.1 创建 TypeScript 类型定义
      ↓
Phase 3 (Builder 实现)
  ├─ 3.1 实现 SceneClassifier
  ├─ 3.2 实现 ContextEnvelopeBuilder
  ├─ 3.3 实现 Unknown 判定逻辑
  └─ 3.4 集成到 Orchestrator
      ↓
Phase 4 (Verification 实现)
  ├─ 4.1 实现 ReplyPlanVerifier
  ├─ 4.2 实现 IdentityLock 验证
  ├─ 4.3 集成到 Orchestrator
  └─ 4.4 实现 Fact 验证
      ↓
Phase 5 (集成和测试)
  ├─ 5.1 集成测试
  └─ 5.2 文档更新
```

---

## 风险和缓解措施

### 风险 1：SceneClassifier 准确率不足

**影响**：场景分类错误会导致 Unknown 判定错误

**缓解措施**：
- MVP 阶段使用基于规则的分类，易于调整
- 添加置信度字段，低置信度时标记为 unknown
- 未来可以切换到基于 AI 的分类

---

### 风险 2：Verification 性能影响

**影响**：每次发送前都要验证，可能增加延迟

**缓解措施**：
- MVP 阶段只验证 IdentityLock，不验证 Fact 新鲜度
- 使用缓存减少数据库查询
- 未来可以异步验证

---

### 风险 3：Fact 和 Knowledge 边界模糊

**影响**：可能导致 Fact/Inference 边界被违反

**缓解措施**：
- 在文档中明确说明 Store Knowledge 的双重角色
- 在 Builder 中明确区分 knowledge_facts 和 retrieved_knowledge
- 添加代码注释说明设计决策

---

## 验收标准

### Phase 1 验收标准
- [ ] PROJECT_STATE.json 状态清晰，无歧义
- [ ] Format 迁移路径明确
- [ ] RolloutMode 词汇统一
- [ ] knowledge_type 分类统一

### Phase 2 验收标准
- [ ] TypeScript 类型定义完整
- [ ] TypeScript 编译通过
- [ ] 类型与 Schema 一致

### Phase 3 验收标准
- [ ] SceneClassifier 准确率 > 80%
- [ ] ContextEnvelopeBuilder 能正确构建 ContextEnvelope
- [ ] Unknown 判定逻辑正确
- [ ] 集成到 Orchestrator 成功
- [ ] 单元测试通过

### Phase 4 验收标准
- [ ] ReplyPlanVerifier 能正确验证 ReplyPlan
- [ ] IdentityLock 验证正确
- [ ] Fact 验证正确
- [ ] 集成到 Orchestrator 成功
- [ ] 单元测试通过

### Phase 5 验收标准
- [ ] 集成测试全部通过
- [ ] 文档完整、准确
- [ ] 与实施一致

---

## 关键文件清单

### 需要修改的文件
- `project/PROJECT_STATE.json`
- `docs/architecture/REPLY_PLAN_EVOLUTION.md`
- `resources/contracts/schemas/domain/reply-plan.schema.json`
- `resources/contracts/schemas/domain/context-envelope.schema.json`
- `packages/orchestrator/src/core/conversation-orchestrator.ts`

### 需要创建的文件
- `packages/contracts/src/generated/context-envelope.ts`
- `packages/contracts/src/generated/reply-plan.ts`
- `apps/desktop/src/main/services/scene-classifier.ts`
- `apps/desktop/src/main/services/context-envelope-builder.ts`
- `apps/desktop/src/main/services/reply-plan-verifier.ts`
- `docs/architecture/CONTEXT_ENVELOPE_BUILDER.md`
- `docs/architecture/REPLY_PLAN_VERIFIER.md`

---

## 下一步行动

1. **立即可开始**：Phase 1（治理和文档）
2. **Phase 1 完成后**：Phase 2（类型定义）
3. **Phase 2 完成后**：Phase 3（Builder 实现）
4. **Phase 3 完成后**：Phase 4（Verification 实施）
5. **Phase 4 完成后**：Phase 5（集成和测试）

**建议**：从 Phase 1 开始，逐步推进，每个阶段完成后进行验收。

---

**Document created:** 2026-09-29  
**Author:** Codex  
**Review authority:** Controller
