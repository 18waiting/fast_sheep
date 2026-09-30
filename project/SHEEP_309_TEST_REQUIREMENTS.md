# SHEEP-309 测试要求

**任务：** SHADOW End-to-End Audit  
**日期：** 2026-09-30  
**状态：** 待测试（需要在个人电脑上运行）  
**环境要求：** Windows + Node.js v22+（支持 `--experimental-strip-types`）

---

## 一、单元测试

### 1.1 AuditLogger 测试

**文件：** `apps/desktop/tests/audit-logger.test.ts`（已创建）

**测试用例：**

| # | 测试名称 | 描述 | 预期结果 |
|---|---------|------|---------|
| 1 | startRun | 创建新的审计运行 | 返回 AuditRun，status=RUNNING |
| 2 | completeRun | 完成审计运行 | status 更新为 COMPLETED，completedAt 设置 |
| 3 | failRun | 标记运行为失败 | status 更新为 FAILED，errorSummary 记录 |
| 4 | recordStep (SUCCESS) | 记录成功步骤 | 步骤持久化，status=SUCCESS |
| 5 | recordStep (FAILED) | 记录失败步骤 | 步骤持久化，status=FAILED，errorDetail 记录 |
| 6 | recordEvent | 记录细粒度事件 | 事件持久化，eventType 和 eventData 正确 |
| 7 | getRun | 获取运行记录 | 返回正确的 AuditRun |
| 8 | getSteps | 获取步骤列表 | 返回按 stepOrder 排序的步骤数组 |
| 9 | getEvents | 获取事件列表 | 返回按 createdAt 排序的事件数组 |

**运行命令：**
```bash
pnpm run test apps/desktop/tests/audit-logger.test.ts
```

---

### 1.2 TransportBlocker 测试

**文件：** `apps/desktop/tests/transport-blocker.test.ts`（已创建）

**测试用例：**

| # | 测试名称 | 描述 | 预期结果 |
|---|---------|------|---------|
| 1 | isTransportAllowed (OFF) | OFF 模式阻止 transport | 返回 false |
| 2 | isTransportAllowed (SHADOW) | SHADOW 模式阻止 transport | 返回 false |
| 3 | isTransportAllowed (HUMAN_CONFIRM) | HUMAN_CONFIRM 模式阻止 transport | 返回 false |
| 4 | isTransportAllowed (AUTO) | AUTO 模式允许 transport | 返回 true |
| 5 | recordTransportAttempt | 记录 transport 尝试 | 计数器增加 |
| 6 | getTransportCallCount | 获取尝试次数 | 返回正确的计数 |
| 7 | verifyZeroSends (无尝试) | 无尝试时验证 | allowed=true, successfulSends=0 |
| 8 | verifyZeroSends (有尝试) | 有尝试时验证 | allowed=false, successfulSends>0 |
| 9 | reset | 重置计数器 | 计数归零 |

**运行命令：**
```bash
pnpm run test apps/desktop/tests/transport-blocker.test.ts
```

---

### 1.3 ShadowPipelineOrchestrator 测试（待创建）

**文件：** `apps/desktop/tests/shadow-pipeline-orchestrator.test.ts`（待创建）

**测试用例：**

| # | 测试名称 | 描述 | 预期结果 |
|---|---------|------|---------|
| 1 | execute - 完整流水线 | 正常执行所有 11 步 | status=COMPLETED，11 个步骤记录 |
| 2 | execute - IdentityLock 不完整 | merchantId 缺失 | Step 1 失败，但流水线继续 |
| 3 | execute - 重复消息 | persistence 返回 DUPLICATE | 提前返回，totalMessages=0 |
| 4 | execute - Turn 不可用 | quiet window 未过期 | 等待后超时，提前返回 |
| 5 | execute - RPC 失败 | workerClient.run 抛出异常 | Step 7 失败，流水线继续 |
| 6 | execute - Transport 安全验证 | verifyZeroSends 通过 | Step 10 成功，successfulSends=0 |
| 7 | execute - Transport 安全违规 | 检测到 transport 调用 | Step 10 失败，抛出异常 |
| 8 | execute - 审计完整性 | 所有步骤记录到 AuditLogger | getSteps 返回 11 个步骤 |
| 9 | execute - 错误处理 | 未捕获异常 | status=FAILED，failRun 调用 |

**依赖注入（Mock）：**
- CanonicalInboundPersistence（mock）
- InboundTurnBuilder（mock，返回预设 turn）
- MinimalSceneClassifier（mock，返回 SHIPPING_TIME）
- StoreKnowledgeRetrievalPort（mock，返回空知识）
- AuthoritativeFactsPort（mock，返回空事实）
- ContextEnvelopeBuilder（mock，返回预设 envelope）
- WorkerJobClientPort（mock，返回预设 ReplyPlan）
- PolicyEngine（mock，返回 SHADOW 决策）
- PolicyConfig（使用 createSimplePolicyConfig("SHADOW")）
- AuditLogger（使用真实 SQLite 连接）
- TransportBlocker（使用真实实例）

---

### 1.4 AuditReportGenerator 测试（待创建）

**文件：** `apps/desktop/tests/audit-report-generator.test.ts`（待创建）

**测试用例：**

