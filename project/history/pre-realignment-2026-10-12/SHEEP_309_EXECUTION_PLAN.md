# SHEEP-309 执行计划：SHADOW End-to-End Audit

**任务 ID:** SHEEP-309  
**状态:** PLANNING  
**日期:** 2026-09-30  
**依赖:** SHEEP-300 ~ SHEEP-308 ✅  

---

## 一、Product Alignment Guard

```text
PRODUCT_ALIGNMENT: ✅ ALIGNED
CURRENT_MVP_RELEVANCE: MVP-B SHADOW — 核心验证任务
CUSTOMER_VALUE: 可衡量的 AI 回复质量，无客户副作用
SAFETY_IMPACT: 在首次生产发送前验证完整循环
OUT_OF_SCOPE: 不发送任何消息，不授权 AUTO 模式
DECISION: PROCEED
```

---

## 二、架构概览

### 2.1 端到端流水线

```
真实 PDD Inbound (受控店铺)
  ↓
[1] PDD Inbound Observer → InboundEnvelope
  ↓
[2] CanonicalInboundPersistence → 持久化消息 (normalized_messages)
  ↓
[3] InboundTurnBuilder → AI Turn (聚合窗口)
  ↓
[4] MinimalSceneClassifier → Scene 分类
  ↓
[5] StoreKnowledgeRetrieval → 知识检索 (SHEEP-305 场景路由)
  ↓
[6] ContextEnvelopeBuilder → ContextEnvelope (SHEEP-306)
  ↓
[7] RPC → conversation.generate_v2 → ReplyPlan (SHEEP-307)
  ↓
[8] PolicyEngine.evaluate() → PolicyDecision (SHEEP-308)
  ↓
[9] AuditLogger → 持久化审计记录 (SHEEP-309 新增)
  ↓
[10] TransportBlocker → 验证 TRANSPORT SEND CALLS = 0 (SHEEP-309 新增)
  ↓
[11] AuditReportGenerator → 审计报告 (SHEEP-309 新增)
```

### 2.2 新增组件

| 组件 | 文件路径 | 职责 |
|------|---------|------|
| DB Migration | `resources/persistence/migrations/0009_shadow_audit.sql` | 创建审计表 |
| AuditLogger | `apps/desktop/src/main/services/audit-logger.ts` | 记录每个环节的中间结果 |
| TransportBlocker | `apps/desktop/src/main/services/transport-blocker.ts` | 阻止所有 transport 调用 |
| ShadowPipelineOrchestrator | `apps/desktop/src/main/services/shadow-pipeline-orchestrator.ts` | 串联所有组件 |
| AuditReportGenerator | `apps/desktop/src/main/services/audit-report-generator.ts` | 生成审计报告 |

---

## 三、子任务拆解

### 子任务 1：数据库迁移（0009_shadow_audit.sql）

**目标：** 创建 SHADOW 审计所需的数据库表结构

**文件：**
- 新建：`resources/persistence/migrations/0009_shadow_audit.sql`

**表设计：**

