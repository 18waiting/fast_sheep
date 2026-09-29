# SHEEP-306 P0-P2 问题跟踪表

> **创建日期:** 2026-09-29
> **状态:** 待 Controller 逐个点名解决
> **来源:** SHEEP-306 全盘规划中识别的 15 个问题
> **目的:** 为 Controller 提供详细的问题分析和解决方案，支持逐个点名决策
> **关联文档:** `project/SHEEP_306_IMPLEMENTATION_PLAN.md`

---

## 问题总览

| 编号 | 问题 | 优先级 | 类别 | 影响范围 | 状态 |
|------|------|--------|------|----------|------|
| **P0-1** | PROJECT_STATE.json 状态不精确 | 🔴 P0 | 治理 | 全局状态追踪 | ✅ 已完成 |
| **P0-2** | Format 迁移路径未明确 | 🔴 P0 | 治理 | AI 输入格式演进 | ✅ 已完成 |
| **P1-3** | RolloutMode 词汇不统一 | 🟠 P1 | 治理 | Schema/文档一致性 | ✅ 已完成 |
| **P1-4** | knowledge_type 分类不统一 | 🟠 P1 | 治理 | RAG 检索层 | ✅ 已完成 |
| **P1-5** | ContextEnvelope/ReplyPlan 缺 TypeScript 类型 | 🟠 P1 | 实现 | Builder/Verifier 开发 | ✅ 已完成 |
| **P1-6** | ContextEnvelopeBuilder | 🟠 P1 | 实现 | Orchestrator 核心流程 | ✅ 已完成 |
| **P1-7** | SceneClassifier 适配层 | 🟠 P1 | 实现 | 场景路由 | ✅ 已完成 |
| **P2-8** | ReplyPlanVerifier | 🔵 P2 | 安全 | 发送前验证 | ✅ 已完成 |
| **P2-9** | IdentityLock 验证 | 🔵 P2 | 安全 | 身份锁定验证 | ✅ P2-8b 已实现 |
| **P2-10** | Fact 验证 | 🔵 P2 | 安全 | 事实新鲜度验证 | ✅ P2-8c 已实现 |
| **P2-11** | Unknown 判定逻辑 | 🔵 P2 | 实现 | 缺失信息标记 | ✅ P1-6d 已实现 |
| **P2-12** | Orchestrator 集成点 | 🔵 P2 | 实现 | 端到端流程 | ✅ P1-6f 已实现骨架 |
| **P2-13** | 集成测试未编写 | 🔵 P2 | 测试 | 质量保障 | ✅ 已完成 |
| **P2-14** | 架构文档未更新 | 🔵 P2 | 文档 | 知识同步 | ✅ 已完成 |
| **P2-15** | Order/Logistics Facts 未实现 | 🔵 P2 | 实现 | MVP 范围外 | ⏳ DEFERRED |

---

## P0 级问题（治理 — 必须先解决）

---

### P0-1: PROJECT_STATE.json 状态不精确

**问题描述:**
当前 PROJECT_STATE.json 中 SHEEP-306 的状态为 `IMPLEMENTED`，但实际上只完成了 Phase 1（Schema 定义），Phase 2（Builder）和 Phase 3（Consumer）尚未开始。这种模糊状态会导致后续开发者误以为全部完成。

**当前状态:**
```json
{
  "id": "DEC-SHEEP-306-REPLY-PLAN-EVOLUTION",
  "status": "IMPLEMENTED",
  "summary": "Defined ContextEnvelope and ReplyPlan contracts..."
}
```

**应该的状态:**
```json
{
  "id": "DEC-SHEEP-306-REPLY-PLAN-EVOLUTION",
  "status": "PHASE_1_COMPLETE",
  "phases": {
    "phase_1_contract": "COMPLETE",
    "phase_2_builder": "NOT_STARTED",
    "phase_3_consumer": "NOT_STARTED"
  }
}
```

**解决方案:**
1. 修改 `project/PROJECT_STATE.json` 中的 `decisions` 数组
2. 将 SHEEP-306 的 status 改为 `PHASE_1_COMPLETE`
3. 添加 phases 对象，明确三个阶段的独立状态
4. 更新 `next_action`，说明当前可以开始 Phase 2

**文件:** `project/PROJECT_STATE.json`
**工作量:** 0.5 天
**风险:** 低（纯文档修改）
**验证标准:**
- [ ] JSON 格式正确
- [ ] 三个阶段状态清晰
- [ ] next_action 明确指向 Phase 2

