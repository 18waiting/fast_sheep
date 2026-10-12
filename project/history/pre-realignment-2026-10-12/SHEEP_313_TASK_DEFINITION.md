# SHEEP-313 — Multi-Shop Expansion Proof (多店铺扩展验证)

**Status:** `PLANNED / NOT_AUTHORIZED`  
**Milestone:** `MVP-E MULTI_SHOP_EXPANSION`  
**Dependencies:** `SHEEP-312` ✅ (COMPLETE)  
**Estimated Days:** 7  
**Created:** 2026-09-30  

---

## 1. Product Alignment Guard

```text
PRODUCT_ALIGNMENT: 多店铺隔离验证是 MVP 扩展的基础前提，不是功能开发
CURRENT_MVP_RELEVANCE: MVP-E 的唯一任务，证明系统可以从单店铺安全扩展到多店铺
CUSTOMER_VALUE: 商家可能同时经营多个店铺，隔离性是基本安全需求
SAFETY_IMPACT: 隔离失败 = 数据泄漏 = 严重安全事故（客户信息串店、知识泄漏）
OUT_OF_SCOPE: 不涉及 AI 能力、不涉及真实平台对接、不涉及生产授权
DECISION: PROCEED
```

---

## 2. 目标 (Goal)

**证明多店铺隔离性不是推断出来的，而是验证过的。**

当前系统（SHEEP-305~312）已经完成了单店铺的完整安全执行层。但"单店铺安全"不等于"多店铺安全"。SHEEP-313 的目标是：

1. **配置两个独立的测试店铺**（合成数据，不需要真实平台）
2. **运行 8 类隔离测试**，覆盖所有可能的跨店铺泄漏路径
3. **产出治理证据**，证明隔离机制在代码层面是可靠的

### 2.1 关键约束

- ✅ **使用模拟数据** — 不需要真实店铺、真实客户、真实平台
- ✅ **代码层面验证** — 测试隔离机制，不是测试业务逻辑
- ❌ **不涉及生产授权** — 这是开发验证，不是生产验证
- ❌ **不修改现有架构** — 只验证现有隔离机制是否有效

---

## 3. 当前架构隔离分析

### 3.1 已有的隔离机制

| 层级 | 隔离机制 | 实现位置 | 状态 |
|------|----------|----------|------|
| **运行时状态** | `conversations` Map 以 `shopId\0conversationId` 为 key | `conversation-orchestrator.ts:118` | ✅ 已实现 |
| **发送序列化** | `SendSerializer` 以 `shopId\0conversationId` 为 key | `send-serializer.ts:12` | ✅ 已实现 |
| **身份锁定** | `IdentityLock` 包含 `merchant_id + store_id` | `human-confirm-controller.ts:52-53` | ✅ 已实现 |
| **确认验证** | `validateConfirmation` 检查 merchant_id 和 store_id | `human-confirm-controller.ts:388-392` | ✅ 已实现 |
| **持久化** | `normalized_conversations` 包含 `merchant_id, store_id` | `sqlite-conversation-repositories.ts:39` | ✅ 已实现 |
| **知识过滤** | `KnowledgeFilter` 按 `storeKnowledgeType` 过滤 | `knowledge.ts` | ⚠️ 需验证 store 维度 |
| **IPC 通道** | `activateShop`, `focusShop` 等按 shopId 路由 | `channels.ts` | ✅ 已实现 |
| **审计链** | `AuditCorrelation` 包含 `shop_id` | `audit-correlation.ts:70` | ✅ 已实现 |

### 3.2 需要验证的隔离风险点

| 风险 | 描述 | 严重性 | 验证方式 |
|------|------|--------|----------|
| **运行时状态串店** | 店铺 A 的消息进入店铺 B 的 ConversationRuntimeState | HIGH | 并发测试 |
| **发送目标混淆** | 店铺 A 的发送请求发到店铺 B 的会话 | HIGH | 对抗性测试 |
| **知识泄漏** | 店铺 A 的知识库被店铺 B 的查询命中 | MEDIUM | 知识隔离测试 |
| **审计记录交叉** | 店铺 A 的审计记录包含店铺 B 的事件 | MEDIUM | 审计隔离测试 |
| **配置污染** | 店铺 A 的配置影响店铺 B 的行为 | MEDIUM | 配置隔离测试 |
| **故障传播** | 店铺 A 崩溃导致店铺 B 不可用 | HIGH | 故障恢复测试 |
| **身份锁定跨店** | 店铺 A 的确认被用于店铺 B 的执行 | HIGH | 对抗性测试 |
| **数据库隔离** | SQLite 查询没有正确过滤 store_id | HIGH | 数据隔离测试 |

