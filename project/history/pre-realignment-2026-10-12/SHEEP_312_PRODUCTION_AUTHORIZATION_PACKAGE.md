# SHEEP-312 AUTO 生产授权包

**任务 ID:** SHEEP-312  
**日期:** 2026-09-30  
**状态:** 准备就绪，待 Controller 审核  
**授权状态:** ⛔ NOT_GRANTED（当前状态，需 Controller 显式授权才能变更）

---

## 一、执行摘要

### 1.1 任务目标

验证 AUTO 模式的安全不变量，为未来可能的 AUTO 生产授权做准备。

### 1.2 验证范围

| 子任务 | 范围 | 状态 |
|--------|------|------|
| 子任务 1 | IdentityLock 验证审计 | ✅ COMPLETE |
| 子任务 2 | Wrong-Target Gate 完整性验证 | ✅ COMPLETE |
| 子任务 3 | UNKNOWN 语义和重试策略验证 | ✅ COMPLETE |
| 子任务 4 | 跨目标对抗性测试套件 | ✅ COMPLETE |
| 子任务 5 | 审计链完整性验证 | ✅ COMPLETE |

### 1.3 关键发现

1. ✅ **IdentityLock 验证完整** — 所有 8 个字段都被验证（包括新增的 customer_identity 和 generation）
2. ✅ **Wrong-target gate 完整** — 6 种绑定（shop/customer/conversation/session/document/trigger）全部覆盖
3. ✅ **UNKNOWN 安全** — UNKNOWN 结果绝不自动重试，保守策略有效
4. ✅ **对抗性测试通过** — 15 个攻击场景全部被正确拒绝
5. ✅ **审计链完整** — 所有事件可追溯、不可变、完整

### 1.4 建议

**当前 AUTO 授权状态应保持 NOT_GRANTED。**

理由：
- MVP 阶段应以 HUMAN_CONFIRM 模式为主
- AUTO 模式需要更多生产环境验证
- 安全验证通过 ≠ 生产就绪
- Controller 需要评估业务风险和合规要求

---

## 二、安全验证报告

### 2.1 IdentityLock 验证审计

**报告:** `project/SHEEP_312_IDENTITY_LOCK_AUDIT.md`

| 验证项 | 状态 | 说明 |
|--------|------|------|
| merchant_id | ✅ | 确定性字符串比较 |
| store_id | ✅ | 确定性字符串比较 |
| platform | ✅ | 确定性字符串比较 |
| platform_account_id | ✅ | 确定性字符串比较 |
| customer_identity.kind | ✅ | SHEEP-312 新增 |
| customer_identity.value | ✅ | SHEEP-312 新增 |
| conversation_id | ✅ | 确定性字符串比较 |
| trigger_message_id | ✅ | 确定性字符串比较 |
| generation | ✅ | SHEEP-312 新增（防止重放） |

**结论:** ✅ 所有 IdentityLock 字段验证完整、确定性、可审计

### 2.2 Wrong-Target Gate 审计

**报告:** `project/SHEEP_312_WRONG_TARGET_AUDIT.md`

| 绑定类型 | WrongTargetValidator | BindingValidator | 状态 |
|---------|---------------------|-----------------|------|
| shop | ✅ 跨店铺检查 | ✅ 存在性检查 | ✅ |
| customer | ✅ 独立验证 | N/A（由 WT 处理） | ✅ |
| conversation | ✅ 存在性检查 | ✅ 存在性检查 | ✅ |
| session | ✅ 格式检查 | ✅ 存在性检查 | ✅ |
| document | ✅ 版本匹配 | ✅ 存在性检查 | ✅ |
| trigger | ✅ 格式检查 | ✅ 存在性检查 | ✅ |

**结论:** ✅ 所有 6 种绑定验证完整、职责分离清晰

### 2.3 UNKNOWN 语义审计

**报告:** `project/SHEEP_312_UNKNOWN_SEMANTICS_AUDIT.md`

| 安全属性 | 状态 | 说明 |
|---------|------|------|
| UNKNOWN 不自动重试 | ✅ | RetryPolicy 只允许 SAFE_PRE_ATTEMPT |
| attempted 不自动重试 | ✅ | 有 messageId 的失败分类为 ATTEMPTED_UNKNOWN |
| UNKNOWN 触发通知 | ✅ | 通过 SendFailed 事件 |
| UNKNOWN 记录审计 | ✅ | 通过 recordDecision() |
| 默认保守分类 | ✅ | 未知错误默认 ATTEMPTED_UNKNOWN |

**结论:** ✅ UNKNOWN 语义安全、保守、可审计

### 2.4 审计链审计

**报告:** `project/SHEEP_312_AUDIT_CHAIN_AUDIT.md`

| 验证项 | 状态 | 说明 |
|--------|------|------|
| 事件记录完整 | ✅ | 确认/验证/结果/通知 |
| audit_id 关联 | ✅ | 所有事件共享同一 audit_id |
| 不可变性 | ✅ | 纯函数、immutable updates |
| 完整性检查 | ✅ | isAuditComplete() 验证所有必需项 |

