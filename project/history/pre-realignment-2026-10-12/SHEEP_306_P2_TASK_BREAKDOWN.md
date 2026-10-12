# SHEEP-306 P2 任务详细拆解

> **创建日期:** 2026-09-29
> **目的:** 将 P2 级问题拆解为可独立交付的子任务
> **原则:** 每个子任务有明确的目标、边界、验收标准、依赖关系
> **前置:** P0 ✅ | P1 ✅

---

## 〇、P2 问题现状分析

### 已完成（在 P1 中实现）

| 编号 | 问题 | 实现位置 | 状态 |
|------|------|----------|------|
| P2-11 | Unknown 判定逻辑 | `apps/desktop/src/main/services/unknown-identifier.ts` (P1-6d) | ✅ 已完成 |
| P2-12 | Orchestrator 集成点 | `apps/desktop/src/main/services/context-envelope-integration.ts` (P1-6f) | ✅ 骨架已完成 |

### 待处理

| 编号 | 问题 | 优先级 | 预估工作量 | 状态 |
|------|------|--------|------------|------|
| P2-8 | ReplyPlanVerifier 未实现 | 🔵 P2 | 3 天 | ⏳ 待拆解 |
| P2-9 | IdentityLock 验证 | 🔵 P2 | 包含在 P2-8 | ⏳ 待拆解 |
| P2-10 | Fact 验证 | 🔵 P2 | 包含在 P2-8 | ⏳ 待拆解 |
| P2-13 | 集成测试未编写 | 🔵 P2 | 2 天 | ⏳ 待规划 |
| P2-14 | 架构文档未更新 | 🔵 P2 | 1 天 | ⏳ 待规划 |
| P2-15 | Order/Logistics Facts | 🔵 P2 | N/A | ⏳ DEFERRED |

---

## 一、P2-8/9/10: ReplyPlanVerifier 拆解

### 背景分析

**ReplyPlanVerifier 的职责:**
1. 在发送前验证 ReplyPlan 的合法性和安全性
2. 验证 IdentityLock 是否有效（P2-9）
3. 验证 Fact 是否新鲜（P2-10）
4. 验证 Inference 是否合理（可选，MVP 可简化）
5. 检查 blocking unknowns

**当前架构状态:**
- Orchestrator 通过 `sendSuggestion()` 发送 `Suggestion`（Format A 变体）
- ReplyPlan（Format C）尚未在 Orchestrator 中使用
- P1-6f 实现了 ContextEnvelopeIntegration（shadow mode），但不涉及 ReplyPlan

**关键决策:**
- D1: Verifier 是独立服务，不修改 Orchestrator 核心流程（MVP 阶段）
- D2: Verifier 通过事件机制与 Orchestrator 集成（非阻塞）
- D3: MVP 阶段 Verifier 只验证 IdentityLock 和 Fact 存在性，不验证新鲜度

---

### P2-8a: ReplyPlanVerifier Port 定义

**目标:** 定义 Verifier 的端口接口

**边界:**
- ✅ 定义 `ReplyPlanVerifierPort` 接口
- ✅ 定义 `VerificationResult` 类型
- ✅ 定义 `VerificationError` 类型
- ❌ 不实现具体验证逻辑（P2-8b 实现）
- ❌ 不修改 Orchestrator

**接口设计:**
```typescript
export interface ReplyPlanVerifierPort {
  verify(plan: ReplyPlan): Promise<VerificationResult>;
}

export interface VerificationResult {
  readonly ok: boolean;
  readonly plan_id: string;
  readonly errors: readonly VerificationError[];
  readonly warnings: readonly VerificationError[];
  readonly verified_at: string; // ISO 8601
}

export interface VerificationError {
  readonly error_id: string;
  readonly category: "identity_lock" | "fact_freshness" | "unknown_blocking" | "policy_violation";
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly blocking: boolean;
}
```

**文件:** `apps/desktop/src/main/ports/reply-plan-verifier-port.ts`（新建）

**工作量:** 0.5 天

**验收标准:**
- [ ] Port 接口定义完整
- [ ] 类型与 ReplyPlan Schema 一致
- [ ] typecheck 通过

**依赖:** P1-5（ReplyPlan TypeScript 类型）

---

### P2-8b: IdentityLock Verifier

**目标:** 实现 IdentityLock 验证逻辑（P2-9）

