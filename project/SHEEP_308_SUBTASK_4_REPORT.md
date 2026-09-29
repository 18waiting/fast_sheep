# SHEEP-308 子任务 4 完成报告：PolicyEngine 实现

**任务ID:** SHEEP-308  
**子任务:** 4/7  
**状态:** ✅ COMPLETE  
**日期:** 2026-09-29

---

## 📋 任务目标

实现 PolicyEngine 核心类，负责评估 ReplyPlan 并返回 PolicyDecision。

---

## ✅ 完成内容

### 1. PolicyEngine 类
**文件:** `apps/desktop/src/main/services/policy-engine.ts`

**核心方法:**
```typescript
async evaluate(
  envelope: ContextEnvelope,
  replyPlan: ReplyPlan,
  config: PolicyConfig
): Promise<PolicyDecision>
```

**评估流程（7步）:**
1. **Validate IdentityLock** — 验证 merchant_id, store_id, platform, customer_identity, conversation_id
2. **Validate facts** — 检查 fact_references（MVP: 仅记录数量）
3. **Check blocking unknowns** — 检查 explicit_unknowns 中 blocking=true 的项
4. **Check capability** — MVP 简化：始终返回 true
5. **Assess risk level** — 基于 scene 和 unknowns 评估风险
6. **Resolve RolloutMode** — 调用 RolloutModeResolver
7. **Build PolicyDecision** — 组装最终决策

### 2. 私有辅助方法

| 方法 | 职责 | 返回值 |
|------|------|--------|
| `validateIdentityLock()` | 验证 IdentityLock 完整性 | `boolean` |
| `validateFacts()` | 验证 fact_references | `void` |
| `checkBlockingUnknowns()` | 检查阻塞性 unknowns | `boolean` |
| `checkCapability()` | 检查 AI 能力（MVP: always true） | `boolean` |
| `assessRiskLevel()` | 评估风险等级 | `"low" \| "medium" \| "high"` |

### 3. 工厂函数
```typescript
export function createPolicyEngine(): PolicyEngine
```

---

## 🔑 关键设计决策

### D1: MVP 简化策略
- **Capability check:** 始终返回 true（未来从数据库查询）
- **Risk assessment:** 基于 scene 和 unknowns（未来可引入更多因素）
- **Fact validation:** 仅记录数量（未来可验证引用完整性）

### D2: 阻塞逻辑
- **blocking_issues 非空** → `allowed=false`, `rollout_mode="OFF"`
- **高风险场景** → 强制 `HUMAN_CONFIRM`
- **阻塞 unknowns** → 阻止执行

### D3: 风险评估规则
```
高风险: blocking unknowns 存在
中风险: scene ∈ {RETURN_POLICY, REFUND, COMPLAINT}
低风险: 默认
```

### D4: 高风险强制规则
```typescript
if (riskLevel === "high" && finalMode !== "OFF") {
  finalMode = "HUMAN_CONFIRM";
}
```

---

## 🔗 依赖关系

### 输入类型
- `ContextEnvelope` — from `@fastwork/domain`
- `ReplyPlan` — from `@fastwork/domain`
- `PolicyConfig` — from `@fastwork/domain` (子任务 2)

### 输出类型
- `PolicyDecision` — from `@fastwork/domain` (子任务 1)

### 内部依赖
- `RolloutModeResolver` — 子任务 3 实现
- `createBlockedDecision()` — 子任务 1 辅助函数
- `createModeDecision()` — 子任务 1 辅助函数

---

## ✅ 验收标准检查

- [x] PolicyEngine 类实现完整
- [x] evaluate() 方法遵循 7 步评估流程
- [x] IdentityLock 验证覆盖所有必需字段
- [x] blocking unknowns 正确阻止执行
- [x] 高风险场景强制 HUMAN_CONFIRM
- [x] 使用 RolloutModeResolver 解析模式
- [x] 返回完整的 PolicyDecision（包含 reasons, warnings, blocking_issues）
- [x] 工厂函数 createPolicyEngine() 提供
- [x] 完整的 JSDoc 文档
- [x] TypeScript 类型完整（readonly、明确类型注解）
- [x] typecheck 通过 ✅

---

## 📊 代码统计

- **文件数:** 1
- **代码行数:** ~280 行
- **公共方法:** 1 (evaluate)
- **私有方法:** 5
- **工厂函数:** 1

---

## 🚀 下一步

**子任务 5:** 集成到 ContextEnvelopeBuilder
- 注入 PolicyEngine 到 Builder
- 在 build() 中调用 policyEngine.evaluate()
- 返回结果包含 policyDecision

---

## 📝 备注

- MVP 简化了 capability 和 risk assessment，未来可扩展
- 高风险场景列表可配置化（当前硬编码）
- typecheck 在 macOS 开发环境通过
- 单元测试 DEFERRED 到个人电脑（需要 Node.js v22+）

---

**完成时间:** 2026-09-29  
**验证状态:** ✅ typecheck 通过  
**测试状态:** ⏳ DEFERRED（需要个人电脑）