```sql
-- 审计运行表：每次端到端执行一条记录
CREATE TABLE shadow_audit_runs (
  id TEXT PRIMARY KEY,                    -- UUID
  started_at TEXT NOT NULL,               -- ISO 8601
  completed_at TEXT,                      -- ISO 8601 (NULL = in progress)
  status TEXT NOT NULL DEFAULT 'RUNNING'  -- RUNNING / COMPLETED / FAILED
    CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
  shop_id TEXT NOT NULL,                  -- 受控店铺 ID
  merchant_id TEXT NOT NULL,              -- 商户 ID
  total_messages INTEGER NOT NULL DEFAULT 0,
  transport_send_calls INTEGER NOT NULL DEFAULT 0,  -- 关键安全指标
  error_summary TEXT                      -- JSON: 错误摘要
);

-- 审计步骤表：每个环节的中间结果
CREATE TABLE shadow_audit_steps (
  id TEXT PRIMARY KEY,                    -- UUID
  run_id TEXT NOT NULL,                   -- FK → shadow_audit_runs.id
  step_order INTEGER NOT NULL,            -- 步骤顺序 (1-11)
  step_name TEXT NOT NULL,                -- 步骤名称
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED')),
  started_at TEXT,                        -- ISO 8601
  completed_at TEXT,                      -- ISO 8601
  input_summary TEXT,                     -- JSON: 输入摘要
  output_summary TEXT,                    -- JSON: 输出摘要
  error_detail TEXT,                      -- JSON: 错误详情
  duration_ms INTEGER                     -- 执行耗时
);

-- 审计事件表：细粒度事件记录
CREATE TABLE shadow_audit_events (
  id TEXT PRIMARY KEY,                    -- UUID
  run_id TEXT NOT NULL,                   -- FK → shadow_audit_runs.id
  step_id TEXT,                           -- FK → shadow_audit_steps.id (可选)
  event_type TEXT NOT NULL,               -- 事件类型
  event_data TEXT NOT NULL,               -- JSON: 事件数据
  created_at TEXT NOT NULL                -- ISO 8601
);

-- 索引
CREATE INDEX idx_shadow_audit_runs_shop ON shadow_audit_runs(shop_id);
CREATE INDEX idx_shadow_audit_runs_status ON shadow_audit_runs(status);
CREATE INDEX idx_shadow_audit_steps_run ON shadow_audit_steps(run_id);
CREATE INDEX idx_shadow_audit_steps_order ON shadow_audit_steps(run_id, step_order);
CREATE INDEX idx_shadow_audit_events_run ON shadow_audit_events(run_id);
CREATE INDEX idx_shadow_audit_events_type ON shadow_audit_events(event_type);
```

**验收标准（AC）：**
- [ ] AC1: SQL 文件语法正确，可被 SQLite 执行
- [ ] AC2: 三张表（runs, steps, events）全部创建成功
- [ ] AC3: CHECK 约束正确（status 枚举值）
- [ ] AC4: 索引全部创建成功
- [ ] AC5: 0001-0008 迁移未被修改
- [ ] AC6: 迁移是幂等的（可重复执行不报错，使用 IF NOT EXISTS）

**工作量估算：** 0.5 天

---

### 子任务 2：AuditLogger 实现

**目标：** 实现审计日志记录服务，持久化每个环节的中间结果

**文件：**
- 新建：`apps/desktop/src/main/services/audit-logger.ts`
- 新建：`apps/desktop/src/main/ports/audit-logger-port.ts`（端口接口）

**接口设计：**

```typescript
// 端口接口
export interface AuditLoggerPort {
  startRun(shopId: string, merchantId: string): Promise<AuditRun>;
  completeRun(runId: string, summary: RunSummary): Promise<void>;
  failRun(runId: string, error: Error): Promise<void>;
  recordStep(runId: string, step: AuditStep): Promise<void>;
  recordEvent(runId: string, event: AuditEvent): Promise<void>;
  getRun(runId: string): Promise<AuditRun | null>;
  getSteps(runId: string): Promise<AuditStep[]>;
  getEvents(runId: string): Promise<AuditEvent[]>;
}

// 审计运行
export interface AuditRun {
  id: string;
  shopId: string;
  merchantId: string;
  startedAt: string;
  completedAt?: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  totalMessages: number;
  transportSendCalls: number;
  errorSummary?: string;
}

// 审计步骤
export interface AuditStep {
  id: string;
  runId: string;
  stepOrder: number;
  stepName: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  startedAt?: string;
  completedAt?: string;
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
  errorDetail?: Record<string, unknown>;
  durationMs?: number;
}

// 审计事件
export interface AuditEvent {
  id: string;
  runId: string;
  stepId?: string;
  eventType: string;
  eventData: Record<string, unknown>;
  createdAt: string;
}

// 运行摘要
export interface RunSummary {
  totalMessages: number;
  transportSendCalls: number;  // 必须 = 0
}
```

**实现要点：**
- 使用 SQLite 直接写入（共享 m10Sqlite.conn）
- JSON 字段使用 `JSON.stringify/parse`
- 所有时间使用 ISO 8601 格式
- 错误处理：失败不中断流水线，仅记录

