# SHEEP-311 执行计划：HUMAN_CONFIRM PDD Transport and Verification

**任务 ID:** SHEEP-311  
**日期:** 2026-09-30  
**预计工作量:** 5-7 天

---

## 一、子任务分解

### 子任务 1：TransportOutcome 类型定义（0.5 天）

**目标：** 定义类型化的发送结果

**文件：**
- 新建：`packages/domain/src/transport-outcome.ts`
- 新建：`packages/domain/tests/transport-outcome.test.ts`

**接口设计：**

```typescript
export type TransportOutcomeType = "ACKNOWLEDGED" | "REJECTED" | "UNKNOWN";

export interface TransportOutcome {
  readonly outcome_type: TransportOutcomeType;
  readonly attempt_id: string;
  readonly platform_message_id?: string;
  readonly acknowledged_at?: string; // ISO 8601
  readonly rejected_at?: string; // ISO 8601
  readonly unknown_reason?: string;
  readonly unknown_context?: unknown;
  readonly raw_response?: unknown;
}

export interface UnknownOutcome extends TransportOutcome {
  readonly outcome_type: "UNKNOWN";
  readonly unknown_reason: string; // 必填
  readonly unknown_context: unknown; // 必填
}
```

**验收标准：**
- [ ] AC1: 定义三种结果类型
- [ ] AC2: UNKNOWN 必须包含原因和上下文
- [ ] AC3: 提供辅助函数创建各种结果
- [ ] AC4: Typecheck 通过
- [ ] AC5: 单元测试通过

**测试要求：**
- 创建 ACKNOWLEDGED 结果
- 创建 REJECTED 结果
- 创建 UNKNOWN 结果（必须提供原因）
- UNKNOWN 缺少原因时编译错误（类型安全）

---

### 子任务 2：ConfirmationBinding 定义（0.5 天）

**目标：** 定义人工确认绑定

**文件：**
- 新建：`packages/domain/src/confirmation-binding.ts`
- 新建：`packages/domain/tests/confirmation-binding.test.ts`

**接口设计：**

```typescript
export interface ConfirmationBinding {
  readonly confirmation_id: string;
  readonly plan_id: string;
  readonly identity_lock: ContractIdentityLock;
  readonly policy_version: string;
  readonly confirmed_at: string; // ISO 8601
  readonly confirmed_by: string; // user ID
  readonly confirmation_hash: string; // 用于验证绑定完整性
}

export interface ConfirmationValidator {
  validate(binding: ConfirmationBinding, context: ValidationContext): ConfirmationValidation;
}

export interface ConfirmationValidation {
  readonly valid: boolean;
  readonly failures: readonly ConfirmationFailure[];
}
```

**验收标准：**
- [ ] AC1: 确认绑定包含所有必要字段
- [ ] AC2: 提供验证器验证绑定完整性
- [ ] AC3: 验证器检测跨目标确认
- [ ] AC4: Typecheck 通过
- [ ] AC5: 单元测试通过

**测试要求：**
- 创建有效的确认绑定
- 验证绑定完整性
- 检测跨目标确认（plan_id 不匹配）
- 检测跨 IdentityLock 确认
- 检测过期确认

---

### 子任务 3：VerificationRecord 定义（0.5 天）

**目标：** 定义验证记录

**文件：**
- 新建：`packages/domain/src/verification-record.ts`
- 新建：`packages/domain/tests/verification-record.test.ts`

**接口设计：**

```typescript
export interface VerificationRecord {
  readonly verification_id: string;
  readonly audit_id: string;
  readonly verification_type: "identity_lock" | "wrong_target" | "binding" | "reply_plan";
  readonly verified_at: string; // ISO 8601
  readonly passed: boolean;
  readonly failures?: readonly VerificationFailure[];
}

export interface VerificationFailure {
  readonly field: string;
  readonly reason: string;
  readonly expected?: string;
  readonly actual?: string;
}
```

**验收标准：**
- [ ] AC1: 验证记录包含所有必要字段
- [ ] AC2: 支持多种验证类型
- [ ] AC3: 失败时包含详细原因
- [ ] AC4: Typecheck 通过
- [ ] AC5: 单元测试通过

**测试要求：**
- 创建通过的验证记录
- 创建失败的验证记录
- 验证记录与审计关联

---

### 子任务 4：DesktopNotification 定义（0.5 天）

**目标：** 定义桌面通知

**文件：**
- 新建：`packages/domain/src/desktop-notification.ts`
- 新建：`packages/domain/tests/desktop-notification.test.ts`

**接口设计：**

