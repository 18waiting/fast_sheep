# 交接提示词：SHEEP-306 后续开发

> **用途:** 新窗口启动时粘贴此文档，快速恢复上下文
> **创建日期:** 2026-09-29
> **当前状态:** SHEEP-306 Phase 1（Schema 定义）已完成，Phase 2-3 待实施
> **下一步:** 解决 P0-P2 问题 → 实施 Builder/Verifier → 进入 SHEEP-307

---

## 一、项目背景

**项目:** 快羊客服 (fast_sheep)
**产品定位:** AI-first 客服系统，面向拼多多商家
**当前阶段:** MVP-A Foundation — PDD 流程跑通

**核心架构:**
```
买家消息 → Platform Adapter → Orchestrator → AI Worker → 回复建议 → 发送/人工确认
                                    ↓
                            ContextEnvelope (输入)
                            ReplyPlan (输出)
```

**关键约束:**
- 公司电脑（macOS）只做开发，不做测试
- 个人电脑（Windows）做测试
- Node.js v20（开发）/ v22+（测试）
- typecheck 是开发环境的最高验证标准

---

## 二、SHEEP-306 当前状态

### 已完成（Phase 1: Schema 定义）

✅ **ContextEnvelope Schema**
- 文件: `resources/contracts/schemas/domain/context-envelope.schema.json`
- 定义了 AI 输入的结构化格式
- 包含 IdentityLock、AuthoritativeFacts、RetrievedKnowledge、Unknowns

✅ **ReplyPlan Schema**
- 文件: `resources/contracts/schemas/domain/reply-plan.schema.json`
- 定义了 AI 输出的结构化格式
- 包含 Suggestion、PolicyMetadata、RolloutMode

✅ **Schema 测试**
- 文件: `tests/contracts/test_context_envelope_reply_plan_schemas.mjs`
- JSON Schema 验证通过

✅ **架构文档**
- 文件: `docs/architecture/REPLY_PLAN_EVOLUTION.md`
- 说明了 Format A/B/C 的演进路径

### 未完成（Phase 2-3: Builder/Verifier）

❌ **ContextEnvelopeBuilder** — 未实现
❌ **SceneClassifier** — 未实现
❌ **ReplyPlanVerifier** — 未实现
❌ **Orchestrator 集成** — 未实现
❌ **集成测试** — 未编写

---

## 三、P0-P2 问题跟踪

**详细文档:** `project/SHEEP_306_P0_P2_PROBLEM_TRACKER.md`

### 问题总览

| 编号 | 问题 | 优先级 | 状态 |
|------|------|--------|------|
| **P0-1** | PROJECT_STATE.json 状态不精确 | 🔴 P0 | ⏳ 待处理 |
| **P0-2** | Format 迁移路径未明确 | 🔴 P0 | ⏳ 待处理 |
| **P1-3** | RolloutMode 词汇不统一 | 🟠 P1 | ⏳ 待处理 |
| **P1-4** | knowledge_type 分类不统一 | 🟠 P1 | ⏳ 待处理 |
| **P1-5** | ContextEnvelope/ReplyPlan 缺 TypeScript 类型 | 🟠 P1 | ⏳ 待处理 |
| **P1-6** | ContextEnvelopeBuilder 未实现 | 🟠 P1 | ⏳ 待处理 |
| **P1-7** | SceneClassifier 未实现 | 🟠 P1 | ⏳ 待处理 |
| **P2-8** | ReplyPlanVerifier 未实现 | 🔵 P2 | ⏳ 待处理 |
| **P2-9** | IdentityLock 验证未实现 | 🔵 P2 | ⏳ 待处理 |
| **P2-10** | Fact 验证未实现 | 🔵 P2 | ⏳ 待处理 |
| **P2-11** | Unknown 判定逻辑未实现 | 🔵 P2 | ⏳ 待处理 |
| **P2-12** | Orchestrator 集成点未实现 | 🔵 P2 | ⏳ 待处理 |
| **P2-13** | 集成测试未编写 | 🔵 P2 | ⏳ 待处理 |
| **P2-14** | 架构文档未更新 | 🔵 P2 | ⏳ 待处理 |
| **P2-15** | Order/Logistics Facts 未实现 | 🔵 P2 | DEFERRED |

### 处理顺序

```
Phase 1: P0-1, P0-2 (治理) → 1 天
Phase 2: P1-3, P1-4 (词汇统一) → 1 天
Phase 3: P1-5 (类型定义) → 1 天
Phase 4: P1-7 (SceneClassifier) → 1 天
Phase 5: P1-6 (Builder + Unknown) → 7 天
Phase 6: P2-8, P2-9, P2-10 (Verifier) → 5.5 天
Phase 7: P2-13 (集成测试) → 2 天
Phase 8: P2-14 (文档更新) → 1 天
```

---

## 四、关键架构概念

### 4.1 ContextEnvelope（AI 输入格式 C）