**验收标准（AC）：**
- [ ] AC1: AuditLogger 实现 AuditLoggerPort 接口
- [ ] AC2: startRun() 创建 shadow_audit_runs 记录
- [ ] AC3: recordStep() 创建 shadow_audit_steps 记录
- [ ] AC4: recordEvent() 创建 shadow_audit_events 记录
- [ ] AC5: completeRun() 更新运行状态和摘要
- [ ] AC6: failRun() 记录错误并更新状态
- [ ] AC7: getRun/getSteps/getEvents 正确查询
- [ ] AC8: Typecheck 通过
- [ ] AC9: 单元测试文件创建（DEFERRED: 个人电脑运行）

**工作量估算：** 1 天

---

### 子任务 3：TransportBlocker 实现

**目标：** 在 SHADOW 模式下阻止所有 transport 调用，验证零发送

**文件：**
- 新建：`apps/desktop/src/main/services/transport-blocker.ts`
- 新建：`apps/desktop/src/main/ports/transport-blocker-port.ts`（端口接口）

**接口设计：**

```typescript
export interface TransportBlockerPort {
  /** 检查是否允许 transport 调用 */
  isTransportAllowed(mode: RolloutMode): boolean;
  
  /** 记录 transport 调用尝试（用于审计） */
  recordTransportAttempt(attempt: TransportAttempt): void;
  
  /** 获取 transport 调用计数 */
  getTransportCallCount(): number;
  
  /** 验证零发送（SHADOW 模式必须 = 0） */
  verifyZeroSends(): TransportVerification;
  
  /** 重置计数器（新运行开始时调用） */
  reset(): void;
}

export interface TransportAttempt {
  id: string;
  runId: string;
  timestamp: string;
  method: string;       // 尝试调用的方法名
  blocked: boolean;     // 是否被阻止
  reason: string;       // 阻止原因
}

export interface TransportVerification {
  allowed: boolean;           // 是否通过验证
  totalAttempts: number;      // 总尝试次数
  blockedAttempts: number;    // 被阻止次数
  successfulSends: number;    // 成功发送次数（必须 = 0）
  message: string;            // 验证消息
}
```

**实现要点：**
- SHADOW 模式下 `isTransportAllowed()` 始终返回 `false`
- 所有 transport 调用尝试都被记录并阻止
- `verifyZeroSends()` 检查 `successfulSends === 0`
- 计数器在每次运行开始时重置

**验收标准（AC）：**
- [ ] AC1: TransportBlocker 实现 TransportBlockerPort 接口
- [ ] AC2: SHADOW 模式下 `isTransportAllowed("SHADOW")` 返回 `false`
- [ ] AC3: OFF 模式下 `isTransportAllowed("OFF")` 返回 `false`
- [ ] AC4: HUMAN_CONFIRM 模式下 `isTransportAllowed("HUMAN_CONFIRM")` 返回 `false`（MVP）
- [ ] AC5: AUTO 模式下 `isTransportAllowed("AUTO")` 返回 `true`（但 MVP 不授权 AUTO）
- [ ] AC6: `recordTransportAttempt()` 记录每次尝试
- [ ] AC7: `verifyZeroSends()` 在无调用时返回 `{ allowed: true, successfulSends: 0 }`
- [ ] AC8: `verifyZeroSends()` 在有调用时返回 `{ allowed: false, successfulSends: >0 }`
- [ ] AC9: `reset()` 正确重置计数器
- [ ] AC10: Typecheck 通过

**工作量估算：** 0.5 天

---

### 子任务 4：ShadowPipelineOrchestrator 实现

**目标：** 串联所有组件，执行端到端 SHADOW 流水线

**文件：**
- 新建：`apps/desktop/src/main/services/shadow-pipeline-orchestrator.ts`

**接口设计：**

