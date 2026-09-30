# SHEEP-309 任务定义：SHADOW End-to-End Audit

**任务 ID:** SHEEP-309  
**状态:** NOT_STARTED  
**优先级:** P0  
**依赖:** SHEEP-302 ~ SHEEP-308 ✅  
**工作量估算:** 5-7 天  
**日期:** 2026-09-30

---

## 一、任务目标

证明真实的受控 PDD inbound 路径能够完整运行，从 IdentityLock 到 AI ReplyPlan，经过确定性策略评估，生成完整的持久化审计记录，但**不发送任何消息**。

---

## 二、治理依据

- **Roadmap V1.1 §5:** MVP-B SHADOW — Real controlled PDD inbound through AI ReplyPlan and audit, with no platform send
- **Master §5:** AI output must be structured and governed
- **REPLY_AND_ACTION_SAFETY:** Deterministic policy evaluation before execution
- **PDD_MVP_V1.md §3:** RolloutMode definitions (SHADOW = generate but don't send)

---

## 三、核心要求

### 3.1 端到端流水线

必须串联以下组件（SHEEP-302 ~ SHEEP-308）：

```
真实 PDD Inbound (受控店铺)
  ↓
IdentityLock 验证 (SHEEP-300)
  ↓
持久化标准化 Inbound 消息 (SHEEP-302)
  ↓
聚合构建 AI Turn (SHEEP-303)
  ↓
场景分类 (SHEEP-304)
  ↓
知识检索 (SHEEP-305)
  ↓
构建 ContextEnvelope (SHEEP-306)
  ↓
AI 生成 ReplyPlan (SHEEP-307)
  ↓
策略评估 (SHEEP-308)
  ↓
审计持久化 (SHEEP-309 新增)
  ↓
TRANSPORT SEND CALLS = 0 验证 (SHEEP-309 新增)
```

### 3.2 审计持久化

每个环节必须记录：

| 环节 | 记录内容 | 关键字段 |
|------|---------|---------|
| Inbound | 原始消息 | message_id, content, received_at |
| IdentityLock | 身份锁定 | merchant_id, store_id, customer_id |
| Persistence | 持久化结果 | status, dedupe_key |
| Turn | 聚合结果 | turn_id, message_count |
| Scene | 场景分类 | scene, confidence |
| Knowledge | 知识检索 | knowledge_count, knowledge_ids |
| Envelope | ContextEnvelope | envelope_id, unknowns_count |
| ReplyPlan | AI 输出 | plan_id, reply_text, fact_refs |
| Policy | 策略评估 | rollout_mode, allowed, reasons |

### 3.3 TRANSPORT SEND CALLS = 0

必须证明：
- 没有任何 transport 层调用
- 没有任何消息发送
- 没有任何平台 API 调用
- 仅生成 ReplyPlan，不执行

### 3.4 受控店铺

- 使用一个受控的 PDD 店铺
- 真实 inbound 消息（来自测试账号）
- 仅读取，不写入平台

---

## 四、当前状态（AS-IS）

### 已有基础

1. **端到端组件** (SHEEP-300 ~ 308 ✅)
   - IdentityLock 验证
   - 持久化层
   - Turn Builder
   - 场景分类
   - 知识检索
   - ContextEnvelope Builder
   - ReplyPlan Builder
   - Policy Engine

2. **Shadow 模式集成** (SHEEP-306 ✅)
   - ContextEnvelopeIntegration (fire-and-forget)
   - ReplyPlanVerificationIntegration (fire-and-forget)

3. **RPC 边界** (SHEEP-307 ✅)
   - conversation.generate_v2 方法
   - ContextEnvelope → ReplyPlan 转换

### 缺失组件

1. ❌ **端到端流水线编排器** — 将所有组件串联成完整流程
2. ❌ **审计持久化层** — 记录每个环节的中间结果
3. ❌ **SHADOW 模式执行器** — 生成 ReplyPlan 但不发送
4. ❌ **TRANSPORT SEND CALLS = 0 验证** — 证明零发送
5. ❌ **审计报告生成器** — 完整的端到端审计关联

---

## 五、目标状态（TO-BE）

### 架构流程

```
真实 PDD Inbound (受控店铺)
  ↓
[1] PDD Inbound Observer → InboundEnvelope
  ↓
[2] CanonicalInboundPersistence → 持久化消息
  ↓
[3] InboundTurnBuilder → AI Turn
  ↓
[4] MinimalSceneClassifier → Scene
  ↓
[5] StoreKnowledgeRetrieval → Knowledge
  ↓
[6] ContextEnvelopeBuilder → ContextEnvelope
  ↓
[7] RPC → conversation.generate_v2 → ReplyPlan
  ↓
[8] PolicyEngine.evaluate() → PolicyDecision
  ↓
[9] AuditLogger → 持久化审计记录
  ↓
[10] TransportBlocker → 验证 TRANSPORT SEND CALLS = 0
  ↓
[11] AuditReportGenerator → 审计报告
```

### 核心组件

1. **ShadowPipelineOrchestrator** (TypeScript)
   - 位置：`apps/desktop/src/main/services/shadow-pipeline-orchestrator.ts`
   - 职责：串联所有组件，执行端到端流水线

2. **AuditLogger** (TypeScript)
   - 位置：`apps/desktop/src/main/services/audit-logger.ts`
   - 职责：记录每个环节的中间结果

3. **TransportBlocker** (TypeScript)
   - 位置：`apps/desktop/src/main/services/transport-blocker.ts`
   - 职责：阻止所有 transport 调用，验证零发送

4. **AuditReportGenerator** (TypeScript)
   - 位置：`apps/desktop/src/main/services/audit-report-generator.ts`
   - 职责：生成完整的审计报告

5. **数据库迁移** (SQL)
   - 位置：`resources/persistence/migrations/0009_shadow_audit.sql`
   - 职责：创建审计表

---

## 六、允许范围（Allowed Scope）

### ✅ 允许
- 端到端流水线编排
- 审计持久化
- SHADOW 模式执行
- 受控店铺验证
- TRANSPORT SEND CALLS = 0 验证
- 审计报告生成
- 真实 PDD inbound（只读）

### ❌ 禁止
- 调用平台 transport
- 发送任何消息
- 调用平台 API（写入）
- 授权 AUTO 模式
- 实现业务 ActionPlan
- 多店铺扩展

---

## 七、退出标准（Exit Criteria）

- [ ] 真实受控 PDD inbound 被观察到
- [ ] 持久化的标准化 inbound 消息存在
- [ ] 一个 AI turn 从聚合窗口构建
- [ ] 场景结果被记录
- [ ] 权威事实/知识来源被记录
- [ ] ReplyPlan 被记录
- [ ] 策略结果被记录
- [ ] **TRANSPORT SEND CALLS = 0**
- [ ] 持久化审计关联完整
- [ ] Typecheck 通过
- [ ] 单元测试通过（DEFERRED: 需在个人电脑运行）

---

## 八、客户价值

**Customer value:** 可衡量的 AI 回复质量，无客户副作用  
**Safety value:** 在首次生产发送前验证完整循环

---

## 九、风险和缓解

### 风险 1：真实 PDD inbound 不可用
- **风险：** 受控店铺可能没有真实消息
- **缓解：** 使用测试账号发送测试消息
- **状态:** CONFIRMED

### 风险 2：Transport 泄漏
- **风险：** 可能在某个环节意外调用 transport
- **缓解：** TransportBlocker 在多个层级拦截
- **状态:** CONFIRMED

### 风险 3：审计数据量过大
- **风险：** 每个环节都记录可能导致数据量爆炸
- **缓解：** 仅记录关键字段，不记录完整对象
- **状态:** CONFIRMED

---

**文档版本:** v1.0  
**创建日期:** 2026-09-30  
**创建人:** Codex  
**审核状态:** 待 Controller 审核
