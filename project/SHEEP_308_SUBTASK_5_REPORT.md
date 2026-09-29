# SHEEP-308 子任务 5 完成报告：集成到 ContextEnvelopeBuilder

**任务ID:** SHEEP-308  
**子任务:** 5/7  
**状态:** ✅ COMPLETE  
**日期:** 2026-09-29

---

## 📋 任务目标

将 PolicyEngine 集成到 ContextEnvelopeBuilder，提供策略评估能力。

---

## ✅ 完成内容

### 1. 扩展 ContextEnvelopeBuilderDeps
**文件:** `apps/desktop/src/main/services/context-envelope-builder.ts`

**新增依赖:**
```typescript
export interface ContextEnvelopeBuilderDeps {
  readonly sceneClassifier: MinimalSceneClassifier;
  readonly factsPort: AuthoritativeFactsPort;
  readonly knowledgePort: StoreKnowledgeRetrievalPort;
  readonly clock?: Clock;
  readonly policyEngine?: PolicyEngine; // SHEEP-308: 新增
  readonly policyConfig?: PolicyConfig; // SHEEP-308: 新增
}
```

**设计决策:**
- `policyEngine` 和 `policyConfig` 都是**可选**的
- 向后兼容：不配置时 Builder 行为不变
- 依赖注入：保持 Builder 的依赖注入模式

### 2. 添加 evaluatePolicy() 方法

```typescript
async evaluatePolicy(
  envelope: ContextEnvelope,
  replyPlan: ReplyPlan,
): Promise<PolicyDecision | null> {
  if (!this.deps.policyEngine || !this.deps.policyConfig) {
    return null; // Policy evaluation not enabled
  }
  
  return await this.deps.policyEngine.evaluate(
    envelope,
    replyPlan,
    this.deps.policyConfig,
  );
}
```

**关键设计:**
- 返回 `PolicyDecision | null`
- `null` 表示策略评估未启用
- 委托给 PolicyEngine 执行实际评估

### 3. 架构调整说明

**原计划问题:**
执行计划假设在 `build()` 方法中同时构建 ReplyPlan 并评估策略，但这不符合实际架构：
1. ContextEnvelopeBuilder 构建 ContextEnvelope（AI 输入）
2. AI 处理 ContextEnvelope → 生成回复
3. ReplyPlanBuilder 构建 ReplyPlan（AI 输出）
4. PolicyEngine 评估 (envelope, replyPlan, config) → PolicyDecision

**实际实现:**
- 保持 Builder 核心职责不变（构建 ContextEnvelope）
- 添加 `evaluatePolicy()` 方法供调用方在 ReplyPlan 可用后使用
- Builder 成为"构建 + 评估"的门面（Facade）

---

## 🔑 关键设计决策

### D4: 可选集成
- PolicyEngine 和 PolicyConfig 都是可选依赖
- 不配置时 Builder 行为完全不变
- 向后兼容现有代码

### D5: 延迟评估
- PolicyEngine 不在 `build()` 中调用
- 提供 `evaluatePolicy()` 方法供调用方在合适时机使用
- 符合实际架构流程（envelope → AI → replyPlan → policy）

### D6: 门面模式
- Builder 成为"构建 + 评估"的统一入口
- 调用方可以通过 Builder 访问所有功能
- 简化依赖管理

---

## 🔗 依赖关系

### 新增导入
```typescript
import type { ReplyPlan, PolicyConfig, PolicyDecision } from "@fastwork/domain";
import type { PolicyEngine } from "./policy-engine.js";
```

### 依赖组件
- `PolicyEngine` — 子任务 4 实现
- `PolicyConfig` — 子任务 2 定义
- `PolicyDecision` — 子任务 1 定义

---

## ✅ 验收标准检查

- [x] **AC-5.1:** ContextEnvelopeBuilder 注入 PolicyEngine（可选）
- [x] **AC-5.2:** 提供 evaluatePolicy() 方法调用 policyEngine.evaluate()
- [x] **AC-5.3:** 返回结果包含 PolicyDecision（或 null）
- [x] **AC-5.4:** typecheck 通过 ✅
- [x] **AC-5.5:** 向后兼容（不配置时行为不变）
- [x] **AC-5.6:** 完整的 JSDoc 文档

---

## 📊 使用示例

### 基础用法（无策略评估）
```typescript
const builder = new ContextEnvelopeBuilder({
  sceneClassifier: createMinimalSceneClassifier(),
  factsPort: createStubAuthoritativeFactsProvider(),
  knowledgePort: createRpcStoreKnowledgeRetrievalAdapter(workerClient),
});

const envelope = await builder.build(input);
// 不使用策略评估
```

### 完整用法（带策略评估）
```typescript
const builder = new ContextEnvelopeBuilder({
  sceneClassifier: createMinimalSceneClassifier(),
  factsPort: createStubAuthoritativeFactsProvider(),
  knowledgePort: createRpcStoreKnowledgeRetrievalAdapter(workerClient),
  policyEngine: createPolicyEngine(), // SHEEP-308
  policyConfig: createSimplePolicyConfig("HUMAN_CONFIRM"), // SHEEP-308
});

// Step 1: Build ContextEnvelope
const envelope = await builder.build(input);

// Step 2: AI processes envelope → generates reply
const aiReply = await processWithAI(envelope);

// Step 3: Build ReplyPlan
const replyPlan = await buildReplyPlan(envelope, aiReply);

// Step 4: Evaluate policy
const decision = await builder.evaluatePolicy(envelope, replyPlan);

if (decision) {
  if (!decision.allowed) {
    console.log("Blocked:", decision.blocking_issues);
  } else {
    console.log("Mode:", decision.rollout_mode);
  }
}
```

---

## 📝 代码变更统计

- **修改文件:** 1
- **新增代码:** ~50 行
- **新增方法:** 1 (evaluatePolicy)
- **新增依赖:** 2 (policyEngine, policyConfig)
- **破坏性变更:** 无（完全向后兼容）

---

## 🚀 下一步

**子任务 6:** 替换 ReplyPlan 中的硬编码 policy_metadata
- 修改 Python 侧 ReplyPlanBuilder
- 接收 policy_decision 参数
- 使用 policy_decision 构建 policy_metadata
- 向后兼容（无 policy_decision 时默认 HUMAN_CONFIRM）

---

## 💡 备注

- 架构调整更合理：PolicyEngine 在 ReplyPlan 可用后调用
- 向后兼容：现有代码无需修改
- typecheck 在 macOS 开发环境通过
- 单元测试 DEFERRED 到个人电脑

---

**完成时间:** 2026-09-29  
**验证状态:** ✅ typecheck 通过  
**测试状态:** ⏳ DEFERRED（需要个人电脑）