---

## 4. 退出标准 (Exit Criteria)

SHEEP-313 完成需要满足以下 **全部 8 项** 隔离验证通过：

### 4.1 EC-1: 并发运行隔离

```
GIVEN    两个店铺 Shop-A 和 Shop-B 同时激活
WHEN     两个店铺同时接收消息、处理消息、发送回复
THEN     每个店铺的运行时状态独立
AND      不存在跨店铺的 Map key 冲突
AND      SendSerializer 正确隔离两个店铺的发送队列
```

**验收测试:**
- 两个店铺并发处理 100 条消息，无串店
- 发送队列独立，Shop-A 的发送不阻塞 Shop-B

### 4.2 EC-2: 会话/客户隔离

```
GIVEN    Shop-A 有客户 C-A，Shop-B 有客户 C-B
WHEN     C-A 和 C-B 同时发消息
THEN     C-A 的消息只进入 Shop-A 的会话
AND      C-B 的消息只进入 Shop-B 的会话
AND      相同 customer_identity.value 在不同店铺是不同客户
```

**验收测试:**
- 相同 buyer_id 在不同店铺创建不同会话
- 消息路由正确，无跨店铺会话

### 4.3 EC-3: 知识/RAG 隔离

```
GIVEN    Shop-A 有知识条目 K-A（发货时间 48 小时）
AND      Shop-B 有知识条目 K-B（发货时间 24 小时）
WHEN     Shop-A 的会话查询发货时间
THEN     只返回 K-A，不返回 K-B
AND      反之亦然
```

**验收测试:**
- 店铺知识查询只返回本店铺的知识
- 向量检索（如果实现）按 store_id 过滤

### 4.4 EC-4: 发送隔离

```
GIVEN    Shop-A 的确认绑定到 Shop-A 的 IdentityLock
WHEN     尝试用 Shop-A 的确认发送到 Shop-B 的会话
THEN     发送被拒绝
AND      validateConfirmation 返回 false
```

**验收测试:**
- 跨店铺发送被 IdentityLock 验证拦截
- 跨店铺确认被 HumanConfirmController 拒绝

### 4.5 EC-5: 审计/交接隔离

```
GIVEN    Shop-A 有审计记录 Audit-A
AND      Shop-B 有审计记录 Audit-B
WHEN     查询 Shop-A 的审计记录
THEN     只返回 Audit-A，不包含 Audit-B
AND      audit_id 包含 shop_id 信息
```

**验收测试:**
- 审计记录按 shop_id 正确隔离
- 审计查询不会返回跨店铺记录

### 4.6 EC-6: 故障/恢复隔离

```
GIVEN    Shop-A 和 Shop-B 同时运行
WHEN     Shop-A 的处理抛出异常
THEN     Shop-B 的处理不受影响
AND      Shop-B 可以继续正常处理消息
```

**验收测试:**
- 模拟 Shop-A 崩溃，Shop-B 继续运行
- 故障不传播到另一个店铺的运行时状态

### 4.7 EC-7: 配置隔离

```
GIVEN    Shop-A 配置 rollout_mode = "HUMAN_CONFIRM"
AND      Shop-B 配置 rollout_mode = "SHADOW"
WHEN     Shop-A 收到消息
THEN     需要人工确认
WHEN     Shop-B 收到消息
THEN     不需要人工确认
```

**验收测试:**
- 不同店铺的配置独立生效
- 配置变更不影响其他店铺

### 4.8 EC-8: 跨商户对抗测试

```
GIVEN    攻击者拥有 Shop-A 的上下文
WHEN     尝试访问 Shop-B 的数据或操作
THEN     所有跨商户操作被拒绝
AND      包括：数据查询、发送操作、配置修改、审计访问
```

**验收测试:**
- 15+ 个对抗性测试场景全部通过
- 覆盖所有已知的跨店铺攻击向量

---

## 5. 非目标 (Out of Scope)

以下内容 **不在** SHEEP-313 范围内：

