# SHEEP-312 UNKNOWN 语义和重试策略审计报告

**任务 ID:** SHEEP-312 子任务 3  
**日期:** 2026-09-30  
**审计范围:** RetryPolicy + SendFailureClassifier + ConversationOrchestrator 中的 UNKNOWN 处理  
**审计状态:** ✅ COMPLETE

---

## 一、审计目标

1. 验证 UNKNOWN 结果不会自动重试
2. 验证 attempted 状态不会自动重试
3. 验证 UNKNOWN 触发桌面通知（通过事件）
4. 验证 UNKNOWN 记录到审计日志

---

## 二、RetryPolicy 审计

### 2.1 核心安全不变量

**文件:** `packages/orchestrator/src/policies/retry-policy.ts`

```
唯一允许重试的条件：classification.failureType === "SAFE_PRE_ATTEMPT"
所有其他类型 → shouldRetry = false
```

| 失败类型 | 允许重试 | 理由 |
|---------|---------|------|
| SAFE_PRE_ATTEMPT | ✅ YES | 消息未发送，安全重试 |
| ATTEMPTED_UNKNOWN | ❌ NO | 消息可能已发送，重试可能导致重复 |
| SIDE_EFFECT_POSSIBLE | ❌ NO | 可能有副作用，重试风险高 |
| EXPLICIT_REJECTED | ❌ NO | 平台明确拒绝，重试无意义 |

### 2.2 确定性验证

- ✅ 纯条件判断，无随机性
- ✅ 无时间依赖
- ✅ 相同输入 → 相同输出

### 2.3 安全性验证

- ✅ 默认策略是拒绝重试（保守策略）
- ✅ 只有明确安全的场景才允许重试
- ✅ 不依赖 classification.retryAllowed 字段（自己判断 failureType）

---

## 三、SendFailureClassifier 审计

### 3.1 分类逻辑

**文件:** `packages/orchestrator/src/core/send-failure-classifier.ts`

分类优先级（从高到低）：
1. 有 messageId 但失败 → ATTEMPTED_UNKNOWN（最保守）
2. 明确拒绝关键词 → EXPLICIT_REJECTED
3. 副作用关键词 → SIDE_EFFECT_POSSIBLE
4. 安全关键词 → SAFE_PRE_ATTEMPT
5. 默认 → ATTEMPTED_UNKNOWN（保守兜底）

### 3.2 保守策略验证

- ✅ 未知错误默认分类为 ATTEMPTED_UNKNOWN（不重试）
- ✅ 有 messageId 的失败分类为 ATTEMPTED_UNKNOWN（不重试）
- ✅ 空错误消息分类为 ATTEMPTED_UNKNOWN（不重试）
- ✅ 没有 error 字段的失败分类为 ATTEMPTED_UNKNOWN（不重试）

### 3.3 确定性验证

- ✅ 基于关键词匹配的确定性分类
- ✅ 无随机性、无时间依赖
- ✅ 相同输入 → 相同输出

---

## 四、ConversationOrchestrator 中的 UNKNOWN 处理

### 4.1 发送失败处理流程

**文件:** `packages/orchestrator/src/core/conversation-orchestrator.ts` (lines 840-880)

```
发送失败 → SendFailureClassifier.classify() → RetryPolicy.decide()
  ↓
  emit("SendFailed") ← 桌面通知事件源
  ↓
  recordDecision({ failure_type, retry_allowed }) ← 审计日志
  ↓
  if (shouldRetry) → 重试一次
  else → 返回（不重试）
```

### 4.2 UNKNOWN 桌面通知

**状态:** ✅ 通过事件机制实现

- `SendFailed` 事件在发送失败时发出
- 事件包含 `conversation_id`、`shop_id`、`error`
- 桌面层监听 `SendFailed` 事件并显示通知
- 这是正确的职责分离：orchestrator 发出事件，desktop 处理 UI

### 4.3 UNKNOWN 审计日志

**状态:** ✅ 完整记录

- `recordDecision()` 记录以下字段：
  - `decision`: "send_failed_no_retry" 或 "refill_on_failure"
  - `conversation_id`: 会话标识
  - `shop_id`: 店铺标识
  - `failure_type`: 分类结果（包括 ATTEMPTED_UNKNOWN）
  - `retry_allowed`: 是否允许重试