---

### P0-2: Format 迁移路径未明确

**问题描述:**
当前存在三个 AI 输入格式：
- **Format A** (ConversationEngineRequest) — 当前生产环境使用
- **Format B** (generation-request) — 已废弃但文档中有残留
- **Format C** (ContextEnvelope) — 未来演进方向

但没有文档说明从 A 到 C 的迁移策略、时间节点和并行方案。

**当前状态:**
- `REPLY_PLAN_EVOLUTION.md` 提到了三个格式，但没有迁移路径
- 开发者不知道什么时候开始用 Format C
- 不清楚 Format A 和 C 是否需要并行支持

**解决方案:**
在 `docs/architecture/REPLY_PLAN_EVOLUTION.md` 中添加迁移路径章节：

```markdown
## Format 迁移路径

### 当前状态（2026-09）
- Format A (ConversationEngineRequest) 是当前唯一生产格式
- Format C (ContextEnvelope) 是未来演进方向
- Format B 已废弃

### 迁移计划
1. **Phase 2 (SHEEP-306)**: 实现 ContextEnvelopeBuilder
   - Format A 和 C 并行存在
   - Builder 构建 ContextEnvelope，但 Worker 仍然接收 Format A
   - 通过 adapter 在两者之间转换

2. **Phase 3 (SHEEP-307)**: Worker 支持 ContextEnvelope
   - Worker 开始接收 Format C
   - Format A 作为 fallback 保留

3. **Phase 4 (未来)**: 完全切换到 Format C
   - Format A 废弃
   - 需要数据迁移脚本
```

**文件:** `docs/architecture/REPLY_PLAN_EVOLUTION.md`
**工作量:** 0.5 天
**风险:** 低（纯文档修改）
**验证标准:**
- [ ] 迁移路径清晰
- [ ] 时间节点明确
- [ ] 并行方案说明完整
- [ ] 无歧义

---

## P1 级问题（实现阻塞 — 需要尽快解决）

---

### P1-3: RolloutMode 词汇不统一

**问题描述:**
不同文档和 Schema 中对 rollout mode 的命名不一致：
- `PDD_MVP_V1.md`: `HUMAN_CONFIRM`, `AUTO`, `OFF`
- `reply-plan.schema.json`: `human_review`, `full_auto`
- `REPLY_PLAN_EVOLUTION.md`: 混用两种

**当前状态:**
```json
// reply-plan.schema.json
"rollout_mode": {
  "type": "string",
  "enum": ["human_review", "full_auto"]
}
```

```markdown
// PDD_MVP_V1.md
- HUMAN_CONFIRM: 人工确认模式
- AUTO: 全自动模式
- OFF: 关闭模式
```

**解决方案:**
统一到 PDD_MVP_V1.md 的定义（因为它是产品权威文档）：

1. 修改 `reply-plan.schema.json`：
   ```json
   "rollout_mode": {
     "type": "string",
     "enum": ["HUMAN_CONFIRM", "AUTO", "OFF"]
   }
   ```

2. 在 `REPLY_PLAN_EVOLUTION.md` 中添加词汇映射表：
   ```markdown
   | 旧名称 | 新名称 | 说明 |
   |--------|--------|------|
   | human_review | HUMAN_CONFIRM | 需要人工确认 |
   | full_auto | AUTO | 全自动发送 |
   | (无) | OFF | 关闭 AI 辅助 |
   ```

**文件:**
- `resources/contracts/schemas/domain/reply-plan.schema.json`
- `docs/architecture/REPLY_PLAN_EVOLUTION.md`

**工作量:** 0.5 天
**风险:** 中（Schema 修改可能影响测试）
**验证标准:**
- [ ] Schema 验证通过
- [ ] 词汇映射表完整
- [ ] 与 PDD_MVP_V1.md 一致
- [ ] 测试用例更新

---

### P1-4: knowledge_type 分类不统一

**问题描述:**
当前 knowledge_type 的分类在不同层级不一致：
- Python RAG 层：使用具体类型（`SHIPPING_TIME`, `RETURN_POLICY`, `FAQ`）
- TypeScript Schema 层：使用抽象类型（`PRODUCT_KNOWLEDGE`, `STORE_RULE`）
- 没有明确的映射关系

**当前状态:**
```python
# Python RAG 层
knowledge_type = "SHIPPING_TIME"  # 具体类型
```