```typescript
export interface ShadowPipelineOrchestratorOptions {
  // 依赖注入
  readonly persistence: CanonicalInboundPersistence;
  readonly turnBuilder: InboundTurnBuilder;
  readonly sceneClassifier: MinimalSceneClassifier;
  readonly knowledgePort: StoreKnowledgeRetrievalPort;
  readonly factsPort: AuthoritativeFactsPort;
  readonly envelopeBuilder: ContextEnvelopeBuilder;
  readonly workerClient: WorkerJobClientPort;  // RPC 调用 Python
  readonly policyEngine: PolicyEngine;
  readonly policyConfig: PolicyConfig;
  readonly auditLogger: AuditLoggerPort;
  readonly transportBlocker: TransportBlockerPort;
  readonly eventSink?: (event: string, payload: Record<string, unknown>) => void;
}

export interface ShadowPipelineResult {
  runId: string;
  success: boolean;
  steps: AuditStep[];
  envelope?: ContextEnvelope;
  replyPlan?: ReplyPlan;
  policyDecision?: PolicyDecision;
  transportVerification: TransportVerification;
  error?: Error;
}

export class ShadowPipelineOrchestrator {
  /**
   * 执行端到端 SHADOW 流水线
   * 
   * @param inboundEnvelope - 真实 PDD InboundEnvelope
   * @returns ShadowPipelineResult
   */
  async execute(inboundEnvelope: InboundEnvelope): Promise<ShadowPipelineResult>;
}
```

**执行流程（11 步）：**

```typescript
async execute(envelope: InboundEnvelope): Promise<ShadowPipelineResult> {
  const runId = randomUUID();
  
  // Step 0: 启动审计运行
  await this.auditLogger.startRun(envelope.merchantId, envelope.storeId);
  
  try {
    // Step 1: 验证 IdentityLock (SHEEP-300)
    await this.recordStep(runId, 1, "IDENTITY_LOCK", () => {
      this.validateIdentityLock(envelope);
    });
    
    // Step 2: 持久化标准化消息 (SHEEP-302)
    const persistenceResult = await this.recordStep(runId, 2, "PERSISTENCE", async () => {
      return await this.persistence.ingest(envelope);
    });
    
    // Step 3: 聚合构建 AI Turn (SHEEP-303)
    const turn = await this.recordStep(runId, 3, "TURN_BUILD", async () => {
      return await this.turnBuilder.ingest(persistenceResult);
    });
    
    // Step 4: 场景分类 (SHEEP-304)
    const scene = await this.recordStep(runId, 4, "SCENE_CLASSIFY", async () => {
      return await this.sceneClassifier.classify(turn);
    });
    
    // Step 5: 知识检索 (SHEEP-305)
    const knowledge = await this.recordStep(runId, 5, "KNOWLEDGE_RETRIEVAL", async () => {
      return await this.knowledgePort.retrieve(turn, scene);
    });
    
    // Step 6: 构建 ContextEnvelope (SHEEP-306)
    const contextEnvelope = await this.recordStep(runId, 6, "ENVELOPE_BUILD", async () => {
      return await this.envelopeBuilder.build({ turn, scene, knowledge });
    });
    
    // Step 7: AI 生成 ReplyPlan (SHEEP-307)
    const replyPlan = await this.recordStep(runId, 7, "REPLY_PLAN", async () => {
      return await this.workerClient.request("conversation.generate_v2", contextEnvelope);
    });
    
    // Step 8: 策略评估 (SHEEP-308)
    const policyDecision = await this.recordStep(runId, 8, "POLICY_EVAL", async () => {
      return await this.policyEngine.evaluate(contextEnvelope, replyPlan, this.policyConfig);
    });
    
    // Step 9: 审计持久化 (SHEEP-309)
    await this.recordStep(runId, 9, "AUDIT_PERSIST", async () => {
      // 所有步骤已自动持久化，此步确认完整性
    });
    
    // Step 10: Transport 验证 (SHEEP-309)
    const transportVerification = await this.recordStep(runId, 10, "TRANSPORT_VERIFY", () => {
      return this.transportBlocker.verifyZeroSends();
    });
    
    // Step 11: 完成审计运行
    await this.auditLogger.completeRun(runId, {
      totalMessages: 1,
      transportSendCalls: this.transportBlocker.getTransportCallCount(),
    });
    
    return { runId, success: true, steps: [...], transportVerification };
  } catch (error) {
    await this.auditLogger.failRun(runId, error);
    return { runId, success: false, error, steps: [...], transportVerification: ... };
  }
}
```