**边界:**
- ✅ 验证 IdentityLock 完整性（所有必需字段存在且非空）
- ✅ 验证 IdentityLock 与 ContextEnvelope 一致性
- ✅ 验证 customer_identity 有效性
- ❌ 不验证时间戳过期（MVP 简化）
- ❌ 不验证跨 shop 一致性（MVP 简化）

**验证规则:**
1. 所有必需字段（merchant_id, store_id, platform, platform_account_id, customer_identity, conversation_id, trigger_message_id）必须存在且非空
2. customer_identity.kind 必须是有效值（"customerUid" | "buyer_id" | "user_id"）
3. customer_identity.value 必须非空
4. platform 必须是有效 PlatformId

**文件:** `apps/desktop/src/main/services/identity-lock-verifier.ts`（新建）

**工作量:** 1 天

**验收标准:**
- [ ] 纯函数，无副作用
- [ ] 能正确验证完整的 IdentityLock
- [ ] 能正确拒绝不完整的 IdentityLock
- [ ] typecheck 通过

**依赖:** P2-8a

---

### P2-8c: Fact Freshness Verifier

**目标:** 实现 Fact 验证逻辑（P2-10）

**边界:**
- ✅ 验证 fact_references 中的 fact_id 在 authoritative_facts 中存在
- ✅ 验证 fact source 是有效值
- ✅ 标记 missing facts 为 error
- ❌ 不验证时间戳新鲜度（MVP 简化，Phase 9 实现）
- ❌ 不验证 value_snapshot 一致性（MVP 简化）

**验证规则:**
1. 每个 fact_reference.fact_id 必须在 authoritative_facts 中存在
2. fact_reference.source 必须是有效值（platform_api | merchant_config | store_knowledge | product_knowledge | order_system | logistics_system）
3. 如果 fact 缺失，标记为 error + blocking

**文件:** `apps/desktop/src/main/services/fact-freshness-verifier.ts`（新建）

**工作量:** 1 天

**验收标准:**
- [ ] 纯函数，无副作用
- [ ] 能正确验证 fact references
- [ ] 能正确标记 missing facts
- [ ] typecheck 通过

**依赖:** P2-8a

---

### P2-8d: ReplyPlanVerifier 主入口

**目标:** 组装所有验证器，实现 `verify()` 主入口

**边界:**
- ✅ 实现 `ReplyPlanVerifier` 类
- ✅ 调用 IdentityLock verifier
- ✅ 调用 Fact freshness verifier
- ✅ 检查 blocking unknowns
- ✅ 汇总验证结果
- ❌ 不修改 Orchestrator
- ❌ 不实现 Inference verifier（MVP 简化）

**验证流程:**
```typescript
async verify(plan: ReplyPlan): Promise<VerificationResult> {
  const errors: VerificationError[] = [];
  const warnings: VerificationError[] = [];
  
  // 1. Verify IdentityLock
  const identityResult = verifyIdentityLock(plan.identity_lock);
  if (!identityResult.ok) {
    errors.push(...identityResult.errors);
  }
  
  // 2. Verify Fact freshness
  const factResult = verifyFactFreshness(plan, envelope);
  if (!factResult.ok) {
    errors.push(...factResult.errors);
  }
  
  // 3. Check blocking unknowns
  const blockingUnknowns = plan.unknowns?.filter(u => u.blocking) ?? [];
  if (blockingUnknowns.length > 0) {
    errors.push({
      error_id: "blocking_unknowns",
      category: "unknown_blocking",
      severity: "error",
      message: `Plan has ${blockingUnknowns.length} blocking unknowns`,
      blocking: true,
    });
  }
  
  return {
    ok: errors.length === 0,
    plan_id: plan.plan_id,
    errors,
    warnings,
    verified_at: new Date().toISOString(),
  };
}
```

**文件:** `apps/desktop/src/main/services/reply-plan-verifier.ts`（新建）

**工作量:** 0.5 天

**验收标准:**
- [ ] 能正确验证完整 ReplyPlan
- [ ] 能正确汇总所有验证错误
- [ ] typecheck 通过

**依赖:** P2-8a, P2-8b, P2-8c

---

### P2-8e: Verifier 集成（Shadow Mode）

**目标:** 在 Main 进程中集成 Verifier（shadow mode）