```json
// TypeScript Schema 层
"knowledge_type": {
  "enum": ["PRODUCT_KNOWLEDGE", "STORE_RULE"]  // 抽象类型
}
```

**解决方案:**
采用两层分类体系：

**Layer 1（粗粒度）:** `PRODUCT_KNOWLEDGE` | `STORE_RULE`
**Layer 2（细粒度）:** `SHIPPING_TIME` | `RETURN_POLICY` | `FAQ` | `OTHER`

修改 `context-envelope.schema.json`：
```json
{
  "RetrievedKnowledge": {
    "properties": {
      "knowledge_type": {
        "type": "string",
        "enum": ["PRODUCT_KNOWLEDGE", "STORE_RULE"],
        "description": "Layer 1: 粗粒度分类"
      },
      "store_knowledge_type": {
        "type": "string",
        "enum": ["SHIPPING_TIME", "RETURN_POLICY", "FAQ", "OTHER"],
        "description": "Layer 2: 细粒度分类（仅当 knowledge_type=STORE_RULE 时使用）"
      }
    }
  }
}
```

**文件:**
- `resources/contracts/schemas/domain/context-envelope.schema.json`
- 相关测试文件

**工作量:** 0.5 天
**风险:** 中（Schema 修改可能影响 Python 端）
**验证标准:**
- [ ] Schema 验证通过
- [ ] 两层分类关系清晰
- [ ] 与 Python 实现一致
- [ ] 测试用例更新

---

### P1-5: ContextEnvelope/ReplyPlan 缺 TypeScript 类型

**问题描述:**
ContextEnvelope 和 ReplyPlan 只有 JSON Schema 定义，没有对应的 TypeScript 类型。这导致：
- Builder 实现时无法使用类型检查
- 开发者需要手动对照 Schema 写代码
- 容易出现类型不匹配的错误

**解决方案:**
创建 TypeScript 类型定义：

1. `packages/contracts/src/generated/context-envelope.ts`
2. `packages/contracts/src/generated/reply-plan.ts`

从 JSON Schema 镜像 TypeScript 接口，添加 JSDoc 注释。

**文件:**
- `packages/contracts/src/generated/context-envelope.ts`（新建）
- `packages/contracts/src/generated/reply-plan.ts`（新建）

**工作量:** 1 天
**风险:** 低（纯类型定义）
**验证标准:**
- [ ] TypeScript 编译通过
- [ ] 类型与 Schema 一致
- [ ] JSDoc 注释完整

---

### P1-6: ContextEnvelopeBuilder 未实现

**问题描述:**
ContextEnvelopeBuilder 是 SHEEP-306 的核心组件，负责：
1. 构建 IdentityLock（身份锁定）
2. 聚合 Authoritative Facts（权威事实）
3. 检索 Store Knowledge（店铺知识）
4. 判定 Unknowns（缺失信息）

当前完全没有实现。

**解决方案:**
创建 `apps/desktop/src/main/services/context-envelope-builder.ts`，实现以下方法：
- `build(input)` — 主入口
- `buildIdentityLock(shopId, conversationId, messageId, buyer)` — 构建 IdentityLock
- `buildAuthoritativeFacts(shopId, productId?)` — 聚合 Facts
- `identifyUnknowns(lock, facts, scene)` — 判定 Unknowns

依赖注入：
- PlatformAccountRepository
- StoreRepository
- ProductRepository
- ConversationRepository
- StoreKnowledgeRepository

**文件:**
- `apps/desktop/src/main/services/context-envelope-builder.ts`（新建）
- `packages/orchestrator/src/core/conversation-orchestrator.ts`（修改）

**工作量:** 7 天
**风险:** 高（核心组件，影响全局）
**验证标准:**
- [ ] TypeScript 编译通过
- [ ] 单元测试通过
- [ ] 能正确构建 ContextEnvelope
- [ ] 集成到 Orchestrator 成功

---

### P1-7: SceneClassifier 未实现

**问题描述:**
SceneClassifier 负责场景分类，是 Unknown 判定的前提。当前没有实现。

**解决方案:**
创建 `apps/desktop/src/main/services/scene-classifier.ts`，实现基于规则的分类（MVP 阶段）：

Scene 枚举：
- `SHIPPING_TIME` — 发货时间咨询
- `PRODUCT_INQUIRY` — 商品咨询
- `ORDER_STATUS` — 订单状态查询
- `RETURN_POLICY` — 退货政策咨询
- `GENERAL` — 一般咨询

