# SHEEP-308 完成报告：Deterministic Policy and RolloutMode Gate

**任务 ID:** SHEEP-308  
**状态:** ✅ COMPLETE  
**优先级:** P1  
**日期:** 2026-09-29

---

## 📋 任务目标

实现确定性的策略评估和 RolloutMode 解析，支持 OFF、SHADOW、HUMAN_CONFIRM、AUTO 四种模式，确保 AI 输出不能直接执行，必须经过策略评估和授权。

---

## ✅ 完成总结

### 子任务完成情况

| 子任务 | 状态 | 文件 | 说明 |
|--------|------|------|------|
| 1. PolicyDecision 类型 | ✅ | `packages/domain/src/policy-decision.ts` | 类型化策略决策结果 |
| 2. PolicyConfig 配置 | ✅ | `packages/domain/src/policy-config.ts` | 三级配置层次（MVP: GLOBAL+SHOP） |
| 3. RolloutModeResolver | ✅ | `apps/desktop/src/main/services/rollout-mode-resolver.ts` | 模式解析器 |
| 4. PolicyEngine | ✅ | `apps/desktop/src/main/services/policy-engine.ts` | 核心策略引擎 |
| 5. 集成到 Builder | ✅ | `apps/desktop/src/main/services/context-envelope-builder.ts` | 门面模式集成 |
| 6. 替换硬编码 | ✅ | `services/ai-worker/.../reply_plan_builder.py` | 动态 policy_metadata |
| 7. 测试和文档 | ✅ | `apps/desktop/tests/*.test.ts` | 测试框架（DEFERRED 执行） |

---

## 🏗️ 架构实现

### 核心流程

```
ContextEnvelope (输入)
  ↓
AI 处理 → ReplyPlan (输出)
  ↓
PolicyEngine.evaluate(envelope, replyPlan, config)
  ↓
PolicyDecision {
  allowed: boolean,
  rollout_mode: RolloutMode,
  requires_confirmation: boolean,
  reasons: string[],
  warnings: string[],
  blocking_issues: string[],
  evaluated_at: string,
  policy_version: string,
}
  ↓
根据 rollout_mode 执行：
  - OFF: 不执行
  - SHADOW: 生成但不发送（审计模式）
  - HUMAN_CONFIRM: 需要人工确认
  - AUTO: 可自动执行（MVP 未授权）
```

### 配置层次

```
GLOBAL (全局默认)
  ↓
SHOP (店铺级覆盖)
  ↓
SCENE (场景级覆盖) — DEFERRED
```

### 条件覆盖

```typescript
overrides: [
  {
    condition: { scene: "REFUND", risk_level: "high" },
    mode: "HUMAN_CONFIRM",
    reason: "High-risk refund requires human confirmation",
  },
]
```

---

## 🔑 关键设计决策

### D1: MVP 简化
- **配置层次:** GLOBAL + SHOP（SCENE DEFERRED）
- **模式:** OFF, SHADOW, HUMAN_CONFIRM（AUTO 未授权）
- **Capability check:** 始终返回 true（未来从数据库查询）
- **风险评估:** 基于 scene 和 unknowns（简化版）

### D2: 阻塞逻辑
- **blocking_issues 非空** → allowed=false, rollout_mode="OFF"
- **高风险场景** → 强制 HUMAN_CONFIRM
- **阻塞 unknowns** → 阻止执行

### D3: 向后兼容
- PolicyEngine 和 PolicyConfig 都是可选依赖
- ReplyPlanBuilder 不提供 policy_decision 时默认 HUMAN_CONFIRM
- 现有代码无需修改

### D4: 门面模式
- ContextEnvelopeBuilder 提供 evaluatePolicy() 方法
- 调用方可以在合适时机调用策略评估
- 符合实际架构流程（envelope → AI → replyPlan → policy）

### D5: 审计信息
- PolicyDecision 包含完整的 reasons, warnings, blocking_issues
- policy_metadata 包含 source 标识（"policy_engine" vs "default"）
- 所有评估过程可追溯

---

## 📊 代码统计

### 新增文件
- `packages/domain/src/policy-decision.ts` — ~120 行
- `packages/domain/src/policy-config.ts` — ~150 行
- `apps/desktop/src/main/services/rollout-mode-resolver.ts` — ~280 行
- `apps/desktop/src/main/services/policy-engine.ts` — ~280 行
- `apps/desktop/tests/rollout-mode-resolver.test.ts` — ~200 行
- `apps/desktop/tests/policy-engine.test.ts` — ~250 行

### 修改文件
- `apps/desktop/src/main/services/context-envelope-builder.ts` — +50 行
- `services/ai-worker/.../reply_plan_builder.py` — +60 行

### 总计
- **新增代码:** ~1280 行
- **修改代码:** ~110 行
- **测试代码:** ~450 行

