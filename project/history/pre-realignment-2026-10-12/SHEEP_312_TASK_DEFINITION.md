# SHEEP-312 任务定义：AUTO Safety and Adversarial Validation

**任务 ID:** SHEEP-312  
**日期:** 2026-09-30  
**状态:** NOT_STARTED / NOT_AUTHORIZED  
**依赖:** SHEEP-311 ✅ (HUMAN_CONFIRM PDD Transport and Verification)

---

## 一、任务目标

**Goal:** Validate all deterministic prerequisites for AUTO.

验证 AUTO 模式的所有确定性前提条件，确保在授予生产授权之前，所有安全机制都已正确实现并经过充分测试。

**Customer value:** safely lower required human effort — 安全地减少人工工作量  
**Safety value:** AUTO cannot become authorized through implementation alone — AUTO 不能仅通过实现就获得授权

---

## 二、允许范围（Allowed scope）

- ✅ AUTO 策略验证（AUTO policy validation）
- ✅ 对抗性测试（adversarial tests）
- ✅ 审计验证（audit validation）
- ✅ 生产授权包准备（production-authorization package preparation）

---

## 三、禁止范围（Must not）

- ❌ 授予生产授权（grant production authorization）
- ❌ 执行业务 ActionPlan（execute business ActionPlans）
- ❌ 实现 AUTO 模式的实际执行逻辑
- ❌ 修改现有的 HUMAN_CONFIRM 流程

---

## 四、退出标准（Exit criteria）

### EC1: IdentityLock 验证是确定性的

**要求：**
- IdentityLock 验证必须是确定性的应用逻辑
- 验证必须覆盖所有必需字段：
  - merchant_id（商家身份）
  - store_id（店铺身份）
  - platform（平台）
  - platform_account_id（平台账号）
  - conversation_id（会话 ID）
  - trigger_message_id（触发消息 ID）
  - customer_identity（客户身份）
  - generation（运行时/会话/文档代次）
- 验证必须拒绝缺失、冲突、过期或未解析的身份事实
- 验证结果必须是可审计的

**验证方式：**
- 代码审查：验证逻辑是确定性的
- 单元测试：覆盖所有验证场景
- 对抗性测试：验证边界情况和攻击向量

---

### EC2: wrong-target gate 覆盖 shop/customer/conversation/session/document

**要求：**
- wrong-target gate 必须在发送前验证所有绑定：
  - shop — 店铺标识
  - customer — 客户平台身份（customerUid）
  - conversation — 内部会话身份
  - session — 运行时/会话身份
  - document — 文档代次
  - trigger — 触发消息绑定
- gate 必须在任何绑定无法证明时拒绝执行
- 一次正确的发送不能作为未来目标绑定安全的证据

**验证方式：**
- 代码审查：WrongTargetValidator 和 BindingValidator 实现
- 单元测试：覆盖所有绑定验证场景
- 对抗性测试：验证跨店铺/跨客户/跨会话攻击

---

### EC3: attempted/UNKNOWN 永远不会自动重试

**要求：**
- 在执行尝试后，当无法排除平台副作用时，不允许自动重试
- UNKNOWN 结果必须：
  - 停止自动执行
  - 保留原因/上下文以供审计
  - 将案例呈现给人工
- 安全的预尝试或明确的 NOT_ATTEMPTED 失败只能在未来的明确策略下重试

**验证方式：**
- 代码审查：RetryPolicy 实现
- 单元测试：验证 UNKNOWN 不会触发重试
- 对抗性测试：验证 attempted 状态不会自动重试

---

### EC4: 类型化的 UNKNOWN 处理和升级被证明

**要求：**
- UNKNOWN 结果必须有类型化的处理逻辑
- UNKNOWN 必须触发桌面通知
- UNKNOWN 必须记录到审计日志
- UNKNOWN 必须阻止后续自动执行

**验证方式：**
- 代码审查：UnknownOutcome 和 DesktopNotification 实现
- 单元测试：验证 UNKNOWN 处理流程
- 集成测试：验证 UNKNOWN 升级到人

---

### EC5: 结果验证和持久化审计完成

**要求：**
- 所有执行结果必须被验证
- 所有审计记录必须持久化
- 审计链必须完整且可追溯
- 审计记录必须包含所有必需的事件

**验证方式：**
- 代码审查：AuditCorrelation 实现
- 单元测试：验证审计完整性
- 集成测试：验证端到端审计链

---

### EC6: 跨店铺/账号对抗性测试通过

**要求：**
- 跨店铺执行必须被拒绝
- 跨账号执行必须被拒绝
- 跨客户执行必须被拒绝
- 跨会话执行必须被拒绝
- 所有对抗性场景都必须有明确的错误信息

