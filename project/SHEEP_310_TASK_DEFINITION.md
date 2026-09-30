# SHEEP-310 任务定义：Retry Conflict and Wrong-Target Gate

**任务 ID:** SHEEP-310  
**状态:** NOT_STARTED  
**优先级:** P0  
**依赖:** SHEEP-309 ✅  
**工作量估算:** 3-5 天  
**日期:** 2026-09-30

---

## 一、任务目标

解决 `ConversationOrchestrator.performSend()` 的自动重试冲突，并实现确定性的预发送错误目标验证。

**核心问题：**
1. **重试冲突**：当前 `performSend()` 在失败后自动重试一次，但不区分失败类型
   - attempted/UNKNOWN/side-effect-possible 失败（消息可能已发送但状态未知）→ 重试会导致重复发送
   - safe pre-attempt 失败（如网络错误，消息未发送）→ 重试是安全的

2. **缺少错误目标验证**：没有验证 customerUid、shop、platform account、conversation、trigger、session、document bindings

---

## 二、治理依据

- **Roadmap V1.1 §MVP-C:** HUMAN_CONFIRM — Safe human-confirmed PDD send and verification
- **Master §5:** AI output must be structured and governed
- **REPLY_AND_ACTION_SAFETY:** Deterministic pre-send validation before execution
- **PDD_MVP_V1.md §3:** RolloutMode definitions (HUMAN_CONFIRM = requires human confirmation)

---

## 三、核心要求

### 3.1 重试冲突解决

必须区分以下失败类型：

| 失败类型 | 描述 | 重试行为 |
|---------|------|---------|
| **SAFE_PRE_ATTEMPT** | 消息未发送（网络错误、超时等） | ✅ 允许重试一次 |
| **ATTEMPTED_UNKNOWN** | 消息可能已发送但状态未知 | ❌ 禁止重试 |
| **SIDE_EFFECT_POSSIBLE** | 可能有副作用（部分发送、平台已接收等） | ❌ 禁止重试 |
| **EXPLICIT_REJECTED** | 平台明确拒绝 | ❌ 禁止重试 |

### 3.2 错误目标验证

必须在发送前验证以下绑定：

| 验证项 | 描述 | 验证方式 |
|--------|------|---------|
| **customerUid** | 客户身份 | 独立于 conversationId 检查 |
| **shop** | 店铺 | 验证 shopId 与当前受控店铺匹配 |
| **platform account** | 平台账号 | 验证 platformAccountId 有效 |
| **conversation** | 会话 | 验证 conversationId 存在且属于该 shop |
| **trigger** | 触发消息 | 验证 triggerMessageId 存在且未过期 |
| **session** | 会话上下文 | 验证 session 有效且未过期 |
| **document** | 文档版本 | 验证 ReplyPlan 版本与当前版本匹配 |

### 3.3 跨店铺执行拒绝

必须拒绝以下情况：
- 跨店铺执行（shopId 不匹配）
- 过期选择（stale selection）
- 无效绑定（binding 不完整）

---

## 四、当前状态（AS-IS）

### 已有基础

1. **ConversationOrchestrator** (packages/orchestrator/src/core/conversation-orchestrator.ts)
   - `performSend()` 方法实现发送逻辑
   - 失败后自动重试一次（不区分失败类型）

2. **SegmentedSender** (packages/orchestrator/src/core/segmented-sender.ts)
   - 分段发送实现
   - 返回 `SendAttempt` 结果

3. **PreSendController** (packages/orchestrator/src/core/pre-send-controller.ts)
   - 预发送控制器（但未实现完整的错误目标验证）

### 缺失组件

1. ❌ **SendFailureClassifier** — 分类发送失败类型
2. ❌ **WrongTargetValidator** — 预发送错误目标验证
3. ❌ **RetryPolicy** — 基于失败类型的重试策略
4. ❌ **BindingValidator** — 验证所有绑定（shop, platform, conversation, trigger, session, document）

---

## 五、目标状态（TO-BE）

### 架构流程

```
SendRequest
  ↓
[1] WrongTargetValidator → 验证所有绑定
  ↓
[2] BindingValidator → 验证 shop/platform/conversation/trigger/session/document
  ↓
[3] SegmentedSender.send() → 执行发送
  ↓
[4] SendFailureClassifier → 分类失败类型
  ↓
[5] RetryPolicy → 决定是否重试
  ↓
[6] 发送结果（ACKNOWLEDGED / REJECTED / UNKNOWN）
```

### 核心组件

1. **SendFailureClassifier** (TypeScript)
   - 位置：`packages/orchestrator/src/core/send-failure-classifier.ts`
   - 职责：分类发送失败类型（SAFE_PRE_ATTEMPT / ATTEMPTED_UNKNOWN / SIDE_EFFECT_POSSIBLE / EXPLICIT_REJECTED）

2. **WrongTargetValidator** (TypeScript)
   - 位置：`packages/orchestrator/src/core/wrong-target-validator.ts`
   - 职责：预发送错误目标验证

3. **BindingValidator** (TypeScript)
   - 位置：`packages/orchestrator/src/core/binding-validator.ts`
   - 职责：验证所有绑定

4. **RetryPolicy** (TypeScript)
   - 位置：`packages/orchestrator/src/policies/retry-policy.ts`
   - 职责：基于失败类型的重试策略

---

## 六、允许范围（Allowed Scope）

### ✅ 允许
- 发送失败分类
- 预发送错误目标验证
- 绑定验证
- 重试策略
- 对抗性错误目标测试

### ❌ 禁止
- 授权 AUTO 模式
- 扩大 transport 范围
- 实现业务 ActionPlan
- 多店铺扩展

---

## 七、退出标准（Exit Criteria）

- [ ] attempted/UNKNOWN/side-effect-possible 失败永不自动重试
- [ ] 安全的预尝试行为明确且受策略控制
- [ ] customerUid 独立于 conversationId 检查
- [ ] shop/platform account/conversation/trigger/session/document 绑定在发送前验证
- [ ] 过期选择和跨店铺执行被拒绝
- [ ] 对抗性错误目标测试通过
- [ ] Typecheck 通过
- [ ] 单元测试通过（DEFERRED: 需在个人电脑运行）

---

## 八、客户价值

**Customer value:** 防止重复或错误定向的消息  
**Safety value:** 移除已知的生产 AUTO 阻塞器

---

## 九、风险和缓解

### 风险 1：失败分类不准确
- **风险：** 某些失败类型难以区分
- **缓解：** 保守分类（宁可标记为 ATTEMPTED_UNKNOWN 也不重试）
- **状态:** CONFIRMED

### 风险 2：绑定验证过于严格
- **风险：** 可能阻止合法发送
- **缓解：** 提供明确的错误信息，支持调试
- **状态:** CONFIRMED

### 风险 3：对抗性测试覆盖不全
- **风险：** 可能遗漏某些错误目标场景
- **缓解：** 全面的测试用例设计
- **状态:** CONFIRMED

---

**文档版本:** v1.0  
**创建日期:** 2026-09-30  
**创建人:** Codex  
**审核状态:** 待 Controller 审核