**文件:**
- `apps/desktop/src/main/services/scene-classifier.ts`（新建）

**工作量:** 1 天
**风险:** 中（分类准确率影响 Unknown 判定）
**验证标准:**
- [ ] 分类准确率 > 80%
- [ ] TypeScript 编译通过
- [ ] 单元测试通过

---

## P2 级问题（安全和质量 — 需要逐步解决）

---

### P2-8: ReplyPlanVerifier 未实现

**问题描述:**
ReplyPlanVerifier 负责在发送前验证 ReplyPlan 的合法性和安全性。当前没有实现。

**安全影响:**
- 无法验证 IdentityLock 是否有效
- 无法验证 Fact 是否新鲜
- 无法验证 Inference 是否合理
- 可能导致错误发送

**解决方案:**
创建 `apps/desktop/src/main/services/reply-plan-verifier.ts`，实现：
- `verify(plan)` — 主入口
- `verifyIdentityLock(lock)` — 验证身份锁定
- `verifyFacts(facts)` — 验证事实新鲜度
- `verifyInferences(inferences)` — 验证推理合理性

**文件:**
- `apps/desktop/src/main/services/reply-plan-verifier.ts`（新建）
- `packages/orchestrator/src/core/conversation-orchestrator.ts`（修改）

**工作量:** 5.5 天
**风险:** 高（安全关键组件）
**验证标准:**
- [ ] TypeScript 编译通过
- [ ] 单元测试通过
- [ ] 能正确验证 ReplyPlan
- [ ] 集成到 Orchestrator 成功

---

### P2-9: IdentityLock 验证未实现

**问题描述:**
IdentityLock 是 ReplyPlan 的核心安全机制，但验证逻辑未实现。

**解决方案:**
在 ReplyPlanVerifier 中实现 `verifyIdentityLock(lock)` 方法：
1. 验证 lock 是否完整（所有必需字段存在）
2. 验证 lock 是否过期（timestamp 在合理范围内）
3. 验证 lock 是否匹配当前上下文（shopId, conversationId）

**文件:** `apps/desktop/src/main/services/reply-plan-verifier.ts`
**工作量:** 包含在 P2-8 中
**风险:** 高（安全关键）
**验证标准:**
- [ ] 能正确验证 IdentityLock
- [ ] 拒绝无效的 lock
- [ ] 单元测试通过

---

### P2-10: Fact 验证未实现

**问题描述:**
Fact 是 ReplyPlan 中的权威数据，需要验证其新鲜度和准确性。

**解决方案:**
在 ReplyPlanVerifier 中实现 `verifyFacts(facts)` 方法：
1. 验证 product_facts 是否与数据库一致
2. 验证 knowledge_facts 是否与知识库一致
3. 标记过期的 fact（MVP 阶段简化：只验证存在性）

**文件:** `apps/desktop/src/main/services/reply-plan-verifier.ts`
**工作量:** 包含在 P2-8 中
**风险:** 中（MVP 阶段简化验证）
**验证标准:**
- [ ] 能正确验证 Fact
- [ ] 标记过期的 fact
- [ ] 单元测试通过

---

### P2-11: Unknown 判定逻辑未实现

**问题描述:**
Unknown 表示缺失的关键信息，需要在 ContextEnvelope 中明确标记。

**解决方案:**
在 ContextEnvelopeBuilder 中实现 `identifyUnknowns(lock, facts, scene)` 方法：
1. 检查 IdentityLock 是否缺少 customer_identity
2. 检查 Facts 是否缺少关键数据（如 product_price）
3. 根据 Scene 判定哪些 Unknown 是 blocking（阻塞发送）

**文件:** `apps/desktop/src/main/services/context-envelope-builder.ts`
**工作量:** 包含在 P1-6 中
**风险:** 中（影响发送决策）
**验证标准:**
- [ ] 能正确识别 Unknown
- [ ] 正确标记 blocking unknown
- [ ] 单元测试通过

---

### P2-12: Orchestrator 集成点未实现

**问题描述:**
Builder 和 Verifier 需要集成到 Orchestrator 的核心流程中，但集成点未实现。

**解决方案:**
修改 `conversation-orchestrator.ts`：
1. 在 `onInboundMessage` 中调用 Builder 构建 ContextEnvelope
2. 在 `sendSuggestion` 前调用 Verifier 验证 ReplyPlan
3. 处理验证失败的情况（拒绝发送、记录日志）