**边界:**
- ✅ 创建 `ReplyPlanVerificationIntegration` 类
- ✅ 在 ContextEnvelopeIntegration 中调用 Verifier
- ✅ 发射验证事件（ReplyPlanVerified / ReplyPlanVerificationFailed）
- ❌ 不阻塞发送流程（MVP 阶段）
- ❌ 不修改 Orchestrator 核心流程

**集成策略:**
```typescript
// 在 ContextEnvelopeIntegration 中
async buildAndVerify(input: ContextEnvelopeBuildInput): Promise<void> {
  // 1. Build ContextEnvelope (existing)
  const envelope = await this.builder.build(input);
  
  // 2. Mock ReplyPlan (future: from Worker)
  const mockPlan = this.createMockReplyPlan(envelope);
  
  // 3. Verify ReplyPlan (shadow mode)
  const result = await this.verifier.verify(mockPlan);
  
  // 4. Emit events
  if (result.ok) {
    this.eventSink?.("ReplyPlanVerified", { plan_id: result.plan_id });
  } else {
    this.eventSink?.("ReplyPlanVerificationFailed", { 
      plan_id: result.plan_id, 
      errors: result.errors 
    });
  }
}
```

**文件:** `apps/desktop/src/main/services/reply-plan-verification-integration.ts`（新建）

**工作量:** 1 天

**验收标准:**
- [ ] Verifier 在 shadow mode 运行
- [ ] 事件正确发射
- [ ] 不影响现有流程
- [ ] typecheck 通过

**依赖:** P2-8d, P1-6f

---

## 二、P2-13: 集成测试规划

### 测试策略

**测试范围:**
1. Builder 单元测试（mock 所有依赖）
2. Verifier 单元测试（mock ReplyPlan）
3. Integration 集成测试（Builder + Verifier）
4. 端到端测试（Orchestrator + Builder + Verifier）

**测试文件:**
- `apps/desktop/src/main/services/__tests__/context-envelope-builder.test.ts`
- `apps/desktop/src/main/services/__tests__/reply-plan-verifier.test.ts`
- `apps/desktop/src/main/services/__tests__/context-envelope-integration.test.ts`

**测试场景:**

**Builder 测试:**
1. 正常流程：构建完整 ContextEnvelope
2. 缺失 facts：返回空 authoritative_facts
3. 缺失 knowledge：返回空 retrieved_knowledge
4. UNKNOWN 场景：正确识别 blocking unknown
5. SHIPPING_TIME 场景：正确识别 missing knowledge

**Verifier 测试:**
1. 正常流程：验证完整 ReplyPlan
2. 不完整 IdentityLock：返回 error
3. 缺失 fact reference：返回 error
4. Blocking unknown：返回 error
5. 多个错误：正确汇总

**Integration 测试:**
1. Builder + Verifier 正常流程
2. Builder 失败：不影响 Verifier
3. Verifier 失败：发射事件，不阻塞

**工作量:** 2 天

**验收标准:**
- [ ] 所有测试场景通过
- [ ] 测试覆盖率 > 80%
- [ ] typecheck 通过
- [ ] 测试在个人电脑（Node v22+）上运行

**依赖:** P2-8e

---

## 三、P2-14: 架构文档更新规划

### 文档更新范围

**需要更新的文档:**

1. **`docs/architecture/REPLY_PLAN_EVOLUTION.md`**
   - 添加 Phase 2 完成说明
   - 更新 Format C 实现状态
   - 说明 Builder 和 Verifier 架构

2. **`docs/architecture/AI_CUSTOMER_SERVICE_CORE.md`**
   - 添加 ContextEnvelope 构建流程
   - 说明 Builder 在核心流程中的位置

3. **`docs/architecture/REPLY_AND_ACTION_SAFETY.md`**
   - 添加 ReplyPlanVerifier 说明
   - 说明验证流程和安全机制

4. **新建 `docs/architecture/CONTEXT_ENVELOPE_BUILDER.md`**
   - Builder 设计文档
   - 依赖注入架构
   - 子组件说明

5. **新建 `docs/architecture/REPLY_PLAN_VERIFIER.md`**
   - Verifier 设计文档
   - 验证规则说明
   - 集成方式

**工作量:** 1 天

**验收标准:**
- [ ] 文档完整、准确
- [ ] 与实施一致
- [ ] 无歧义
- [ ] 包含架构图

**依赖:** P2-8e, P2-13

---

## 四、任务依赖图