```typescript
export type NotificationType = "send_acknowledged" | "send_rejected" | "send_unknown" | "confirmation_required";

export interface DesktopNotification {
  readonly notification_id: string;
  readonly audit_id: string;
  readonly notification_type: NotificationType;
  readonly title: string;
  readonly message: string;
  readonly created_at: string; // ISO 8601
  readonly metadata?: Record<string, unknown>;
}

export interface NotificationBuilder {
  buildForAcknowledged(auditId: string, planId: string): DesktopNotification;
  buildForRejected(auditId: string, planId: string, reason: string): DesktopNotification;
  buildForUnknown(auditId: string, planId: string, reason: string): DesktopNotification;
  buildForConfirmationRequired(auditId: string, planId: string): DesktopNotification;
}
```

**验收标准：**
- [ ] AC1: 支持四种通知类型
- [ ] AC2: 通知包含审计关联
- [ ] AC3: UNKNOWN 通知包含原因
- [ ] AC4: Typecheck 通过
- [ ] AC5: 单元测试通过

**测试要求：**
- 构建 ACKNOWLEDGED 通知
- 构建 REJECTED 通知
- 构建 UNKNOWN 通知（包含原因）
- 构建确认请求通知

---

### 子任务 5：AuditCorrelation 定义（0.5 天）

**目标：** 定义审计关联

**文件：**
- 新建：`packages/domain/src/audit-correlation.ts`
- 新建：`packages/domain/tests/audit-correlation.test.ts`

**接口设计：**

```typescript
export interface AuditCorrelation {
  readonly audit_id: string;
  readonly shop_id: string;
  readonly conversation_id: string;
  readonly plan_id: string;
  readonly confirmation_id?: string;
  readonly transport_outcome?: TransportOutcome;
  readonly verification_records: readonly VerificationRecord[];
  readonly notification_id?: string;
  readonly created_at: string; // ISO 8601
  readonly completed_at?: string; // ISO 8601
}

export interface AuditLogger {
  startAudit(context: AuditContext): AuditCorrelation;
  recordConfirmation(auditId: string, confirmation: ConfirmationBinding): void;
  recordVerification(auditId: string, verification: VerificationRecord): void;
  recordOutcome(auditId: string, outcome: TransportOutcome): void;
  recordNotification(auditId: string, notificationId: string): void;
  completeAudit(auditId: string): AuditCorrelation;
}
```

**验收标准：**
- [ ] AC1: 审计关联包含所有事件
- [ ] AC2: 提供审计日志记录器
- [ ] AC3: 审计日志可追溯
- [ ] AC4: Typecheck 通过
- [ ] AC5: 单元测试通过

**测试要求：**
- 启动审计
- 记录确认、验证、结果、通知
- 完成审计
- 验证审计链完整性

---

### 子任务 6：HumanConfirmController 实现（1.5 天）

**目标：** 实现人工确认控制器

**文件：**
- 新建：`packages/orchestrator/src/core/human-confirm-controller.ts`
- 新建：`packages/orchestrator/tests/human-confirm-controller.test.ts`

**接口设计：**

```typescript
export interface HumanConfirmController {
  requestConfirmation(plan: ReplyPlan, decision: PolicyDecision): ConfirmationRequest;
  confirm(confirmationId: string, userId: string): ConfirmationResult;
  reject(confirmationId: string, userId: string, reason: string): ConfirmationResult;
  getConfirmationStatus(confirmationId: string): ConfirmationStatus;
}

export interface ConfirmationRequest {
  readonly confirmation_id: string;
  readonly plan_id: string;
  readonly identity_lock: ContractIdentityLock;
  readonly policy_version: string;
  readonly requested_at: string;
  readonly status: "pending" | "confirmed" | "rejected" | "expired";
}

export interface ConfirmationResult {
  readonly success: boolean;
  readonly confirmation?: ConfirmationBinding;
  readonly reason?: string;
}
```

**验收标准：**
- [ ] AC1: 请求确认创建绑定
- [ ] AC2: 确认返回有效的 ConfirmationBinding
- [ ] AC3: 拒绝记录原因
- [ ] AC4: 确认状态可查询
- [ ] AC5: Typecheck 通过
- [ ] AC6: 单元测试通过

**测试要求：**
- 请求确认
- 确认成功
- 确认失败（plan_id 不匹配）
- 拒绝确认
- 查询确认状态
- 确认过期

---

### 子任务 7：ConversationOrchestrator 集成（1.5 天）

**目标：** 将 HUMAN_CONFIRM 流程集成到 ConversationOrchestrator

**文件：**
- 修改：`packages/orchestrator/src/core/conversation-orchestrator.ts`

**修改内容：**

1. 添加 HumanConfirmController 依赖
2. 在发送前请求确认（如果 rollout_mode 是 HUMAN_CONFIRM）
3. 等待人工确认
4. 确认后执行发送
5. 记录 TransportOutcome
6. 记录 VerificationRecord
7. 发送 DesktopNotification
8. 完成 AuditCorrelation