**验收标准（AC）：**
- [ ] AC1: ShadowPipelineOrchestrator 正确注入所有依赖
- [ ] AC2: execute() 按顺序执行 11 个步骤
- [ ] AC3: 每个步骤通过 AuditLogger 记录
- [ ] AC4: 步骤失败时记录错误但不中断后续步骤（MVP: 允许部分失败）
- [ ] AC5: RPC 调用 conversation.generate_v2 正确传递 ContextEnvelope
- [ ] AC6: PolicyEngine 正确评估 ReplyPlan
- [ ] AC7: TransportBlocker 验证零发送
- [ ] AC8: 审计运行正确完成或失败
- [ ] AC9: ShadowPipelineResult 包含完整的步骤和验证结果
- [ ] AC10: Typecheck 通过
- [ ] AC11: 单元测试文件创建（DEFERRED: 个人电脑运行）

**工作量估算：** 2 天

---

### 子任务 5：AuditReportGenerator 实现

**目标：** 生成人类可读的审计报告

**文件：**
- 新建：`apps/desktop/src/main/services/audit-report-generator.ts`

**接口设计：**

```typescript
export interface AuditReport {
  runId: string;
  shopId: string;
  merchantId: string;
  startedAt: string;
  completedAt: string;
  status: 'COMPLETED' | 'FAILED';
  
  // 流水线摘要
  pipelineSummary: {
    totalSteps: number;
    successfulSteps: number;
    failedSteps: number;
    skippedSteps: number;
    totalDurationMs: number;
  };
  
  // 每个步骤的详细信息
  steps: Array<{
    stepOrder: number;
    stepName: string;
    status: string;
    durationMs?: number;
    inputSummary?: Record<string, unknown>;
    outputSummary?: Record<string, unknown>;
    errorDetail?: Record<string, unknown>;
  }>;
  
  // 关键指标
  keyMetrics: {
    transportSendCalls: number;      // 必须 = 0
    transportVerified: boolean;       // 是否验证通过
    sceneDetected: string | null;
    knowledgeRetrieved: number;
    replyPlanGenerated: boolean;
    policyDecision: string | null;    // rollout_mode
  };
  
  // 安全验证
  safetyVerification: {
    transportCalls: number;
    platformApiCalls: number;
    messagesSent: number;
    allZero: boolean;                 // 所有指标必须 = 0
  };
}

export class AuditReportGenerator {
  constructor(private readonly auditLogger: AuditLoggerPort) {}
  
  async generateReport(runId: string): Promise<AuditReport>;
  
  // 生成 Markdown 格式的报告
  async generateMarkdownReport(runId: string): Promise<string>;
}
```

**验收标准（AC）：**
- [ ] AC1: AuditReportGenerator 正确生成 AuditReport
- [ ] AC2: 报告包含所有 11 个步骤的详细信息
- [ ] AC3: 关键指标正确计算（transportSendCalls, sceneDetected, etc.）
- [ ] AC4: 安全验证正确（allZero = transportCalls === 0 && platformApiCalls === 0 && messagesSent === 0）
- [ ] AC5: generateMarkdownReport() 生成格式化的 Markdown 报告
- [ ] AC6: Typecheck 通过

**工作量估算：** 1 天

---

### 子任务 6：集成连线（Integration Wiring）

**目标：** 将 ShadowPipelineOrchestrator 集成到现有的 inbound 流程

**文件：**
- 修改：`apps/desktop/src/main/worker-runtime.ts`（添加 SHADOW 模式初始化）
- 新建：`apps/desktop/src/main/services/shadow-mode-bootstrap.ts`（SHADOW 模式引导）

**集成点：**

```typescript
// worker-runtime.ts 中添加
function initializeShadowMode(deps: WorkerBackedMainDeps): ShadowPipelineOrchestrator {
  const auditLogger = new AuditLogger(deps.dataRoot);
  const transportBlocker = new TransportBlocker();
  const reportGenerator = new AuditReportGenerator(auditLogger);
  
  const orchestrator = new ShadowPipelineOrchestrator({
    persistence: deps.persistence,
    turnBuilder: deps.turnBuilder,
    sceneClassifier: deps.sceneClassifier,
    knowledgePort: deps.knowledgePort,
    factsPort: deps.factsPort,
    envelopeBuilder: deps.envelopeBuilder,
    workerClient: deps.workerClient,
    policyEngine: new PolicyEngine(),
    policyConfig: createSimplePolicyConfig("SHADOW"),
    auditLogger,
    transportBlocker,
  });
  
  return orchestrator;
}
```