```
P1-5 (TypeScript 类型) ✅
  │
  ├──→ P2-8a (Verifier Port) ──┐
  │                              │
  │                              ├──→ P2-8b (IdentityLock Verifier) ──┐
  │                              │                                      │
  │                              ├──→ P2-8c (Fact Verifier) ──────────┤
  │                              │                                      │
  │                              │                                      ↓
  │                              │                                P2-8d (Verifier 主入口)
  │                              │                                      │
  │                              │                                      ↓
  └──→ P1-6f (Integration 骨架) ──────────────────────────→ P2-8e (Verifier 集成)
                                                                        │
                                                                        ↓
                                                                  P2-13 (集成测试)
                                                                        │
                                                                        ↓
                                                                  P2-14 (文档更新)
```

---

## 五、执行计划

| 序号 | 子任务 | 工作量 | 累计 | 备注 |
|------|--------|--------|------|------|
| 1 | P2-8a: Verifier Port | 0.5 天 | 0.5 天 | 可并行 |
| 2 | P2-8b: IdentityLock Verifier | 1 天 | 1.5 天 | 依赖 P2-8a |
| 3 | P2-8c: Fact Verifier | 1 天 | 2.5 天 | 依赖 P2-8a，可与 P2-8b 并行 |
| 4 | P2-8d: Verifier 主入口 | 0.5 天 | 3 天 | 依赖 P2-8b/c |
| 5 | P2-8e: Verifier 集成 | 1 天 | 4 天 | 依赖 P2-8d + P1-6f |
| 6 | P2-13: 集成测试 | 2 天 | 6 天 | 依赖 P2-8e |
| 7 | P2-14: 文档更新 | 1 天 | 7 天 | 依赖 P2-8e + P2-13 |

**总计:** 7 天（原估算 8.5 天，优化后减少 1.5 天）

---

## 六、关键决策

### D1: Verifier 集成方式

**决策:** Verifier 在 Main 进程中以 shadow mode 集成，不修改 Orchestrator 核心流程

**原因:**
- Orchestrator 是共享包，不能依赖 apps/desktop
- MVP 阶段不需要阻塞发送
- Shadow mode 可以收集验证数据，为未来决策提供依据

### D2: MVP 验证范围

**决策:** MVP 只验证 IdentityLock 完整性和 Fact 存在性，不验证时间戳新鲜度

**原因:**
- 时间戳验证需要额外的基础设施（时钟同步、过期策略）
- MVP 阶段 Fact 都是实时检索的，新鲜度问题不大
- Phase 9 再实现完整的新鲜度验证

### D3: Mock ReplyPlan

**决策:** P2-8e 中使用 Mock ReplyPlan，不从 Worker 获取

**原因:**
- Worker 尚未实现 ReplyPlan 生成
- Mock ReplyPlan 可以验证 Verifier 逻辑
- 未来 Worker 实现 ReplyPlan 后，替换 Mock 即可

---

## 七、风险与缓解

### 风险 1: ReplyPlan Schema 变更

**风险:** ReplyPlan Schema 可能在后续任务中变更

**缓解:**
- Verifier 使用 Port 接口，与 Schema 解耦
- Schema 变更时，只需更新 Port 实现

### 风险 2: Orchestrator 集成复杂度

**风险:** 未来将 Verifier 集成到 Orchestrator 核心流程可能很复杂

**缓解:**
- MVP 阶段使用 shadow mode，不阻塞发送
- 收集验证数据，为未来决策提供依据
- 未来可以通过配置开关逐步启用阻塞模式

### 风险 3: 测试覆盖不足

**风险:** 集成测试可能无法覆盖所有场景

**缓解:**
- 明确测试场景清单
- 使用 mock 覆盖边界情况
- 测试覆盖率目标 > 80%

---

## 八、验收标准

### 整体验收

- [ ] P2-8/9/10 全部实现
- [ ] Verifier 在 shadow mode 运行正常
- [ ] 集成测试全部通过
- [ ] 架构文档更新完成
- [ ] typecheck 全部通过
- [ ] 测试在个人电脑上运行通过

### 子任务验收

每个子任务完成后需要：
- [ ] typecheck 通过
- [ ] 代码 review（Controller）
- [ ] 更新 task tracker

---

**文档版本:** v1.0
**创建日期:** 2026-09-29
**作者:** Codex (SHEEP-306 执行者)
