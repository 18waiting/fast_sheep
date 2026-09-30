# SHEEP-310 执行计划：Retry Conflict and Wrong-Target Gate

**任务 ID:** SHEEP-310  
**日期:** 2026-09-30  
**预计工作量:** 3-5 天

---

## 一、子任务分解

### 子任务 1：SendFailureClassifier 实现

**目标：** 分类发送失败类型

**文件：**
- 新建：`packages/orchestrator/src/core/send-failure-classifier.ts`
- 新建：`packages/orchestrator/src/core/send-failure-classifier.test.ts`

**接口设计：**

```typescript
export type SendFailureType = 
  | "SAFE_PRE_ATTEMPT"        // 消息未发送（网络错误、超时等）
  | "ATTEMPTED_UNKNOWN"       // 消息可能已发送但状态未知
  | "SIDE_EFFECT_POSSIBLE"    // 可能有副作用（部分发送、平台已接收等）
  | "EXPLICIT_REJECTED";      // 平台明确拒绝

export interface SendFailureClassification {
  readonly failureType: SendFailureType;
  readonly retryAllowed: boolean;
  readonly reason: string;
  readonly error?: Error;
}

export class SendFailureClassifier {
  classify(attempt: SendAttempt): SendFailureClassification;
}
```

**分类逻辑：**

| 错误类型 | 分类 | 重试 |
|---------|------|------|
| 网络连接失败（发送前） | SAFE_PRE_ATTEMPT | ✅ |
| 超时（发送前） | SAFE_PRE_ATTEMPT | ✅ |
| 超时（发送中） | ATTEMPTED_UNKNOWN | ❌ |
| 部分发送成功 | SIDE_EFFECT_POSSIBLE | ❌ |
| 平台明确拒绝 | EXPLICIT_REJECTED | ❌ |
| 未知错误 | ATTEMPTED_UNKNOWN | ❌ |

**验收标准：**
- [ ] AC1: 正确分类所有失败类型
- [ ] AC2: SAFE_PRE_ATTEMPT 允许重试
- [ ] AC3: 其他类型禁止重试
- [ ] AC4: Typecheck 通过

**工作量：** 0.5 天

---

### 子任务 2：WrongTargetValidator 实现

**目标：** 预发送错误目标验证

**文件：**
- 新建：`packages/orchestrator/src/core/wrong-target-validator.ts`
- 新建：`packages/orchestrator/src/core/wrong-target-validator.test.ts`

**接口设计：**

```typescript
export interface WrongTargetValidation {
  readonly valid: boolean;
  readonly failures: readonly WrongTargetFailure[];
}

export interface WrongTargetFailure {
  readonly field: string;
  readonly reason: string;
  readonly expected?: string;
  readonly actual?: string;
}

export interface ValidationContext {
  readonly shopId: string;
  readonly conversationId: string;
  readonly customerUid?: string;
  readonly platformAccountId?: string;
  readonly triggerMessageId?: string;
  readonly sessionId?: string;
  readonly documentVersion?: string;
}

export class WrongTargetValidator {
  validate(context: ValidationContext): WrongTargetValidation;
}
```

**验证逻辑：**

| 验证项 | 验证方式 |
|--------|---------|
| shopId | 验证与当前受控店铺匹配 |
| conversationId | 验证存在且属于该 shop |
| customerUid | 独立于 conversationId 检查 |
| platformAccountId | 验证有效 |
| triggerMessageId | 验证存在且未过期 |
| sessionId | 验证有效且未过期 |
| documentVersion | 验证与当前版本匹配 |

**验收标准：**
- [ ] AC1: 验证所有绑定字段
- [ ] AC2: customerUid 独立于 conversationId 检查
- [ ] AC3: 跨店铺执行被拒绝
- [ ] AC4: 过期选择被拒绝
- [ ] AC5: Typecheck 通过

**工作量：** 1 天

---

### 子任务 3：BindingValidator 实现

**目标：** 验证所有绑定（shop, platform, conversation, trigger, session, document）

**文件：**
- 新建：`packages/orchestrator/src/core/binding-validator.ts`
- 新建：`packages/orchestrator/src/core/binding-validator.test.ts`

**接口设计：**

```typescript
export interface BindingValidation {
  readonly valid: boolean;
  readonly failures: readonly BindingFailure[];
}

export interface BindingFailure {
  readonly binding: string;
  readonly reason: string;
}

export interface BindingContext {
  readonly shopId: string;
  readonly platformAccountId: string;
  readonly conversationId: string;
  readonly triggerMessageId: string;
  readonly sessionId: string;
  readonly documentVersion: string;
}

export class BindingValidator {
  validate(context: BindingContext): BindingValidation;
}
```

**验收标准：**
- [ ] AC1: 验证所有 6 种绑定
- [ ] AC2: 提供明确的错误信息
- [ ] AC3: Typecheck 通过