**结论:** ✅ 审计链完整、可追溯、不可变

---

## 三、对抗性测试报告

### 3.1 测试场景清单

**文件:** `packages/orchestrator/tests/auto-safety-adversarial.test.ts`

| # | 场景 | 预期 | 结果 |
|---|------|------|------|
| 1 | 跨店铺执行 | 拒绝 | ✅ |
| 2 | 跨账号执行 | 拒绝 | ✅ |
| 3 | 跨客户执行 | 拒绝 | ✅ |
| 4 | 跨会话执行 | 拒绝 | ✅ |
| 5 | 跨触发消息执行 | 拒绝 | ✅ |
| 6 | 过期确认执行 | 拒绝 | ✅ |
| 7 | 过期 generation 重放 | 拒绝 | ✅ |
| 8 | 缺失绑定执行 | 拒绝 | ✅ |
| 9 | UNKNOWN 后重试 | 拒绝 | ✅ |
| 10 | attempted 后重试 | 拒绝 | ✅ |
| 11 | 跨店铺+跨客户组合攻击 | 拒绝 | ✅ |
| 12 | Wrong-target + Binding 双重验证 | 拒绝 | ✅ |
| 13 | 端到端完整攻击链 | 拒绝 | ✅ |
| 14 | customer_identity.kind 欺骗 | 拒绝 | ✅ |
| 15 | 确认哈希唯一性 | 唯一 | ✅ |

### 3.2 测试结果汇总

| 类别 | 测试数 | 通过 | 失败 |
|------|--------|------|------|
| 跨目标攻击 | 5 | 5 | 0 |
| 过期/重放攻击 | 2 | 2 | 0 |
| 绑定完整性 | 1 | 1 | 0 |
| 重试安全 | 2 | 2 | 0 |
| 组合攻击 | 2 | 2 | 0 |
| 端到端 | 1 | 1 | 0 |
| 欺骗攻击 | 1 | 1 | 0 |
| 哈希唯一性 | 1 | 1 | 0 |
| **总计** | **15** | **15** | **0** |

### 3.3 补充测试

| 文件 | 补充测试数 | 说明 |
|------|-----------|------|
| human-confirm-adversarial.test.ts | 5 | 跨客户、kind 欺骗、generation、hash |
| wrong-target-validator.test.ts | 4 | whitespace 边界 |
| binding-validator.test.ts | 4 | whitespace 边界 |
| retry-policy.test.ts | 4 | UNKNOWN 端到端链路 |
| audit-correlation.test.ts | 4 | 不可变性、完整性 |
| **总计** | **21** | |

---

## 四、审计日志样本

### 4.1 成功执行样本

```json
{
  "audit_id": "audit-1727683200000-abc1234",
  "shop_id": "shop-1",
  "conversation_id": "conv-1",
  "plan_id": "plan-123",
  "status": "COMPLETED",
  "created_at": "2026-09-30T10:00:00.000Z",
  "completed_at": "2026-09-30T10:00:05.000Z",
  "confirmation": {
    "confirmation_id": "conf-1",
    "plan_id": "plan-123",
    "identity_lock": {
      "merchant_id": "merchant-1",
      "store_id": "shop-1",
      "platform": "pdd",
      "platform_account_id": "pa-1",
      "customer_identity": { "kind": "customerUid", "value": "customer-1" },
      "conversation_id": "conv-1",
      "trigger_message_id": "msg-1",
      "generation": 1
    },
    "policy_version": "1.0.0",
    "confirmed_at": "2026-09-30T10:00:01.000Z",
    "confirmed_by": "operator-1",
    "confirmation_hash": "sha256-abc12345"
  },
  "verifications": [
    { "type": "identity_lock", "passed": true, "timestamp": "2026-09-30T10:00:02.000Z" },
    { "type": "wrong_target", "passed": true, "timestamp": "2026-09-30T10:00:02.100Z" },
    { "type": "binding", "passed": true, "timestamp": "2026-09-30T10:00:02.200Z" }
  ],
  "outcome": {
    "status": "delivered",
    "platform_message_id": "pm-123",
    "delivered_at": "2026-09-30T10:00:04.000Z"
  },
  "notification": {
    "type": "send_result",
    "title": "消息已发送",
    "message": "消息已成功发送给客户",
    "timestamp": "2026-09-30T10:00:05.000Z"
  }
}
```

### 4.2 跨目标拒绝样本

```json
{
  "decision": "wrong_target_rejected",
  "conversation_id": "conv-1",
  "shop_id": "shop-1",
  "failures": [
    { "field": "shopId", "reason": "shopId does not match — cross-shop execution rejected", "expected": "shop-A", "actual": "shop-B" },
    { "field": "customerUid", "reason": "customerUid mismatch — target customer does not match", "expected": "customer-A", "actual": "customer-B" }
  ]
}
```

### 4.3 UNKNOWN 处理样本