**文件:** `packages/orchestrator/src/core/conversation-orchestrator.ts`
**工作量:** 包含在 P1-6 和 P2-8 中
**风险:** 高（核心流程修改）
**验证标准:**
- [ ] 集成成功
- [ ] 端到端流程正常
- [ ] 验证失败时拒绝发送
- [ ] 单元测试通过

---

### P2-13: 集成测试未编写

**问题描述:**
缺少端到端集成测试，无法验证 Builder → Worker → Verifier 的完整流程。

**解决方案:**
创建集成测试用例：
1. 正常流程：Builder 构建 → Worker 生成 → Verifier 验证 → 发送
2. 验证失败：IdentityLock 无效 → 拒绝发送
3. Unknown 场景：缺少 customer_identity → 标记为 blocking unknown

**文件:** 测试文件（待创建）
**工作量:** 2 天
**风险:** 中（测试覆盖不足）
**验证标准:**
- [ ] 所有测试场景通过
- [ ] TypeScript 编译通过
- [ ] 测试覆盖率 > 80%

---

### P2-14: 架构文档未更新

**问题描述:**
Builder 和 Verifier 实现后，相关架构文档需要更新，但当前未规划。

**解决方案:**
更新以下文档：
1. `docs/architecture/REPLY_PLAN_EVOLUTION.md` — 说明 Phase 2 已完成
2. `docs/architecture/AI_CUSTOMER_SERVICE_CORE.md` — 说明 ContextEnvelope 构建流程
3. `docs/architecture/REPLY_AND_ACTION_SAFETY.md` — 说明 Verification 流程
4. 创建 `docs/architecture/CONTEXT_ENVELOPE_BUILDER.md` — Builder 设计文档
5. 创建 `docs/architecture/REPLY_PLAN_VERIFIER.md` — Verifier 设计文档

**文件:** 多个文档文件
**工作量:** 1 天
**风险:** 低（纯文档修改）
**验证标准:**
- [ ] 文档完整、准确
- [ ] 与实施一致
- [ ] 无歧义

---

### P2-15: Order/Logistics Facts 未实现

**问题描述:**
Order Facts 和 Logistics Facts 是 ContextEnvelope 的重要组成部分，但当前未实现。

**状态:** **DEFERRED** — MVP 范围外

**解决方案:**
标记为 DEFERRED，等 PDD 流程跑通后再实现。

**工作量:** 未估算
**风险:** 低（MVP 不需要）
**验证标准:** N/A

---

## 处理优先级

```
Phase 1: P0-1, P0-2 (治理) → 1 天
Phase 2: P1-3, P1-4 (词汇统一) → 1 天
Phase 3: P1-5 (类型定义) → 1 天
Phase 4: P1-7 (SceneClassifier) → 1 天
Phase 5: P1-6 (Builder + Unknown) → 7 天
Phase 6: P2-8, P2-9, P2-10 (Verifier) → 5.5 天
Phase 7: P2-12 (Orchestrator 集成) → 包含在 Phase 5-6 中
Phase 8: P2-13 (集成测试) → 2 天
Phase 9: P2-14 (文档更新) → 1 天
```

**总计:** 18.5 天

---

## Controller 决策记录

| 编号 | 决策日期 | 决策内容 | 决策者 |
|------|----------|----------|--------|
| P0-1 | 2026-09-29 | 修改 PROJECT_STATE.json，将 SHEEP-306 status 改为 PHASE_1_COMPLETE，添加 phases 字段 | Codex |
| P0-2 | 2026-09-29 | 在 REPLY_PLAN_EVOLUTION.md 添加 Format A/B/C 迁移路径章节 | Codex |
| P1-3 | 2026-09-29 | 统一 RolloutMode 词汇：添加 OFF 到 Schema，更新文档和测试 | Codex |
| P1-4 | 2026-09-29 | 建立两层 knowledge_type 分类体系：Layer 1 粗粒度 + Layer 2 细粒度 | Codex |
| P1-5 | 2026-09-29 | 创建 ContextEnvelope 和 ReplyPlan 的 TypeScript 类型定义（Contract Schema 层） | Codex | 建立两层 knowledge_type 分类体系：Layer 1 粗粒度 + Layer 2 细粒度 | Codex | 在 REPLY_PLAN_EVOLUTION.md 添加 Format A/B/C 迁移路径章节 | Codex |
|------|----------|----------|--------|
| | | | |

---

**Document created:** 2026-09-29
**Author:** Codex
**Review authority:** Controller