---

## 五、测试覆盖审计

### 5.1 RetryPolicy 单元测试

**文件:** `packages/orchestrator/tests/retry-policy.test.ts`

| 测试场景 | 覆盖状态 |
|---------|---------|
| SAFE_PRE_ATTEMPT 允许重试 | ✅ |
| ATTEMPTED_UNKNOWN 禁止重试 | ✅ |
| SIDE_EFFECT_POSSIBLE 禁止重试 | ✅ |
| EXPLICIT_REJECTED 禁止重试 | ✅ |
| 核心不变量：只有 SAFE_PRE_ATTEMPT 允许重试 | ✅ |

**覆盖率:** 5/5 ✅

### 5.2 SendFailureClassifier 单元测试

**文件:** `packages/orchestrator/tests/send-failure-classifier.test.ts`

| 测试场景 | 覆盖状态 |
|---------|---------|
| 成功发送不分类 | ✅ |
| SAFE_PRE_ATTEMPT: 网络错误 | ✅ |
| SAFE_PRE_ATTEMPT: 连接拒绝 | ✅ |
| SAFE_PRE_ATTEMPT: DNS 错误 | ✅ |
| SAFE_PRE_ATTEMPT: 发送前超时 | ✅ |
| ATTEMPTED_UNKNOWN: 有 messageId 但失败 | ✅ |
| ATTEMPTED_UNKNOWN: 未知错误 | ✅ |
| SIDE_EFFECT_POSSIBLE: 部分发送 | ✅ |
| SIDE_EFFECT_POSSIBLE: 发送中断 | ✅ |
| EXPLICIT_REJECTED: 平台拒绝 | ✅ |
| EXPLICIT_REJECTED: 权限拒绝 | ✅ |
| EXPLICIT_REJECTED: 频率限制 | ✅ |
| 错误标准化: 字符串错误 | ✅ |
| 错误标准化: 对象错误 | ✅ |
| 错误标准化: 未知错误类型 | ✅ |
| 边界: 没有 error 字段 | ✅ |
| 边界: 空错误消息 | ✅ |

**覆盖率:** 17/17 ✅

### 5.3 对抗性测试

**文件:** `packages/orchestrator/tests/wrong-target-adversarial.test.ts`

| 对抗场景 | 覆盖状态 |
|---------|---------|
| 只有 SAFE_PRE_ATTEMPT 允许重试（安全不变量） | ✅ |
| 未知错误保守分类为不重试 | ✅ |

---

## 六、发现和建议

### 6.1 已确认的安全属性

1. ✅ UNKNOWN 结果不会自动重试
2. ✅ attempted 状态不会自动重试
3. ✅ UNKNOWN 通过 SendFailed 事件触发桌面通知
4. ✅ UNKNOWN 通过 recordDecision() 记录到审计日志
5. ✅ 默认分类为 ATTEMPTED_UNKNOWN（保守策略）
6. ✅ 所有分类和重试决策都是确定性的

### 6.2 设计观察

| 观察 | 评估 | 风险 |
|------|------|------|
| 重试只尝试一次 | ✅ 合理 — 避免无限重试循环 | NONE |
| UNKNOWN 不区分"有 messageId"和"完全未知" | ✅ 合理 — 都禁止重试 | NONE |
| 桌面通知通过事件机制 | ✅ 正确 — 职责分离 | NONE |
| 审计日志包含 failure_type | ✅ 完整 — 支持事后分析 | NONE |

### 6.3 无需要修复的问题

审计未发现需要修复的安全问题。现有实现完整、正确、确定性强。

---

## 七、结论

| 验收标准 | 状态 |
|---------|------|
| AC1: UNKNOWN 结果不会触发重试 | ✅ PASS |
| AC2: attempted 状态不会自动重试 | ✅ PASS |
| AC3: UNKNOWN 触发桌面通知 | ✅ PASS（通过 SendFailed 事件） |
| AC4: UNKNOWN 记录到审计日志 | ✅ PASS（通过 recordDecision） |

**总体评估:** ✅ UNKNOWN 语义和重试策略验证通过

所有安全属性都得到保证。测试覆盖完整。实现是确定性的、可审计的。
