# SHEEP-312 IdentityLock 验证审计报告

**审计日期:** 2026-09-30  
**审计人:** Codex AI Agent  
**审计范围:** IdentityLock 验证的确定性、完整性和安全性

---

## 一、审计目标

验证 IdentityLock 验证逻辑是否满足以下要求：
1. 验证是确定性的（不依赖 AI 置信度）
2. 覆盖所有必需的 IdentityLock 字段
3. 验证结果可审计
4. 拒绝缺失、冲突、过期或未解析的身份事实

---

## 二、IdentityLock 字段清单

根据 `packages/domain/src/context-envelope.ts` 中的 `ContractIdentityLock` 定义：

| 字段 | 类型 | 必需 | 描述 |
|------|------|------|------|
| merchant_id | string | ✅ | 商家身份 |
| store_id | string | ✅ | 店铺身份 |
| platform | PlatformId | ✅ | 平台（PDD, 抖店, 京东等） |
| platform_account_id | string | ✅ | 平台账号身份 |
| customer_identity | ContractCustomerIdentity | ✅ | 客户平台身份 |
| conversation_id | string | ✅ | 内部会话身份 |
| trigger_message_id | string | ✅ | 触发消息身份 |
| generation | number | ❌ | 运行时/会话/文档代次（可选） |

**总计:** 8 个字段（7 个必需，1 个可选）

---

## 三、验证器审计结果

### 3.1 HumanConfirmController.validateConfirmation()

**文件:** `packages/orchestrator/src/core/human-confirm-controller.ts`

**验证的字段:**
- ✅ plan_id
- ✅ conversation_id
- ✅ merchant_id
- ✅ store_id
- ✅ platform
- ✅ platform_account_id
- ✅ trigger_message_id

**遗漏的字段:**
- ❌ customer_identity（客户身份）
- ❌ generation（运行时/会话/文档代次）

**确定性:** ✅ 是确定性的（纯字符串比较）  
**可审计性:** ✅ 返回布尔值，可记录

**问题:**
1. **严重:** 未验证 customer_identity，可能导致跨客户执行
2. **中等:** 未验证 generation，可能导致过期会话执行

**建议:**
- 添加 customer_identity 验证
- 添加 generation 验证（如果提供）

---

### 3.2 WrongTargetValidator

**文件:** `packages/orchestrator/src/core/wrong-target-validator.ts`

**验证的字段:**
- ✅ shopId（店铺 ID）
- ✅ conversationId（会话 ID）
- ✅ customerUid（客户 UID）
- ✅ platformAccountId（平台账号 ID）
- ✅ triggerMessageId（触发消息 ID）
- ✅ sessionId（会话 session ID）
- ✅ documentVersion（文档版本）

**验证逻辑:**
1. shopId 必须存在且非空
2. conversationId 必须存在且非空
3. shopId 必须与期望店铺匹配（跨店铺检查）
4. customerUid 独立验证（不依赖 conversationId）
5. customerUid 格式验证
6. platformAccountId 格式验证
7. triggerMessageId 格式验证
8. sessionId 格式验证
9. documentVersion 与期望版本匹配

**确定性:** ✅ 是确定性的  
**可审计性:** ✅ 返回详细的失败信息

**优点:**
- 覆盖全面
- customerUid 独立验证（防止会话 ID 正确但客户错误）
- 跨店铺检查
- 文档版本验证

**问题:**
- 无明显问题

**建议:**
- 保持现有实现

---

### 3.3 BindingValidator

**文件:** `packages/orchestrator/src/core/binding-validator.ts`

**验证的绑定:**
1. ✅ shop — shopId
2. ✅ platform — platformAccountId
3. ✅ conversation — conversationId
4. ✅ trigger — triggerMessageId
5. ✅ session — sessionId
6. ✅ document — documentVersion

**验证逻辑:**
- 所有绑定都必须非空且有效
- 任何一个绑定失败都会阻止发送

**确定性:** ✅ 是确定性的  
**可审计性:** ✅ 返回详细的失败信息

**优点:**
- 覆盖 6 种关键绑定
- 保守策略（任何失败都阻止发送）

**问题:**
- 无明显问题

**建议:**
- 保持现有实现

---

## 四、覆盖度分析

### 4.1 IdentityLock 字段覆盖

| 字段 | HumanConfirmController | WrongTargetValidator | BindingValidator | 总覆盖 |
|------|----------------------|---------------------|-----------------|--------|
| merchant_id | ✅ | ✅ (shopId) | ✅ (shopId) | ✅ |
| store_id | ✅ | ✅ (shopId) | ✅ (shopId) | ✅ |
| platform | ✅ | ❌ | ❌ | ⚠️ 部分 |
| platform_account_id | ✅ | ✅ | ✅ | ✅ |
| customer_identity | ❌ | ✅ (customerUid) | ❌ | ⚠️ 部分 |
| conversation_id | ✅ | ✅ | ✅ | ✅ |
| trigger_message_id | ✅ | ✅ | ✅ | ✅ |
| generation | ❌ | ❌ | ❌ | ❌ 未覆盖 |

**覆盖率:** 6/8 = 75%

### 4.2 关键缺失

1. **customer_identity 在 HumanConfirmController 中未验证**
   - 风险: 可能导致跨客户执行
   - 严重程度: 高
   - 建议: 添加验证

2. **generation 在所有验证器中未验证**
   - 风险: 可能导致过期会话执行
   - 严重程度: 中
   - 建议: 添加验证（如果提供）