| 非目标 | 原因 |
|--------|------|
| 真实平台对接 | 需要 Owner 单独授权，属于"真实平台验证" |
| AI 能力开发 | 属于 MVP-C/MVP-D 范围 |
| 生产环境部署 | 需要生产授权，属于后续里程碑 |
| 性能/压力测试 | 隔离验证不等于性能验证 |
| 多平台支持 | 多店铺 ≠ 多平台，先验证单平台多店铺 |
| 修改现有架构 | 只验证，不重构 |

---

## 6. 测试策略

### 6.1 测试环境

- **环境:** macOS 开发环境（公司电脑）
- **Node.js:** v20（typecheck 为最高验证标准）
- **数据:** 合成数据，不需要真实店铺
- **数据库:** 隔离的 `.tmp` SQLite 数据库

### 6.2 测试类型

| 测试类型 | 数量 | 说明 |
|----------|------|------|
| **单元测试** | ~30 | 各隔离机制的独立测试 |
| **集成测试** | ~15 | 跨组件隔离验证 |
| **对抗性测试** | ~15 | 模拟攻击场景 |
| **故障注入测试** | ~5 | 故障传播验证 |
| **总计** | ~65 | 覆盖 8 项退出标准 |

### 6.3 测试执行约束

- ✅ typecheck 通过 = 代码正确性最高保证
- ⏳ 单元测试需要在个人电脑 (Node.js v22+) 上运行
- 📝 测试要求记录在 `PERSONAL_PC_TEST_SUMMARY.md`

---

## 7. 交付物 (Deliverables)

| 交付物 | 路径 | 说明 |
|--------|------|------|
| 任务定义 | `project/SHEEP_313_TASK_DEFINITION.md` | 本文档 |
| 执行计划 | `project/SHEEP_313_EXECUTION_PLAN.md` | 子任务拆分 |
| 隔离审计报告 | `project/SHEEP_313_ISOLATION_AUDIT.md` | 现有隔离机制审计 |
| 并发测试 | `packages/orchestrator/tests/multi-shop-concurrency.test.ts` | EC-1 |
| 会话隔离测试 | `packages/orchestrator/tests/multi-shop-conversation.test.ts` | EC-2 |
| 知识隔离测试 | `packages/domain/tests/multi-shop-knowledge.test.ts` | EC-3 |
| 发送隔离测试 | `packages/orchestrator/tests/multi-shop-send.test.ts` | EC-4 |
| 审计隔离测试 | `packages/domain/tests/multi-shop-audit.test.ts` | EC-5 |
| 故障隔离测试 | `packages/orchestrator/tests/multi-shop-failure.test.ts` | EC-6 |
| 配置隔离测试 | `packages/orchestrator/tests/multi-shop-config.test.ts` | EC-7 |
| 对抗性测试 | `packages/orchestrator/tests/multi-shop-adversarial.test.ts` | EC-8 |
| 任务报告 | `project/SHEEP_313_TASK_REPORT.md` | 最终报告 |

---

## 8. 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 现有隔离机制有漏洞 | MEDIUM | HIGH | 先审计后测试，发现问题立即记录 |
| 知识隔离未实现 store 维度 | HIGH | MEDIUM | 如果发现缺失，记录为 PRODUCT_DECISION_REQUIRED |
| 测试环境限制 | LOW | LOW | typecheck 通过即可，测试 DEFERRED 到个人电脑 |
| 发现架构缺陷 | LOW | HIGH | 记录但不修复，留给后续任务 |

---

## 9. 成功标准

SHEEP-313 成功 = **8 项退出标准全部通过** + **typecheck 通过** + **测试记录完整**

如果某项隔离验证失败：
- 记录为 `BLOCKED` 或 `PRODUCT_DECISION_REQUIRED`
- 完成其他独立验证
- 不声称 `COMPLETE`，声称 `PARTIAL`

---

## 10. 治理依据

- **Roadmap V1.1:** `MVP-E MULTI_SHOP_EXPANSION` → `SHEEP-313`
- **Master Prompt §5.4:** merchant_id / store_id / platform_account_id scoping
- **REPLY_AND_ACTION_SAFETY:** tenant isolation is mandatory
- **DECISIONS.md:** 多店铺隔离是扩展前提

---

**文档版本:** 1.0  
**创建日期:** 2026-09-30  
**状态:** PLANNED