```json
{
  "decision": "send_failed_no_retry",
  "conversation_id": "conv-1",
  "shop_id": "shop-1",
  "failure_type": "ATTEMPTED_UNKNOWN",
  "retry_allowed": false
}
```

---

## 五、风险评估报告

### 5.1 技术风险

| 风险 | 级别 | 缓解措施 | 状态 |
|------|------|---------|------|
| IdentityLock 不完整 | HIGH | SHEEP-312 补全 customer_identity + generation | ✅ 已缓解 |
| 跨目标执行 | HIGH | WrongTargetValidator + BindingValidator 双重验证 | ✅ 已缓解 |
| UNKNOWN 重试 | HIGH | RetryPolicy 只允许 SAFE_PRE_ATTEMPT | ✅ 已缓解 |
| 审计链不完整 | MEDIUM | AuditCorrelation 完整记录 | ✅ 已缓解 |
| 确认过期 | MEDIUM | 过期检查 + generation 验证 | ✅ 已缓解 |

### 5.2 安全风险

| 风险 | 级别 | 缓解措施 | 状态 |
|------|------|---------|------|
| 跨店铺攻击 | CRITICAL | 确定性验证，无 AI 判断 | ✅ 已缓解 |
| 跨客户攻击 | CRITICAL | customer_identity 独立验证 | ✅ 已缓解 |
| 重放攻击 | HIGH | generation 验证 + 过期检查 | ✅ 已缓解 |
| kind 欺骗 | MEDIUM | kind + value 双重验证 | ✅ 已缓解 |

### 5.3 合规风险

| 风险 | 级别 | 缓解措施 | 状态 |
|------|------|---------|------|
| 无审计追踪 | HIGH | AuditCorrelation 完整记录 | ✅ 已缓解 |
| 不可解释决策 | MEDIUM | 所有验证返回详细原因 | ✅ 已缓解 |
| 数据泄露 | MEDIUM | tenant isolation + merchant scope | ✅ 已缓解（架构层面） |

### 5.4 剩余风险

| 风险 | 级别 | 说明 |
|------|------|------|
| AUTO 模式未在生产环境验证 | HIGH | 当前所有验证基于代码审计和测试，非生产经验 |
| 平台 API 行为变化 | MEDIUM | 平台可能改变 API 行为，影响分类准确性 |
| 并发场景未充分测试 | MEDIUM | 多用户同时操作的场景需要更多测试 |

---

## 六、授权建议

### 6.1 当前授权状态

```
AUTO 生产授权: NOT_GRANTED
```

**这是正确的当前状态。** MVP 阶段应使用 HUMAN_CONFIRM 模式。

### 6.2 未来授权条件（如果考虑授权）

如果未来考虑授予 AUTO 生产授权，需要满足：

1. ✅ 安全验证通过（SHEEP-312 已完成）
2. ❌ 生产环境 HUMAN_CONFIRM 模式运行 ≥ 30 天无事故
3. ❌ 完整的监控和告警系统上线
4. ❌ 回滚计划经过演练
5. ❌ Controller 显式审核并授权
6. ❌ 合规团队审核通过

### 6.3 授权限制（如果未来授权）

- 仅限低风险场景（标准回复、无敏感操作）
- 必须保留人工干预能力
- 必须有实时监控和告警
- 必须有限流和熔断机制
- 必须可即时回退到 HUMAN_CONFIRM 模式

### 6.4 监控要求

如果未来授权 AUTO 模式，需要监控：

1. 发送成功率
2. UNKNOWN 结果比例
3. 跨目标拒绝率
4. 重试率
5. 用户满意度
6. 异常事件告警

### 6.5 回滚计划

如果 AUTO 模式出现问题：

1. 立即将 rollout_mode 切换为 HUMAN_CONFIRM
2. 通知所有受影响的用户
3. 分析根本原因
4. 修复并重新验证
5. 重新申请授权

---

## 七、结论

### 7.1 验证总结

| 维度 | 评估 |
|------|------|
| 安全不变量 | ✅ 全部验证通过 |
| 对抗性测试 | ✅ 15 个攻击场景全部拒绝 |
| 审计完整性 | ✅ 所有事件可追溯 |
| 代码质量 | ✅ typecheck 通过，无类型错误 |

### 7.2 授权建议

**当前 AUTO 授权状态应保持 NOT_GRANTED。**

SHEEP-312 完成了全面的安全验证，证明代码层面的安全不变量是正确的。但生产授权不仅仅是技术验证，还需要：
- 生产环境运行经验
- 监控和告警系统
- 合规审核
- Controller 显式决策

### 7.3 下一步

1. 继续 HUMAN_CONFIRM 模式运行
2. 收集生产环境数据
3. 完善监控和告警
4. 未来由 Controller 决定是否授权 AUTO 模式

---

**文档状态:** 准备就绪，待 Controller 审核  
**准备者:** Codex (SHEEP-312)  
**审核者:** Controller (待审核)  
**日期:** 2026-09-30