**验收标准：**
- [ ] AC1: HUMAN_CONFIRM 模式请求确认
- [ ] AC2: 确认后执行发送
- [ ] AC3: 记录类型化结果
- [ ] AC4: 发送桌面通知
- [ ] AC5: 审计关联完整
- [ ] AC6: Typecheck 通过

**测试要求：**
- HUMAN_CONFIRM 模式请求确认
- 确认后发送成功
- 确认后发送失败
- UNKNOWN 结果处理
- 审计日志完整

---

### 子任务 8：对抗性测试（0.5 天）

**目标：** 全面的对抗性测试

**文件：**
- 新建：`packages/orchestrator/tests/human-confirm-adversarial.test.ts`

**测试场景：**

| 场景 | 描述 | 预期结果 |
|------|------|---------|
| 跨目标确认 | 确认一个 plan，执行另一个 | 拒绝 |
| 过期确认 | 使用过期的确认 | 拒绝 |
| AUTO 模式尝试 | 尝试启用 AUTO | 拒绝 |
| 缺少确认发送 | 未确认直接发送 | 拒绝 |
| UNKNOWN 结果 | 发送结果未知 | 停止执行，通知人工 |
| 审计链断裂 | 审计关联不完整 | 检测并报告 |

**验收标准：**
- [ ] AC1: 所有对抗性场景被正确拒绝
- [ ] AC2: 提供明确的错误信息
- [ ] AC3: Typecheck 通过

---

### 子任务 9：文档和验证（0.5 天）

**目标：** 完成任务报告和验证文档

**文件：**
- 新建：`project/SHEEP_311_TASK_REPORT.md`
- 新建：`project/SHEEP_311_VALIDATION_REPORT.md`
- 更新：`project/PROJECT_STATE.json`

**验收标准：**
- [ ] AC1: 任务报告完整
- [ ] AC2: 验证报告包含所有退出标准
- [ ] AC3: Typecheck 通过

---

## 二、执行顺序和依赖

```
子任务 1 (TransportOutcome) ──→ 子任务 7 (Orchestrator 集成)
                                    ↓
子任务 2 (ConfirmationBinding) ──→ 子任务 6 (HumanConfirmController) ──→ 子任务 7
                                    ↓
子任务 3 (VerificationRecord) ────→ 子任务 7
                                    ↓
子任务 4 (DesktopNotification) ──→ 子任务 7
                                    ↓
子任务 5 (AuditCorrelation) ─────→ 子任务 7
                                    ↓
                              子任务 8 (对抗性测试)
                                    ↓
                              子任务 9 (文档)
```

**关键路径：** 1 → 6 → 7 → 8 → 9

**并行机会：**
- 子任务 1-5 可以并行
- 子任务 6 依赖子任务 2
- 子任务 7 依赖所有子任务 1-6

---

## 三、工作量估算

| 子任务 | 工作量 | 累计 |
|--------|--------|------|
| 子任务 1: TransportOutcome | 0.5 天 | 0.5 天 |
| 子任务 2: ConfirmationBinding | 0.5 天 | 1 天 |
| 子任务 3: VerificationRecord | 0.5 天 | 1.5 天 |
| 子任务 4: DesktopNotification | 0.5 天 | 2 天 |
| 子任务 5: AuditCorrelation | 0.5 天 | 2.5 天 |
| 子任务 6: HumanConfirmController | 1.5 天 | 4 天 |
| 子任务 7: Orchestrator 集成 | 1.5 天 | 5.5 天 |
| 子任务 8: 对抗性测试 | 0.5 天 | 6 天 |
| 子任务 9: 文档 | 0.5 天 | 6.5 天 |
| **总计** | **6.5 天** | |

**缓冲：** +0.5 天（意外问题）  
**总计：** 7 天

---

## 四、风险缓解

### 风险 1：人工确认流程复杂
- **缓解：** 分阶段实现，先定义接口，再实现控制器
- **状态：** CONFIRMED

### 风险 2：审计关联不完整
- **缓解：** 使用 AuditLogger 统一管理审计
- **状态：** CONFIRMED

### 风险 3：桌面通知集成困难
- **缓解：** 先定义接口，桌面通知实现可以后续补充
- **状态：** CONFIRMED

---

## 五、治理约束

- **不得授权 AUTO 模式**
- **不得扩大 transport 范围**
- **不得实现业务 ActionPlan**
- **不得多店铺扩展**

---

**文档版本:** v1.0  
**创建日期:** 2026-09-30  
**创建人:** Codex  
**审核状态:** 待 Controller 审核
