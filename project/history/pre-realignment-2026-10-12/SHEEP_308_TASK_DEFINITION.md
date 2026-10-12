# SHEEP-308 任务定义：Deterministic Policy and RolloutMode Gate

**任务 ID:** SHEEP-308  
**状态:** NOT_STARTED  
**优先级:** P1  
**依赖:** SHEEP-307 ✅  
**工作量估算:** 5-7 天  
**日期:** 2026-09-29

---

## 一、任务目标

实现确定性的策略评估和 RolloutMode 解析，支持 OFF、SHADOW、HUMAN_CONFIRM、AUTO 四种模式，确保 AI 输出不能直接执行，必须经过策略评估和授权。

---

## 二、治理依据

- **Master §5:** AI output must be structured and governed
- **REPLY_AND_ACTION_SAFETY:** Deterministic policy decision is required before execution
- **PDD_MVP_V1.md §3:** RolloutMode definitions (OFF, SHADOW, HUMAN_CONFIRM, AUTO)
- **Roadmap V1.1 SHEEP-308:** Policy engine, mode resolution, typed decisions

---

## 三、核心要求

### 3.1 Policy 评估要素

Policy Engine 必须评估以下要素：

1. **IdentityLock** - 身份锁定验证
   - 所有必需字段存在且有效
   - 平台、商家、店铺、客户身份一致
   - 无跨店/跨账号执行

2. **Scope** - 作用域验证
   - 商家/店铺/平台作用域匹配
   - 会话作用域有效

3. **Facts** - 事实验证
   - 权威事实存在且新鲜
   - 无矛盾事实
   - 无阻塞性 unknown

4. **Capability** - 能力检查
   - 商家是否启用 AI 功能
   - 是否有足够的配额/权限

5. **Entitlement** - 授权检查
   - 功能是否已订阅
   - 是否在有效期内

6. **Risk** - 风险评估
   - 场景风险等级
   - 事实置信度
   - 推理置信度

7. **Side-effect class** - 副作用分类
   - 回复类（低风险）
   - 操作类（高风险，MVP 不实现）

8. **Session health** - 会话健康
   - 会话是否活跃
   - 是否超时
   - 是否被取消

### 3.2 RolloutMode 解析

根据评估结果解析 RolloutMode：

| RolloutMode | 条件 | 行为 |
|-------------|------|------|
| **OFF** | 功能未启用或明确关闭 | 不生成 AI 回复 |
| **SHADOW** | 测试/审计模式 | 生成 ReplyPlan 但不发送 |
| **HUMAN_CONFIRM** | 默认安全模式 | 生成 ReplyPlan，需要人工确认 |
| **AUTO** | 能力已授权且所有验证通过 | 可以自动发送（MVP 不授权） |

### 3.3 配置层次

支持三级配置：

```
GLOBAL (全局默认)
  ↓
SHOP (店铺级覆盖)
  ↓
SCENE (场景级覆盖)
```

优先级：SCENE > SHOP > GLOBAL

---

## 四、当前状态（AS-IS）

### 已有基础

1. **ReplyPlanVerifier** (SHEEP-306 ✅)
   - IdentityLock 验证
   - Fact 引用验证
   - Blocking unknown 检测

2. **ContextEnvelope + ReplyPlan** (SHEEP-306/307 ✅)
   - 结构化输入/输出
   - policy_metadata 字段（当前硬编码为 HUMAN_CONFIRM）

3. **Entitlement/Capability** (已有类型定义)
   - `packages/domain/src/entitlement.ts`
   - `packages/domain/src/authorization-domain.ts`

### 缺失组件

1. ❌ **Policy Engine** - 核心策略引擎
2. ❌ **RolloutMode Resolver** - 模式解析器
3. ❌ **Configuration Hierarchy** - 配置层次
4. ❌ **Policy Decision** - 类型化决策结果
5. ❌ **Integration** - 集成到现有流程

---

## 五、目标状态（TO-BE）

### 架构流程

```
ContextEnvelope
  ↓
PolicyEngine.evaluate(envelope, reply_plan, config)
  ↓
PolicyDecision {
  rollout_mode: RolloutMode,
  allowed: boolean,
  requires_confirmation: boolean,
  reasons: string[],
  warnings: string[],
  blocking_issues: string[]
}
  ↓
根据 rollout_mode 执行：
  - OFF: 不生成回复
  - SHADOW: 生成回复，记录审计，不发送
  - HUMAN_CONFIRM: 生成回复，等待人工确认
  - AUTO: 生成回复，自动发送（MVP 不授权）
```

### 核心组件

1. **PolicyEngine** (TypeScript)
   - 位置：`apps/desktop/src/main/services/policy-engine.ts`
   - 职责：评估所有条件，返回 PolicyDecision

2. **RolloutModeResolver** (TypeScript)
   - 位置：`apps/desktop/src/main/services/rollout-mode-resolver.ts`
   - 职责：根据配置和评估结果解析 RolloutMode

3. **PolicyConfig** (TypeScript)
   - 位置：`packages/domain/src/policy-config.ts`
   - 职责：定义配置层次和默认值

4. **PolicyDecision** (TypeScript)
   - 位置：`packages/domain/src/policy-decision.ts`
   - 职责：类型化决策结果

---

## 六、允许范围（Allowed Scope）

### ✅ 允许
- Policy engine 实现
- RolloutMode resolution 实现
- Typed decisions 定义
- Configuration hierarchy 实现
- Focused negative tests
- 集成到现有流程（替换硬编码的 HUMAN_CONFIRM）

### ❌ 禁止
- 授权 AUTO 模式（MVP 不实现）
- 发送消息
- 授予生产执行权限
- 实现 ActionPlan（未来扩展）

---

## 七、退出标准（Exit Criteria）

- [ ] Policy 评估 IdentityLock、scope、facts、capability、entitlement、risk、side-effect class、session health
- [ ] `SHADOW` 不能调用 transport
- [ ] `HUMAN_CONFIRM` 需要确认
- [ ] `AUTO` 保持 capability-gated 且外部未授权
- [ ] AI confidence 不能满足授权
- [ ] Typecheck 通过
- [ ] 单元测试通过（DEFERRED: 需在个人电脑运行）

---

## 八、客户价值

**Customer value:** 安全的可配置 rollout 行为  
**Safety value:** 确定性的执行授权

---

## 九、风险和缓解

### 风险 1：配置复杂性
- **风险：** 三级配置可能导致复杂性爆炸
- **缓解：** MVP 只实现 GLOBAL 和 SHOP 级别，SCENE 级别 DEFERRED
- **状态：** CONFIRMED

### 风险 2：向后兼容
- **风险：** 现有代码硬编码 HUMAN_CONFIRM
- **缓解：** 渐进式迁移，先实现 PolicyEngine，再替换硬编码
- **状态：** CONFIRMED

### 风险 3：AUTO 模式诱惑
- **风险：** 可能过早授权 AUTO 模式
- **缓解：** 明确禁止，MVP 只实现 OFF/SHADOW/HUMAN_CONFIRM
- **状态：** CONFIRMED

---

**文档版本:** v1.0  
**创建日期:** 2026-09-29  
**创建人:** Codex  
**审核状态:** 待 Controller 审核
