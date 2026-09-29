# SHEEP-308 执行计划：详细子任务拆解

**任务 ID:** SHEEP-308  
**总工作量:** 5-7 天  
**日期:** 2026-09-29

---

## 子任务总览

```
子任务 1: 定义 PolicyDecision 类型（TypeScript）— 0.5 天
    ↓
子任务 2: 定义 PolicyConfig 配置层次（TypeScript）— 0.5 天
    ↓
子任务 3: 实现 RolloutModeResolver（TypeScript）— 1 天
    ↓
子任务 4: 实现 PolicyEngine（TypeScript）— 2 天
    ↓
子任务 5: 集成到 ContextEnvelopeBuilder — 1 天
    ↓
子任务 6: 替换 ReplyPlan 中的硬编码 policy_metadata — 0.5 天
    ↓
子任务 7: 测试和文档 — 1 天
```

**关键路径:** 子任务 1 → 2 → 3 → 4 → 5 → 6  
**总工作量:** 6.5 天

---

## 子任务 1: 定义 PolicyDecision 类型（TypeScript）

**工作量:** 0.5 天 | **优先级:** P0 | **依赖:** 无

### 目标
定义类型化的策略决策结果，明确表达 policy 评估的输出。

### 新建文件
- `packages/domain/src/policy-decision.ts`

### 实现内容
```typescript
export interface PolicyDecision {
  // 决策结果
  readonly allowed: boolean;
  readonly rollout_mode: RolloutMode;
  
  // 确认要求
  readonly requires_confirmation: boolean;
  readonly confirmation_reason?: string;
  
  // 评估详情
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
  readonly blocking_issues: readonly string[];
  
  // 评估元数据
  readonly evaluated_at: string; // ISO 8601
  readonly policy_version: string;
}
```

### 验收标准
- [ ] **AC-1.1:** PolicyDecision 接口定义完整
- [ ] **AC-1.2:** 包含 allowed, rollout_mode, requires_confirmation
- [ ] **AC-1.3:** 包含 reasons, warnings, blocking_issues
- [ ] **AC-1.4:** 包含评估元数据（evaluated_at, policy_version）
- [ ] **AC-1.5:** 从 domain 包导出
- [ ] **AC-1.6:** typecheck 通过

---

## 子任务 2: 定义 PolicyConfig 配置层次（TypeScript）

**工作量:** 0.5 天 | **优先级:** P0 | **依赖:** 无

### 目标
定义策略配置的层次结构，支持 GLOBAL -> SHOP -> SCENE 三级配置。

### 新建文件
- `packages/domain/src/policy-config.ts`

### 实现内容
```typescript
export interface PolicyConfig {
  // 全局默认配置
  readonly global: RolloutModeConfig;
  
  // 店铺级覆盖（可选）
  readonly shops?: Record<string, RolloutModeConfig>;
  
  // 场景级覆盖（可选，MVP DEFERRED）
  readonly scenes?: Record<string, RolloutModeConfig>;
}

export interface RolloutModeConfig {
  readonly default_mode: RolloutMode;
  readonly overrides?: RolloutModeOverride[];
}

export interface RolloutModeOverride {
  readonly condition: OverrideCondition;
  readonly mode: RolloutMode;
  readonly reason: string;
}

export interface OverrideCondition {
  readonly scene?: string;
  readonly risk_level?: "low" | "medium" | "high";
  readonly has_blocking_unknowns?: boolean;
}
```

### 验收标准
- [ ] **AC-2.1:** PolicyConfig 接口定义完整
- [ ] **AC-2.2:** 支持 global 默认配置
- [ ] **AC-2.3:** 支持 shops 级别覆盖
- [ ] **AC-2.4:** 支持 overrides 条件覆盖
- [ ] **AC-2.5:** 从 domain 包导出
- [ ] **AC-2.6:** typecheck 通过

---

## 子任务 3: 实现 RolloutModeResolver（TypeScript）

**工作量:** 1 天 | **优先级:** P1 | **依赖:** 子任务 1, 2

### 目标
根据配置层次和当前上下文解析应该使用的 RolloutMode。

### 新建文件
- `apps/desktop/src/main/services/rollout-mode-resolver.ts`

### 实现内容
```typescript
export class RolloutModeResolver {
  constructor(private readonly config: PolicyConfig) {}
  
  resolve(context: ResolutionContext): RolloutMode {
    // 1. 检查场景级覆盖（MVP DEFERRED）
    // 2. 检查店铺级覆盖
    // 3. 检查条件覆盖
    // 4. 返回默认模式
  }
}

export interface ResolutionContext {
  readonly shop_id: string;
  readonly scene?: string;
  readonly risk_level?: "low" | "medium" | "high";
  readonly has_blocking_unknowns?: boolean;
}
```

### 验收标准
- [ ] **AC-3.1:** RolloutModeResolver 类存在
- [ ] **AC-3.2:** resolve() 方法接收 ResolutionContext
- [ ] **AC-3.3:** 支持店铺级配置覆盖
- [ ] **AC-3.4:** 支持条件覆盖（scene, risk_level, blocking_unknowns）
- [ ] **AC-3.5:** 返回正确的 RolloutMode
- [ ] **AC-3.6:** 默认返回 config.global.default_mode
- [ ] **AC-3.7:** typecheck 通过