**验收标准（AC）：**
- [ ] AC1: ShadowPipelineOrchestrator 在 worker-runtime 中正确初始化
- [ ] AC2: 所有依赖正确注入
- [ ] AC3: SHADOW 模式可以通过配置启用/禁用
- [ ] AC4: 现有 inbound 流程不受影响（SHADOW 模式是附加的）
- [ ] AC5: Typecheck 通过

**工作量估算：** 1 天

---

### 子任务 7：端到端验证和文档

**目标：** 验证完整流水线并生成文档

**文件：**
- 新建：`project/SHEEP_309_VALIDATION_REPORT.md`（验证报告）
- 新建：`project/SHEEP_309_TASK_REPORT.md`（任务报告）

**验证清单：**
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

**验收标准（AC）：**
- [ ] AC1: 验证报告包含所有退出标准的检查结果
- [ ] AC2: 任务报告包含完整的实现摘要
- [ ] AC3: 所有代码通过 typecheck
- [ ] AC4: 所有测试文件已创建（DEFERRED: 个人电脑运行）

**工作量估算：** 0.5 天

---

## 四、执行顺序和依赖

```
子任务 1 (DB Migration) ──→ 子任务 2 (AuditLogger) ──→ 子任务 4 (Orchestrator)
                                                              ↓
子任务 3 (TransportBlocker) ─────────────────────────→ 子任务 4 (Orchestrator)
                                                              ↓
子任务 5 (ReportGenerator) ←───────────────────────── 子任务 4 (Orchestrator)
                                                              ↓
子任务 6 (Integration) ←───────────────────────────── 子任务 4 (Orchestrator)
                                                              ↓
子任务 7 (Validation) ←────────────────────────────── 子任务 6 (Integration)
```

**关键路径：** 1 → 2 → 4 → 6 → 7

**并行机会：**
- 子任务 3 (TransportBlocker) 可以与子任务 1-2 并行
- 子任务 5 (ReportGenerator) 可以在子任务 4 完成后立即开始

---

## 五、风险缓解

### 风险 1：RPC 调用失败
- **缓解：** Orchestrator 捕获 RPC 异常，记录为步骤失败，但不中断流水线
- **状态：** CONFIRMED

### 风险 2：审计数据量过大
- **缓解：** 仅记录关键字段摘要，不记录完整对象
- **状态：** CONFIRMED

### 风险 3：Transport 泄漏
- **缓解：** TransportBlocker 在多个层级拦截，Orchestrator 不直接调用 transport
- **状态：** CONFIRMED

### 风险 4：真实 PDD inbound 不可用
- **缓解：** 使用测试账号发送测试消息
- **状态：** CONFIRMED

---

## 六、工作量估算

| 子任务 | 工作量 | 累计 |
|--------|--------|------|
| 子任务 1: DB Migration | 0.5 天 | 0.5 天 |
| 子任务 2: AuditLogger | 1 天 | 1.5 天 |
| 子任务 3: TransportBlocker | 0.5 天 | 2 天 |
| 子任务 4: Orchestrator | 2 天 | 4 天 |
| 子任务 5: ReportGenerator | 1 天 | 5 天 |
| 子任务 6: Integration | 1 天 | 6 天 |
| 子任务 7: Validation | 0.5 天 | 6.5 天 |
| **总计** | **6.5 天** | |

**缓冲：** +0.5 天（意外问题）  
**总计：** 7 天

---

## 七、治理约束

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

## 八、环境约束

### 开发环境（macOS，公司电脑）
- ✅ TypeScript 编译（`pnpm run typecheck`）
- ✅ 代码编辑和重构
- ✅ Git 操作
- ❌ 单元测试（需要 Node.js v22+）

### 测试环境（Windows，个人电脑）
- ✅ 单元测试（`pnpm run test`）
- ✅ 集成测试
- ✅ 完整验证流程

### 规则
- macOS 上不要声称测试已运行
- 测试标记为 `DEFERRED: 需要在个人电脑上运行`
- typecheck 是开发环境最高验证标准

---

**文档版本:** v1.0  
**创建日期:** 2026-09-30  
**创建人:** Codex  
**审核状态:** 待 Controller 审核