```typescript
interface ContextEnvelope {
  version: "1.0";
  identity_lock: IdentityLock;           // 身份锁定（结构安全）
  authoritative_facts: AuthoritativeFacts; // 权威事实（来自数据库）
  retrieved_knowledge: RetrievedKnowledge[]; // 检索知识（来自 RAG）
  unknowns: Unknown[];                    // 缺失信息（显式标记）
  scene: Scene;                           // 场景分类
}
```

**核心原则:**
- IdentityLock 是结构安全，不是业务验证
- Fact 来自数据库，confidence = 1.0
- Knowledge 来自 RAG，有 relevance score
- Unknown 是显式标记，不是隐式缺失

### 4.2 ReplyPlan（AI 输出格式）

```typescript
interface ReplyPlan {
  version: "1.0";
  suggestion: Suggestion;                 // 回复建议
  policy_metadata: PolicyMetadata;        // 策略元数据
  trace: TraceInfo;                       // 追踪信息
}
```

**核心原则:**
- AI 输出是 plan，不是 execution authority
- 必须经过 Verifier 验证才能发送
- rollout_mode 决定发送策略（HUMAN_CONFIRM / AUTO / OFF）

### 4.3 Shop vs Store 语义分离

**已解决（ISSUE-1）:**
- **Shop** = 运行时/UI 会话上下文（shopId 是会话 key）
- **Store** = 域身份实体（store_id 是业务身份）
- 两者在不同域中使用，没有隐式混用
- 映射通过 Repository 方法实现（`findByExternalRef`, `findByMerchantAndPlatform`）

**文档:** `docs/architecture/SHOP_VS_STORE_SEMANTICS.md`

### 4.4 IdentityLock 两个定义

**已解决（ISSUE-2）:**
- **Schema 定义**（ContextEnvelope 中）: 结构安全，包含 shop_id, conversation_id, customer_identity
- **架构定义**（AI_CUSTOMER_SERVICE_CORE.md 中）: 域概念，表示身份锁定的业务含义
- 两者不矛盾，是同一概念的不同视角

### 4.5 RAG 知识架构

**当前状态:**
```
knowledge_entries (商品知识)
    ↓ 合并构建
store_knowledge (店铺规则)
    ↓
IndexBuilder → FAISS (统一索引)
    ↓
RAGEngine (向量检索 + 类型过滤)
    ↓
ConversationEngine
```

**关键决策:**
- store_knowledge 合并到 RAGEngine（不再独立）
- 使用 `title + content` 作为 embedding text
- 在 FAISS mapping 中添加 `knowledge_type` 字段
- RAGEngine 添加过滤参数支持

**文档:** `docs/architecture/RAG_KNOWLEDGE_BASE.md`

---

## 五、关键文件清单

### 架构文档
- `docs/architecture/AI_CUSTOMER_SERVICE_CORE.md` — 核心生命周期
- `docs/architecture/REPLY_PLAN_EVOLUTION.md` — Format 演进
- `docs/architecture/REPLY_AND_ACTION_SAFETY.md` — 执行安全
- `docs/architecture/SHOP_VS_STORE_SEMANTICS.md` — Shop/Store 语义
- `docs/architecture/RAG_KNOWLEDGE_BASE.md` — RAG 架构
- `docs/architecture/PLATFORM_ADAPTER_CONTRACT.md` — 平台适配器

### Schema 定义
- `resources/contracts/schemas/domain/context-envelope.schema.json`
- `resources/contracts/schemas/domain/reply-plan.schema.json`
- `resources/contracts/schemas/domain/store-knowledge.schema.json`

### 核心代码
- `packages/orchestrator/src/core/conversation-orchestrator.ts` — Orchestrator（683 行）
- `packages/orchestrator/src/adapters/worker-ai-engine-client.ts` — Worker 适配器
- `services/ai-worker/src/fastwork_ai_worker/conversation/conversation_engine.py` — Python 引擎（270 行）
- `services/ai-worker/src/fastwork_ai_worker/rag/rag_engine.py` — RAG 引擎
- `services/ai-worker/src/fastwork_ai_worker/rag/index_builder.py` — 索引构建器

### 身份域
- `packages/persistence/src/repositories/identity-repositories.ts` — Identity Repository
- `packages/persistence/src/repositories/shop-repository.ts` — Legacy Shop Repository

### 项目治理
- `project/PROJECT_STATE.json` — 当前状态
- `project/DECISIONS.md` — 锁定决策
- `project/SHEEP_306_P0_P2_PROBLEM_TRACKER.md` — P0-P2 问题跟踪
- `project/SHEEP_306_IMPLEMENTATION_PLAN.md` — 详细实施计划

---

## 六、已完成的 ISSUE 处理

### ISSUE-1: Shop vs Store 身份模型冲突 ✅

**决策:** 方向 B — 明确语义分离 + 清理半成品

**已完成:**
- 删除了未使用的映射层 `shop-store-mapper.ts`
- 更新了 `SHOP_VS_STORE_SEMANTICS.md`
- 移除了边界点文件中对 mapper 的注释引用
- 全项目 typecheck 通过