**工作量：** 0.5 天

---

### 子任务 4：RetryPolicy 实现

**目标：** 基于失败类型的重试策略

**文件：**
- 新建：`packages/orchestrator/src/policies/retry-policy.ts`
- 新建：`packages/orchestrator/src/policies/retry-policy.test.ts`

**接口设计：**

```typescript
export interface RetryDecision {
  readonly shouldRetry: boolean;
  readonly reason: string;
}

export class RetryPolicy {
  decide(classification: SendFailureClassification): RetryDecision;
}
```

**验收标准：**
- [ ] AC1: SAFE_PRE_ATTEMPT 允许重试
- [ ] AC2: 其他类型禁止重试
- [ ] AC3: Typecheck 通过

**工作量：** 0.5 天

---

### 子任务 5：ConversationOrchestrator 集成

**目标：** 将新组件集成到 ConversationOrchestrator

**文件：**
- 修改：`packages/orchestrator/src/core/conversation-orchestrator.ts`

**修改内容：**

1. 在 `performSend()` 前调用 `WrongTargetValidator.validate()`
2. 在 `performSend()` 后调用 `SendFailureClassifier.classify()`
3. 根据 `RetryPolicy.decide()` 决定是否重试

**验收标准：**
- [ ] AC1: 发送前验证错误目标
- [ ] AC2: 发送后分类失败类型
- [ ] AC3: 根据策略决定是否重试
- [ ] AC4: Typecheck 通过

**工作量：** 1 天

---

### 子任务 6：对抗性测试

**目标：** 全面的对抗性错误目标测试

**文件：**
- 新建：`packages/orchestrator/src/core/wrong-target-adversarial.test.ts`

**测试场景：**

| 场景 | 描述 | 预期结果 |
|------|------|---------|
| 跨店铺执行 | shopId 不匹配 | 拒绝 |
| 过期选择 | triggerMessageId 过期 | 拒绝 |
| 无效绑定 | 绑定不完整 | 拒绝 |
| customerUid 不匹配 | customerUid 与 conversationId 不一致 | 拒绝 |
| 文档版本不匹配 | documentVersion 过期 | 拒绝 |

**验收标准：**
- [ ] AC1: 所有对抗性场景被正确拒绝
- [ ] AC2: 提供明确的错误信息
- [ ] AC3: Typecheck 通过

**工作量：** 0.5 天

---

### 子任务 7：文档和验证

**目标：** 完成任务报告和验证文档

**文件：**
- 新建：`project/SHEEP_310_TASK_REPORT.md`
- 新建：`project/SHEEP_310_VALIDATION_REPORT.md`

**验收标准：**
- [ ] AC1: 任务报告完整
- [ ] AC2: 验证报告包含所有退出标准
- [ ] AC3: Typecheck 通过

**工作量：** 0.5 天

---

## 二、执行顺序和依赖

```
子任务 1 (SendFailureClassifier) ──→ 子任务 4 (RetryPolicy) ──→ 子任务 5 (集成)
                                                                    ↓
子任务 2 (WrongTargetValidator) ────────────────────────────────→ 子任务 5 (集成)
                                                                    ↓
子任务 3 (BindingValidator) ───────────────────────────────────→ 子任务 5 (集成)
                                                                    ↓
                                                              子任务 6 (对抗性测试)
                                                                    ↓
                                                              子任务 7 (文档)
```

**关键路径：** 1 → 4 → 5 → 6 → 7

**并行机会：**
- 子任务 2 和 3 可以与子任务 1 并行
- 子任务 6 可以在子任务 5 完成后立即开始

---

## 三、工作量估算

| 子任务 | 工作量 | 累计 |
|--------|--------|------|
| 子任务 1: SendFailureClassifier | 0.5 天 | 0.5 天 |
| 子任务 2: WrongTargetValidator | 1 天 | 1.5 天 |
| 子任务 3: BindingValidator | 0.5 天 | 2 天 |
| 子任务 4: RetryPolicy | 0.5 天 | 2.5 天 |
| 子任务 5: 集成 | 1 天 | 3.5 天 |
| 子任务 6: 对抗性测试 | 0.5 天 | 4 天 |
| 子任务 7: 文档 | 0.5 天 | 4.5 天 |
| **总计** | **4.5 天** | |

**缓冲：** +0.5 天（意外问题）  
**总计：** 5 天

---

## 四、风险缓解

### 风险 1：失败分类不准确
- **缓解：** 保守分类（宁可标记为 ATTEMPTED_UNKNOWN 也不重试）
- **状态：** CONFIRMED

### 风险 2：绑定验证过于严格
- **缓解：** 提供明确的错误信息，支持调试
- **状态：** CONFIRMED

### 风险 3：对抗性测试覆盖不全
- **缓解：** 全面的测试用例设计
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