---

## 子任务 4: 实现 PolicyEngine（TypeScript）

**工作量:** 2 天 | **优先级:** P1 | **依赖:** 子任务 1, 2, 3

### 目标
实现核心策略引擎，评估所有条件并返回 PolicyDecision。

### 新建文件
- `apps/desktop/src/main/services/policy-engine.ts`

### 实现内容
```typescript
export class PolicyEngine {
  constructor(
    private readonly modeResolver: RolloutModeResolver,
    private readonly verifier: ReplyPlanVerifier,
  ) {}
  
  async evaluate(
    envelope: ContextEnvelope,
    replyPlan: ReplyPlan,
    config: PolicyConfig,
  ): Promise<PolicyDecision> {
    // 1. 验证 IdentityLock
    // 2. 验证 facts
    // 3. 检查 unknowns
    // 4. 检查 capability/entitlement
    // 5. 评估风险
    // 6. 解析 RolloutMode
    // 7. 构建 PolicyDecision
  }
}
```

### 评估逻辑

#### 4.1 IdentityLock 验证
```typescript
const identityResult = this.verifier.verifyIdentityLock(replyPlan.identity_lock);
if (!identityResult.valid) {
  return blocked("IdentityLock validation failed", identityResult.errors);
}
```

#### 4.2 Fact 验证
```typescript
const factResult = this.verifier.verifyFactFreshness(
  replyPlan.fact_references || [],
  envelope.authoritative_facts
);
if (!factResult.valid) {
  return blocked("Fact validation failed", factResult.errors);
}
```

#### 4.3 Unknown 检查
```typescript
const blockingUnknowns = (envelope.explicit_unknowns || [])
  .filter(u => u.blocking !== false);
if (blockingUnknowns.length > 0) {
  return blocked("Blocking unknowns present", blockingUnknowns.map(u => u.description));
}
```

#### 4.4 Capability/Entitlement 检查
```typescript
// MVP: 简化检查，未来可扩展
const hasCapability = await this.checkCapability(envelope.identity_lock);
if (!hasCapability) {
  return mode("OFF", "AI capability not enabled");
}
```

#### 4.5 风险评估
```typescript
const riskLevel = this.assessRisk(envelope, replyPlan);
// 高风险场景强制 HUMAN_CONFIRM
if (riskLevel === "high") {
  return mode("HUMAN_CONFIRM", "High risk scenario");
}
```

#### 4.6 解析 RolloutMode
```typescript
const mode = this.modeResolver.resolve({
  shop_id: envelope.identity_lock.store_id,
  scene: envelope.scene,
  risk_level: riskLevel,
  has_blocking_unknowns: blockingUnknowns.length > 0,
});
```

### 验收标准
- [ ] **AC-4.1:** PolicyEngine 类存在
- [ ] **AC-4.2:** evaluate() 方法接收 envelope, replyPlan, config
- [ ] **AC-4.3:** 验证 IdentityLock
- [ ] **AC-4.4:** 验证 facts
- [ ] **AC-4.5:** 检查 blocking unknowns
- [ ] **AC-4.6:** 检查 capability/entitlement（MVP 简化）
- [ ] **AC-4.7:** 评估风险等级
- [ ] **AC-4.8:** 解析 RolloutMode
- [ ] **AC-4.9:** 返回完整的 PolicyDecision
- [ ] **AC-4.10:** blocking issues 阻止执行
- [ ] **AC-4.11:** warnings 不阻止执行
- [ ] **AC-4.12:** typecheck 通过

---

## 子任务 5: 集成到 ContextEnvelopeBuilder

**工作量:** 1 天 | **优先级:** P1 | **依赖:** 子任务 4

### 目标
在 ContextEnvelopeBuilder 中集成 PolicyEngine，在构建 ReplyPlan 后评估策略。

### 修改文件
- `apps/desktop/src/main/services/context-envelope-builder.ts`

### 实现内容
```typescript
// 在 build() 方法中
const replyPlan = await this.buildReplyPlan(envelope, reply);
const policyDecision = await this.policyEngine.evaluate(envelope, replyPlan, this.config);

// 将 policyDecision 附加到返回结果
return {
  envelope,
  replyPlan,
  policyDecision,
};
```

### 验收标准
- [ ] **AC-5.1:** ContextEnvelopeBuilder 注入 PolicyEngine
- [ ] **AC-5.2:** 在 build() 中调用 policyEngine.evaluate()
- [ ] **AC-5.3:** 返回结果包含 policyDecision
- [ ] **AC-5.4:** typecheck 通过

---

## 子任务 6: 替换 ReplyPlan 中的硬编码 policy_metadata

**工作量:** 0.5 天 | **优先级:** P1 | **依赖:** 子任务 5

### 目标
将 ReplyPlanBuilder 中硬编码的 policy_metadata 替换为 PolicyEngine 的评估结果。