### ISSUE-2: IdentityLock 两个不兼容定义 ✅

**决策:** 选项 A — 消除矛盾，保留差异

**已完成:**
- 明确 Schema 定义和架构定义是同一概念的不同视角
- 更新了相关文档

### ISSUE-3: AI 输入三个竞争格式 ✅

**决策:** 选项 A+C — 保留 Format B（历史），为 Format A 添加类型

**已完成:**
- 为 Format A (ConversationEngineRequest) 添加了 TypeScript 类型
- 明确了 Format C (ContextEnvelope) 是未来演进方向

### ISSUE-4: TypeScript 命名规范混乱 ✅

**决策:** 选项 C — 文档化现状，不做大范围重命名

**已完成:**
- 文档化了当前命名规范
- 明确了各层级的命名约定

**详细记录:** `project/CRITICAL_DEFINITION_ISSUES.md`

---

## 七、SHEEP-305 状态

**定义:** RAG Knowledge Base Infrastructure
**状态:** NOT_AUTHORIZED（等待 P0-P2 问题解决）
**设计文档:** `docs/architecture/RAG_KNOWLEDGE_BASE.md`

**目标:**
- 统一知识检索基础设施
- 支持类型注册（无需代码改动）
- 支持场景路由
- SHIPPING_TIME 作为第一个知识类型

**当前进展:**
- ✅ store_knowledge 合并到 RAGEngine（commit 0453f30）
- ❌ 类型注册器未实现
- ❌ 统一检索接口未实现
- ❌ 场景路由未实现

---

## 八、下一步行动

### 立即可做

1. **读取 P0-P2 问题跟踪表**
   ```
   project/SHEEP_306_P0_P2_PROBLEM_TRACKER.md
   ```

2. **从 P0 开始解决**
   - P0-1: 更新 PROJECT_STATE.json
   - P0-2: 明确 Format 迁移路径

3. **逐步推进到 P1**
   - P1-3, P1-4: 统一词汇
   - P1-5: 创建 TypeScript 类型
   - P1-7: 实现 SceneClassifier
   - P1-6: 实现 ContextEnvelopeBuilder

4. **最后处理 P2**
   - P2-8, P2-9, P2-10: 实现 ReplyPlanVerifier
   - P2-13: 编写集成测试
   - P2-14: 更新架构文档

### SHEEP-306 完成后

进入 **SHEEP-307: AI Worker 结构化 ReplyPlan 集成**

**SHEEP-307 目标:**
- Worker 支持接收 ContextEnvelope
- Worker 生成 ReplyPlan 而不是 Suggestion
- Main 端消费 ReplyPlan，执行验证和发送

**前置条件:**
- SHEEP-306 Phase 2-3 完成
- Builder 和 Verifier 已实现
- Orchestrator 已集成

---

## 九、重要提醒

### 不要做的事

1. ❌ **不要修改现有的 Shop/Store 代码** — 它们已经正确分离
2. ❌ **不要假设 Order/Logistics Facts 存在** — MVP 范围外
3. ❌ **不要跳过 Verification** — 这是安全要求
4. ❌ **不要创建竞争的 reply 模型** — 维护单一来源原则
5. ❌ **不要在公司电脑上跑测试** — 只能在个人电脑上跑
6. ❌ **不要升级 Node.js** — 开发环境保持 v20

### 必须遵守的原则

1. ✅ **AI 输出是 plan，不是 execution authority** — 必须经过验证
2. ✅ **IdentityLock 是结构安全** — 不是业务验证
3. ✅ **Fact 来自数据库** — confidence = 1.0
4. ✅ **Knowledge 来自 RAG** — 有 relevance score
5. ✅ **Unknown 是显式标记** — 不是隐式缺失
6. ✅ **typecheck 是开发环境的最高验证标准**

---

## 十、快速参考

### 启动命令

```bash
# TypeScript 编译验证
pnpm run typecheck

# 查看当前状态
cat project/PROJECT_STATE.json | jq '.sheep_305_entry'

# 查看 P0-P2 问题
cat project/SHEEP_306_P0_P2_PROBLEM_TRACKER.md

# 查看详细实施计划
cat project/SHEEP_306_IMPLEMENTATION_PLAN.md
```

### 关键路径

```
P0 问题 → P1 问题 → Builder 实现 → Verifier 实现 → 集成测试 → SHEEP-307
   ↓          ↓           ↓              ↓              ↓
 治理      词汇统一    核心组件        安全验证       质量保障
```

### 决策记录

- **DR-2026-09-24-SHEEP-305-REALIGNMENT**: SHEEP-305 对齐 DEC-008
- **DR-2026-09-28-SHEEP-305-RAG-REDEFINITION**: SHEEP-305 重定义为 RAG 基础设施
- **DEC-SHEEP-306-REPLY-PLAN-EVOLUTION**: SHEEP-306 Schema 定义完成

---

**Handoff created:** 2026-09-29
**Next action:** 开始解决 P0-P2 问题
**Expected completion:** SHEEP-306 全部完成约需 18.5 天
