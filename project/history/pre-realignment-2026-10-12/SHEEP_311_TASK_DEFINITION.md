# SHEEP-311 任务定义：HUMAN_CONFIRM PDD Transport and Verification

**任务 ID:** SHEEP-311  
**日期:** 2026-09-30  
**状态:** NOT_STARTED / NOT_AUTHORIZED  
**依赖:** SHEEP-310 ✅ (Retry Conflict and Wrong-Target Gate)

---

## 一、任务目标

**Goal:** Enable controlled human-confirmed PDD sending for one shop.

为单个受控店铺启用人工确认的 PDD 发送流程。

**Customer value:** safe assisted reply automation — 安全的人工辅助回复自动化  
**Safety value:** human remains the execution gate — 人工保持执行门控

---

## 二、允许范围（Allowed scope）

- ✅ 单店铺 PDD 发送（single controlled-shop PDD send）
- ✅ 确认绑定（confirmation binding）
- ✅ 类型化结果（typed outcome: ACKNOWLEDGED / REJECTED / UNKNOWN）
- ✅ 验证记录（verification is recorded）
- ✅ 审计关联（audit correlation is complete）
- ✅ 桌面通知（desktop notification is delivered）

---

## 三、禁止范围（Must not）

- ❌ 启用 AUTO 模式
- ❌ 实现业务 ActionPlan
- ❌ 多店铺扩展
- ❌ 绕过人工确认

---

## 四、退出标准（Exit criteria）

### EC1: 人工确认绑定到精确的 ReplyPlan/version/IdentityLock

**要求：**
- 人工确认必须绑定到特定的 ReplyPlan
- 确认必须包含 IdentityLock（shopId, conversationId, customerUid, triggerMessageId）
- 确认必须包含策略版本（policy_version）
- 确认必须包含 ReplyPlan 版本（plan_id）
- 一个确认不能授权不同的目标或后续的 ReplyPlan

**验证方式：**
- ConfirmationBinding 接口定义
- 单元测试验证绑定完整性
- 对抗性测试验证跨目标拒绝

---

### EC2: transport 产生类型化的 ACKNOWLEDGED / REJECTED / UNKNOWN

**要求：**
- Transport 层必须返回类型化的执行结果
- `ACKNOWLEDGED`: 平台确认消息已接收
- `REJECTED`: 平台明确拒绝消息
- `UNKNOWN`: 无法确定消息状态（必须停止自动执行，保留原因，呈现给人工）

**验证方式：**
- TransportOutcome 接口定义
- 单元测试验证三种结果类型
- 集成测试验证结果传递

---

### EC3: 验证被记录（verification is recorded）

**要求：**
- 发送前的验证结果必须被记录
- 包括 IdentityLock 验证、WrongTarget 验证、Binding 验证
- 验证结果必须与审计日志关联

**验证方式：**
- VerificationRecord 接口定义
- 单元测试验证记录完整性
- 审计日志验证

---

### EC4: UNKNOWN 原因被记录和呈现（UNKNOWN reason is recorded and surfaced）

**要求：**
- UNKNOWN 结果必须包含原因
- 原因必须被持久化到审计日志
- 原因必须通过桌面通知呈现给用户

**验证方式：**
- UnknownOutcome 接口定义
- 单元测试验证原因记录
- 集成测试验证通知呈现

---

### EC5: 桌面通知被送达（desktop notification is delivered）

**要求：**
- 发送结果必须通过桌面通知呈现
- 通知必须包含结果类型（ACKNOWLEDGED/REJECTED/UNKNOWN）
- UNKNOWN 通知必须包含原因
- 通知必须包含审计关联 ID

**验证方式：**
- DesktopNotification 接口定义
- 单元测试验证通知生成
- 集成测试验证通知送达

---

### EC6: 审计关联完整（audit correlation is complete）

**要求：**
- 所有事件必须关联到同一个 audit_id
- 包括：确认、发送、结果、验证、通知
- 审计日志必须可追溯

**验证方式：**
- AuditCorrelation 接口定义
- 单元测试验证关联完整性
- 集成测试验证审计链

---

### EC7: AUTO 保持禁用（AUTO remains disabled）

**要求：**
- 实现不得启用 AUTO 模式
- PolicyDecision 的 rollout_mode 不得为 AUTO
- 测试必须验证 AUTO 被拒绝

**验证方式：**
- 单元测试验证 AUTO 拒绝
- 对抗性测试验证 AUTO 无法通过实现启用

---

## 五、核心概念

### 5.1 IdentityLock

不可变的身份范围，绑定：
- merchant identity
- store identity (shopId)
- platform-account identity (platformAccountId)
- platform (PDD)
- platform customer identity (customerUid)
- internal conversation identity (conversationId)
- triggering inbound message identity (triggerMessageId)
- runtime/session/document generation evidence

### 5.2 ReplyPlan

AI 生成的结构化回复计划：
- plan_id: 唯一标识
- identity_lock: 继承自 ContextEnvelope
- scene: 场景（如 SHIPPING_TIME）
- trigger_message: 触发消息
- reply_content: 回复内容
- verification_requirements: 验证要求
- policy_metadata: 策略元数据

### 5.3 ConfirmationBinding

人工确认绑定：
- plan_id: ReplyPlan ID
- identity_lock: IdentityLock
- policy_version: 策略版本
- confirmed_at: 确认时间
- confirmed_by: 确认人（用户 ID）
- confirmation_id: 确认唯一 ID

### 5.4 TransportOutcome

类型化的发送结果：
- `ACKNOWLEDGED`: 平台确认
- `REJECTED`: 平台拒绝
- `UNKNOWN`: 状态未知（必须包含原因）

### 5.5 AuditCorrelation

审计关联：
- audit_id: 审计唯一 ID
- confirmation_id: 确认 ID
- plan_id: ReplyPlan ID
- transport_outcome: 发送结果
- verification_records: 验证记录
- notification_id: 通知 ID

---

## 六、治理约束

- [x] 遵守 Master Constitution
- [x] 遵守 DECISIONS.md
- [x] 遵守 REPLY_AND_ACTION_SAFETY.md
- [x] 遵守 PLATFORM_ADAPTER_CONTRACT.md
- [x] 未授权 AUTO 模式
- [x] 未扩大 transport 范围
- [x] 未实现业务 ActionPlan

---

**文档版本:** v1.0  
**创建日期:** 2026-09-30  
**创建人:** Codex  
**审核状态:** 待 Controller 审核