### 修改文件
- `services/ai-worker/src/fastwork_ai_worker/conversation/reply_plan_builder.py`

### 实现内容
```python
# 移除硬编码的 policy_metadata
# 从外部传入 policy_decision
def build(self, envelope, reply, policy_decision=None, ...):
    if policy_decision:
        plan["policy_metadata"] = {
            "rollout_mode": policy_decision.rollout_mode,
            "requires_confirmation": policy_decision.requires_confirmation,
            ...
        }
    else:
        # 向后兼容：默认 HUMAN_CONFIRM
        plan["policy_metadata"] = {"rollout_mode": "HUMAN_CONFIRM", ...}
```

### 验收标准
- [ ] **AC-6.1:** ReplyPlanBuilder 接收 policy_decision 参数
- [ ] **AC-6.2:** 使用 policy_decision 构建 policy_metadata
- [ ] **AC-6.3:** 向后兼容（无 policy_decision 时默认 HUMAN_CONFIRM）
- [ ] **AC-6.4:** 语法验证通过

---

## 子任务 7: 测试和文档

**工作量:** 1 天 | **优先级:** P2 | **依赖:** 子任务 6

### 目标
编写测试用例，验证策略引擎的正确性，生成完成报告。

### 新建文件
- `apps/desktop/tests/policy-engine.test.ts`
- `apps/desktop/tests/rollout-mode-resolver.test.ts`
- `project/SHEEP_308_COMPLETION_REPORT.md`

### 测试用例

#### 7.1 RolloutModeResolver 测试
```typescript
test("returns global default when no overrides", () => {
  const resolver = new RolloutModeResolver({
    global: { default_mode: "HUMAN_CONFIRM" }
  });
  expect(resolver.resolve({ shop_id: "s1" })).toBe("HUMAN_CONFIRM");
});

test("returns shop override when configured", () => {
  const resolver = new RolloutModeResolver({
    global: { default_mode: "HUMAN_CONFIRM" },
    shops: { "s1": { default_mode: "SHADOW" } }
  });
  expect(resolver.resolve({ shop_id: "s1" })).toBe("SHADOW");
});

test("returns OFF when capability not enabled", () => {
  // ...
});
```

#### 7.2 PolicyEngine 测试
```typescript
test("blocks when IdentityLock invalid", async () => {
  const engine = new PolicyEngine(...);
  const decision = await engine.evaluate(
    envelopeWithInvalidLock,
    replyPlan,
    config
  );
  expect(decision.allowed).toBe(false);
  expect(decision.blocking_issues).toContain("IdentityLock validation failed");
});

test("blocks when blocking unknowns present", async () => {
  // ...
});

test("returns HUMAN_CONFIRM by default", async () => {
  // ...
});

test("returns SHADOW when configured", async () => {
  // ...
});

test("SHADOW cannot call transport", async () => {
  // 验证 SHADOW 模式的约束
});
```

### 验收标准
- [ ] **AC-7.1:** RolloutModeResolver 测试覆盖
- [ ] **AC-7.2:** PolicyEngine 测试覆盖
- [ ] **AC-7.3:** 测试 blocking scenarios
- [ ] **AC-7.4:** 测试 mode resolution
- [ ] **AC-7.5:** 完成报告生成
- [ ] **AC-7.6:** 测试标记为 DEFERRED（需在个人电脑运行）

---

## 执行顺序

```
子任务 1: PolicyDecision 类型（0.5 天）
    ↓
子任务 2: PolicyConfig 配置（0.5 天）
    ↓
子任务 3: RolloutModeResolver（1 天）← 依赖子任务 1, 2
    ↓
子任务 4: PolicyEngine（2 天）← 依赖子任务 1, 2, 3
    ↓
子任务 5: 集成到 Builder（1 天）← 依赖子任务 4
    ↓
子任务 6: 替换硬编码（0.5 天）← 依赖子任务 5
    ↓
子任务 7: 测试和文档（1 天）← 依赖子任务 6
```

**关键路径:** 子任务 1 → 2 → 3 → 4 → 5 → 6 → 7  
**总工作量:** 6.5 天

---

## 环境约束

- **开发机（macOS）:** Node v20, typecheck only, ❌ 不能运行测试
- **测试机（Windows）:** Node v22+, ✅ 完整测试
- **验证标准:** macOS 上 typecheck 通过 = 代码正确性最高保证
- **测试标记:** 需要测试的任务标记为 `DEFERRED: 需在个人电脑运行`

---

## MVP 简化

### 本次实现
- ✅ GLOBAL 配置
- ✅ SHOP 配置覆盖
- ✅ 条件覆盖（scene, risk_level, blocking_unknowns）
- ✅ OFF, SHADOW, HUMAN_CONFIRM 模式
- ✅ 基本风险评估

### DEFERRED 到未来
- ⏳ SCENE 配置覆盖（三级层次）
- ⏳ AUTO 模式授权
- ⏳ 复杂风险评估算法
- ⏳ ActionPlan 策略

---

**文档版本:** v1.0  
**创建日期:** 2026-09-29