**验证方式：**
- 对抗性测试套件
- 覆盖所有跨目标攻击向量
- 验证错误信息的清晰度

---

### EC7: AUTO 生产授权包准备好供 Controller 审核

**要求：**
- 准备完整的生产授权包
- 包含所有安全验证结果
- 包含所有对抗性测试结果
- 包含审计日志样本
- 包含风险评估报告

**验证方式：**
- 授权包文档完整性检查
- Controller 审核

---

### EC8: AUTO 生产授权保持 NOT_GRANTED

**要求：**
- 实现不得授予 AUTO 生产授权
- PROJECT_STATE.json 中的 AUTO 授权状态必须保持 NOT_GRANTED
- 任何授权变更都需要单独的 Controller 审核

**验证方式：**
- 代码审查
- PROJECT_STATE.json 验证

---

## 五、核心概念

### 5.1 IdentityLock 验证

IdentityLock 是不可变的身份范围，包含：
- merchant_id: 商家身份
- store_id: 店铺身份
- platform: 平台（PDD, 抖店, 京东等）
- platform_account_id: 平台账号身份
- customer_identity: 客户平台身份
- conversation_id: 内部会话身份
- trigger_message_id: 触发消息身份
- generation: 运行时/会话/文档代次

验证必须是确定性的，不能依赖 AI 置信度。

### 5.2 Wrong-Target Gate

Wrong-target gate 是发送前的最后一道防线，验证：
- 目标店铺是否正确
- 目标客户是否正确
- 目标会话是否正确
- 目标触发消息是否正确
- 运行时/会话状态是否有效
- 文档版本是否最新

任何一个验证失败都必须阻止发送。

### 5.3 UNKNOWN 语义

UNKNOWN 表示无法确定执行状态，必须：
- 停止自动执行
- 保留原因和上下文
- 呈现给人工决策
- 记录到审计日志
- 触发桌面通知

UNKNOWN 不能自动重试，因为无法排除平台副作用。

### 5.4 审计链

审计链必须包含：
- 确认事件（ConfirmationBinding）
- 验证事件（VerificationRecord）
- 执行事件（TransportOutcome）
- 通知事件（DesktopNotification）
- 所有事件关联到同一个 audit_id

---

## 六、治理约束

- [x] 遵守 Master Constitution
- [x] 遵守 REPLY_AND_ACTION_SAFETY
- [x] 遵守 PLATFORM_ADAPTER_CONTRACT
- [x] AUTO 生产授权保持 NOT_GRANTED
- [x] 不授予生产授权
- [x] 不执行业务 ActionPlan

---

## 七、依赖关系

- **前置依赖:** SHEEP-311 ✅
  - TransportOutcome 类型定义
  - ConfirmationBinding 类型定义
  - VerificationRecord 类型定义
  - DesktopNotification 类型定义
  - AuditCorrelation 类型定义
  - HumanConfirmController 实现
  - ConversationOrchestrator 集成

- **后续依赖:** SHEEP-313（多店铺扩展证明）

---

## 八、风险评估

### 8.1 技术风险

- **风险:** 现有实现可能存在未发现的边界情况
- **缓解:** 全面的对抗性测试
- **状态:** 中等风险

### 8.2 安全风险

- **风险:** AUTO 模式可能在未充分验证的情况下被启用
- **缓解:** 明确的治理约束和授权流程
- **状态:** 高风险，需要严格控制

### 8.3 合规风险

- **风险:** 可能违反平台规则或法律法规
- **缓解:** 保守的安全策略和人工监督
- **状态:** 中等风险

---

## 九、验收标准总结

| 编号 | 退出标准 | 验证方式 | 状态 |
|------|---------|---------|------|
| EC1 | IdentityLock 验证是确定性的 | 代码审查 + 测试 | ⏸️ 待验证 |
| EC2 | wrong-target gate 覆盖所有绑定 | 代码审查 + 测试 | ⏸️ 待验证 |
| EC3 | attempted/UNKNOWN 永不自动重试 | 代码审查 + 测试 | ⏸️ 待验证 |
| EC4 | UNKNOWN 处理和升级被证明 | 代码审查 + 测试 | ⏸️ 待验证 |
| EC5 | 结果验证和持久化审计完成 | 代码审查 + 测试 | ⏸️ 待验证 |
| EC6 | 跨店铺/账号对抗性测试通过 | 对抗性测试 | ⏸️ 待验证 |
| EC7 | AUTO 生产授权包准备好 | 文档检查 | ⏸️ 待验证 |
| EC8 | AUTO 生产授权保持 NOT_GRANTED | 状态验证 | ⏸️ 待验证 |

---

**定义人:** Codex AI Agent  
**审核人:** 待 Controller 审核  
**日期:** 2026-09-30