| # | 测试名称 | 描述 | 预期结果 |
|---|---------|------|---------|
| 1 | generateReport - 完整运行 | 从完整运行生成报告 | 包含所有步骤和指标 |
| 2 | generateReport - 失败运行 | 从失败运行生成报告 | status=FAILED，包含错误详情 |
| 3 | generateReport - 关键指标提取 | 提取 scene, knowledge, ReplyPlan, policy | 指标正确 |
| 4 | generateReport - 安全验证 | transportCalls=0 | allZero=true |
| 5 | generateMarkdownReport | 生成 Markdown 格式 | 包含表格和步骤详情 |
| 6 | generateReport - 运行不存在 | runId 无效 | 抛出异常 |

---

## 二、集成测试

### 2.1 SHADOW 模式端到端测试

**场景：** 模拟真实 PDD inbound 消息通过完整 SHADOW 流水线

**步骤：**
1. 创建 InboundEnvelope（模拟 PDD 消息）
2. 调用 `bootstrapShadowMode()` 初始化组件
3. 调用 `orchestrator.execute(envelope, shopId, merchantId)`
4. 验证返回结果：
   - `status === "COMPLETED"`
   - `steps.length === 11`
   - `transportVerification.successfulSends === 0`
   - `envelope` 和 `replyPlan` 存在
5. 调用 `reportGenerator.generateMarkdownReport(runId)`
6. 验证 Markdown 报告包含所有步骤

**预期结果：**
- 完整流水线执行成功
- 所有 11 个步骤记录到审计数据库
- TRANSPORT SEND CALLS = 0
- 审计报告生成成功

---

### 2.2 worker-runtime 集成测试

**场景：** 验证 `initializeShadowMode()` 正确集成到 worker-runtime

**步骤：**
1. 创建 WorkerBackedMainDeps（mock workerClient）
2. 调用 `initializeShadowMode(deps)`
3. 验证返回的 ShadowModeComponents：
   - orchestrator 存在
   - auditLogger 存在
   - transportBlocker 存在
   - reportGenerator 存在
4. 使用 orchestrator 执行一次 SHADOW 流水线
5. 验证执行成功

**预期结果：**
- 所有组件正确初始化
- 依赖注入正确
- SHADOW 流水线可执行

---

## 三、运行时验证

### 3.1 真实 PDD Inbound 测试

**前提：** 需要在个人电脑上配置受控 PDD 测试店铺

**步骤：**
1. 启动应用，登录受控 PDD 店铺
2. 使用测试账号向店铺发送消息
3. 观察 SHADOW 流水线是否触发
4. 检查审计数据库（shadow_audit_runs, shadow_audit_steps, shadow_audit_events）
5. 验证：
   - 运行记录存在
   - 所有 11 个步骤记录
   - TRANSPORT SEND CALLS = 0
   - ReplyPlan 生成
   - PolicyDecision 记录

**预期结果：**
- 真实 inbound 消息触发 SHADOW 流水线
- 完整审计记录生成
- 零 transport 调用

---

## 四、性能测试

### 4.1 流水线延迟测试

**场景：** 测量 SHADOW 流水线执行时间

**指标：**
- 总执行时间（目标 < 2 秒）
- 各步骤耗时分布
- 数据库写入延迟

**方法：**
```typescript
const startTime = Date.now();
const result = await orchestrator.execute(envelope, shopId, merchantId);
const totalTime = Date.now() - startTime;

console.log(`Total time: ${totalTime}ms`);
result.steps.forEach(step => {
  console.log(`Step ${step.stepOrder} (${step.stepName}): ${step.durationMs}ms`);
});
```

---

## 五、安全测试

### 5.1 Transport 隔离测试

**场景：** 验证 SHADOW 模式下没有任何 transport 调用

**方法：**
1. 在 TransportBlocker 中注入 spy
2. 执行 SHADOW 流水线
3. 验证 `recordTransportAttempt` 从未被调用
4. 验证 `verifyZeroSends()` 返回 `successfulSends === 0`

**预期结果：**
- 零 transport 调用
- 零平台 API 调用
- 零消息发送

---

## 六、测试执行清单

### 个人电脑测试环境

```bash
# 1. 确保 Node.js v22+
node --version  # 应该 >= v22.0.0

# 2. 运行所有单元测试
pnpm run test

# 3. 运行特定测试
pnpm run test apps/desktop/tests/audit-logger.test.ts
pnpm run test apps/desktop/tests/transport-blocker.test.ts

# 4. 运行集成测试（待创建）
pnpm run test apps/desktop/tests/shadow-pipeline-orchestrator.test.ts
pnpm run test apps/desktop/tests/audit-report-generator.test.ts

# 5. 运行端到端测试（待创建）
pnpm run test:integration
```

---

## 七、测试通过标准

| 类别 | 通过标准 |
|------|---------|
| 单元测试 | 所有测试用例通过 |
| 集成测试 | SHADOW 流水线端到端执行成功 |
| 运行时验证 | 真实 PDD inbound 触发流水线 |
| 性能测试 | 总执行时间 < 2 秒 |
| 安全测试 | TRANSPORT SEND CALLS = 0 |

---

## 八、待创建测试文件

以下测试文件需要在个人电脑上创建：

1. `apps/desktop/tests/shadow-pipeline-orchestrator.test.ts`
2. `apps/desktop/tests/audit-report-generator.test.ts`
3. `apps/desktop/tests/integration/shadow-mode-integration.test.ts`
4. `apps/desktop/tests/e2e/shadow-pipeline-e2e.test.ts`

---

**文档版本：** v1.0  
**创建日期：** 2026-09-30  
**创建人：** Codex (SHEEP-309)  
**测试状态：** 待执行（需要个人电脑环境）