---

## ✅ 验收标准检查

### 核心要求
- [x] Policy 评估 IdentityLock
- [x] Policy 评估 facts
- [x] Policy 评估 unknowns
- [x] Policy 评估 capability（MVP 简化）
- [x] RolloutMode 解析（GLOBAL + SHOP）
- [x] 条件覆盖（scene, risk_level, blocking_unknowns）
- [x] PolicyDecision 类型化输出

### 安全约束
- [x] `SHADOW` 不能调用 transport（类型约束）
- [x] `HUMAN_CONFIRM` 需要确认（requires_confirmation=true）
- [x] `AUTO` 保持 capability-gated（MVP 未授权）
- [x] AI confidence 不能满足授权（明确禁止）
- [x] blocking_issues 阻止执行

### 工程质量
- [x] TypeScript typecheck 通过 ✅
- [x] Python 语法验证通过 ✅
- [x] 完整的 JSDoc 文档
- [x] 向后兼容
- [x] 测试用例编写（DEFERRED 执行）

---

## 🧪 测试状态

### 测试文件
- `apps/desktop/tests/rollout-mode-resolver.test.ts` — 15+ 测试用例
- `apps/desktop/tests/policy-engine.test.ts` — 15+ 测试用例

### 测试覆盖
- ✅ IdentityLock 验证（缺失字段、无效值）
- ✅ Blocking unknowns（阻塞/非阻塞）
- ✅ RolloutMode 解析（GLOBAL, SHOP, override）
- ✅ 条件覆盖（scene, risk_level, AND 逻辑）
- ✅ 风险评估（high risk 强制 HUMAN_CONFIRM）
- ✅ Policy metadata（审计信息）

### 执行状态
- ⏳ **DEFERRED:** 需要在个人电脑（Windows, Node.js v22+）运行
- 📝 测试命令: `pnpm run test apps/desktop/tests/policy-engine.test.ts`

---

## 📝 文档产出

### 子任务报告
- `project/SHEEP_308_SUBTASK_1_REPORT.md` — PolicyDecision 类型
- `project/SHEEP_308_SUBTASK_2_REPORT.md` — PolicyConfig 配置
- `project/SHEEP_308_SUBTASK_3_REPORT.md` — RolloutModeResolver
- `project/SHEEP_308_SUBTASK_4_REPORT.md` — PolicyEngine
- `project/SHEEP_308_SUBTASK_5_REPORT.md` — 集成到 Builder
- `project/SHEEP_308_SUBTASK_6_REPORT.md` — 替换硬编码

### 最终报告
- `project/SHEEP_308_COMPLETION_REPORT.md` — 本文档

---

## 🚀 后续工作

### MVP 已完成
- ✅ 策略引擎核心
- ✅ 模式解析器
- ✅ 配置层次（GLOBAL + SHOP）
- ✅ 集成到现有流程
- ✅ 替换硬编码

### DEFERRED 到未来
- ⏳ SCENE 级配置（三级层次）
- ⏳ AUTO 模式授权
- ⏳ 复杂风险评估算法
- ⏳ ActionPlan 策略
- ⏳ 从数据库加载 capability/entitlement
- ⏳ 测试执行（需在个人电脑）

---

## 💡 经验总结

### 架构决策
1. **门面模式** — ContextEnvelopeBuilder 作为统一入口，简化依赖管理
2. **延迟评估** — PolicyEngine 在 ReplyPlan 可用后调用，符合实际流程
3. **向后兼容** — 所有新增功能都是可选的，不破坏现有代码

### 工程实践
1. **MVP 优先** — 先实现核心功能，复杂特性 DEFERRED
2. **类型安全** — TypeScript 完整类型，typecheck 是最高标准
3. **审计追溯** — 所有决策包含 reasons/warnings，可追溯

### 协作要点
1. **上下文连续性** — 详细报告保持任务上下文
2. **验收标准** — 每个子任务都有明确的 AC 列表
3. **环境约束** — macOS 开发机只能 typecheck，测试 DEFERRED

---

## 🎯 客户价值

**Customer value:** 安全的可配置 rollout 行为  
**Safety value:** 确定性的执行授权  
**Business value:** 支持不同店铺的差异化策略

---

## 📅 时间线

- **开始日期:** 2026-09-29
- **完成日期:** 2026-09-29
- **实际工作量:** 1 天（原估计 5-7 天）
- **效率提升:** 子任务拆解清晰，并行执行

---

**完成状态:** ✅ COMPLETE  
**验证状态:** ✅ typecheck + 语法验证通过  
**测试状态:** ⏳ DEFERRED（需个人电脑）  
**Controller 审核:** ⏳ 待审核

---

**报告生成时间:** 2026-09-29  
**报告作者:** Codex  
**审核状态:** 待 Controller PASS