3. **platform 只在 HumanConfirmController 中验证**
   - 风险: WrongTargetValidator 和 BindingValidator 未验证平台
   - 严重程度: 低（因为 platform 通常从 shopId 推导）
   - 建议: 可选添加

---

## 五、确定性验证

### 5.1 HumanConfirmController.validateConfirmation()

```typescript
// 纯字符串比较，无 AI 依赖
if (binding.identity_lock.conversation_id !== expectedIdentityLock.conversation_id) {
  return false;
}
```

**结论:** ✅ 确定性

### 5.2 WrongTargetValidator

```typescript
// 纯字符串比较和空值检查，无 AI 依赖
if (!context.shopId || context.shopId.trim() === "") {
  failures.push(...);
}
```

**结论:** ✅ 确定性

### 5.3 BindingValidator

```typescript
// 纯字符串空值检查，无 AI 依赖
if (!context.shopId || context.shopId.trim() === "") {
  failures.push(...);
}
```

**结论:** ✅ 确定性

---

## 六、可审计性验证

### 6.1 HumanConfirmController.validateConfirmation()

- 返回布尔值
- 可记录验证结果
- 可记录失败的字段

**结论:** ✅ 可审计

### 6.2 WrongTargetValidator

- 返回详细的失败信息
- 包含 field, reason, expected, actual
- 可完整记录验证过程

**结论:** ✅ 可审计

### 6.3 BindingValidator

- 返回详细的失败信息
- 包含 binding, reason
- 可完整记录验证过程

**结论:** ✅ 可审计

---

## 七、发现的问题

### 7.1 严重问题

#### 问题 1: HumanConfirmController 未验证 customer_identity

**描述:**
`validateConfirmation()` 方法未验证 `customer_identity` 字段，可能导致跨客户执行。

**影响:**
- 攻击者可能使用客户 A 的确认发送给客户 B
- 违反"一个确认不能授权不同的目标"原则

**修复建议:**
```typescript
// 添加 customer_identity 验证
if (binding.identity_lock.customer_identity.customer_uid !== 
    expectedIdentityLock.customer_identity.customer_uid) {
  return false;
}
```

**优先级:** 🔴 高

---

### 7.2 中等问题

#### 问题 2: generation 字段未验证

**描述:**
所有验证器都未验证 `generation` 字段，可能导致过期会话执行。

**影响:**
- 可能使用过期的会话/文档执行发送
- 违反"当前运行时/会话身份"验证要求

**修复建议:**
```typescript
// 在 HumanConfirmController 中添加 generation 验证
if (expectedIdentityLock.generation !== undefined && 
    binding.identity_lock.generation !== expectedIdentityLock.generation) {
  return false;
}
```

**优先级:** 🟡 中

---

### 7.3 低优先级问题

#### 问题 3: platform 字段在 WrongTargetValidator 和 BindingValidator 中未验证

**描述:**
`platform` 字段只在 `HumanConfirmController` 中验证。

**影响:**
- 风险较低，因为 platform 通常从 shopId 推导
- 但为了完整性，建议添加验证

**修复建议:**
```typescript
// 在 WrongTargetValidator 中添加 platform 验证
if (context.expectedPlatform && context.platform && 
    context.platform !== context.expectedPlatform) {
  failures.push(...);
}
```

**优先级:** 🟢 低

---

## 八、修复计划

### 8.1 立即修复（子任务 1 范围内）

1. **修复 HumanConfirmController.validateConfirmation()**
   - 添加 customer_identity 验证
   - 添加 generation 验证（如果提供）
   - 更新单元测试

2. **更新对抗性测试**
   - 添加跨客户攻击测试
   - 添加过期会话攻击测试

### 8.2 后续优化（可选）

1. **在 WrongTargetValidator 中添加 platform 验证**
2. **在 BindingValidator 中添加 platform 验证**

---

## 九、审计结论

### 9.1 确定性

✅ **PASS** - 所有验证器都是确定性的，不依赖 AI 置信度

### 9.2 完整性

⚠️ **PARTIAL** - 覆盖了 75% 的 IdentityLock 字段，但遗漏了 customer_identity 和 generation

### 9.3 可审计性

✅ **PASS** - 所有验证器都返回详细的验证结果，可完整记录

### 9.4 安全性

⚠️ **PARTIAL** - 存在跨客户执行风险（customer_identity 未验证）

---

## 十、建议

### 10.1 立即行动

1. **修复 HumanConfirmController.validateConfirmation()**
   - 添加 customer_identity 验证
   - 添加 generation 验证
   - 更新单元测试和对抗性测试

2. **验证修复效果**
   - 运行所有测试
   - 验证跨客户攻击被拒绝
   - 验证过期会话被拒绝

### 10.2 后续行动

1. **考虑在 WrongTargetValidator 和 BindingValidator 中添加 platform 验证**
2. **定期审查验证逻辑，确保覆盖所有必需字段**
3. **添加更多的对抗性测试场景**

---

## 十一、附录

### 11.1 ContractCustomerIdentity 定义

```typescript
export interface ContractCustomerIdentity {
  readonly customer_uid: string;
  readonly customer_nick?: string;
}
```

### 11.2 验证器对比

| 验证器 | 目的 | 覆盖字段 | 确定性 | 可审计性 |
|--------|------|---------|--------|---------|
| HumanConfirmController | 确认绑定验证 | 7/8 | ✅ | ✅ |
| WrongTargetValidator | 发送前目标验证 | 7/8 | ✅ | ✅ |
| BindingValidator | 发送前绑定验证 | 6/8 | ✅ | ✅ |

---

**审计人:** Codex AI Agent  
**审核人:** 待 Controller 审核  
**日期:** 2026-09-30
