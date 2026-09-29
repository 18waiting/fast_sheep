# SHEEP-308 子任务 2 完成报告：定义 PolicyConfig 配置层次

**任务 ID:** SHEEP-308  
**子任务:** 2 - 定义 PolicyConfig 配置层次（TypeScript）  
**状态:** ✅ COMPLETE  
**日期:** 2026-09-29  
**工作量:** 0.5 天（计划）/ 实际完成

---

## 📋 目标

定义策略配置的层次结构，支持 GLOBAL -> SHOP -> SCENE 三级配置。

---

## ✅ 验收标准完成情况

| # | 验收标准 | 状态 | 证据 |
|---|---------|------|------|
| AC-2.1 | PolicyConfig 接口定义完整 | ✅ | `policy-config.ts:62-88` |
| AC-2.2 | 支持 global 默认配置 | ✅ | 第 71 行 `global: RolloutModeConfig` |
| AC-2.3 | 支持 shops 级别覆盖 | ✅ | 第 78 行 `shops?: Record<string, RolloutModeConfig>` |
| AC-2.4 | 支持 overrides 条件覆盖 | ✅ | `RolloutModeOverride` 接口（第 120-140 行） |
| AC-2.5 | 从 domain 包导出 | ✅ | `index.ts` 添加导出 |
| AC-2.6 | typecheck 通过 | ✅ | `pnpm run typecheck` 通过 |

---

## 🔧 实现详情

### 文件：`packages/domain/src/policy-config.ts`

**核心接口：**

1. **PolicyConfig**
   - 配置层次结构
   - global: 全局默认配置（必需）
   - shops: 店铺级覆盖（可选）
   - scenes: 场景级覆盖（可选，MVP DEFERRED）

2. **RolloutModeConfig**
   - 特定作用域的配置
   - default_mode: 默认 RolloutMode（必需）
   - overrides: 条件覆盖列表（可选）

3. **RolloutModeOverride**
   - 条件覆盖规则
   - condition: 匹配条件（必需）
   - mode: 匹配时使用的 RolloutMode（必需）
   - reason: 覆盖原因说明（必需）

4. **OverrideCondition**
   - 覆盖匹配条件
   - scene: 场景名称（可选，MVP DEFERRED）
   - risk_level: 风险等级（可选）
   - has_blocking_unknowns: 是否有阻塞 unknowns（可选）

**辅助函数：**

1. **createSimplePolicyConfig(defaultMode)**
   - 创建仅包含全局默认配置的简单配置
   - 用于不需要店铺级覆盖的场景

2. **createShopPolicyConfig(globalDefault, shopConfigs)**
   - 创建包含店铺级覆盖的配置
   - 用于不同店铺需要不同配置的场景

---

## 📊 影响范围

### 新增的文件
1. `packages/domain/src/policy-config.ts`

### 修改的文件
1. `packages/domain/src/index.ts` — 添加导出

### 依赖关系
- **依赖：** `context-envelope.ts`（复用 RolloutMode 类型）
- **被依赖：** 子任务 3（RolloutModeResolver）、子任务 4（PolicyEngine）

---

## 🔗 设计决策

### 1. MVP 简化
- **决策：** 只实现 GLOBAL 和 SHOP 两级
- **原因：** SCENE 级别增加复杂性，MVP 不需要
- **状态：** CONFIRMED

### 2. 条件覆盖使用 AND 逻辑
- **决策：** OverrideCondition 中所有指定字段必须匹配
- **原因：** 简单、可预测、易于理解
- **状态：** CONFIRMED

### 3. 第一个匹配的覆盖生效
- **决策：** overrides 数组按顺序评估，第一个匹配的胜利
- **原因：** 简单、可预测
- **状态：** CONFIRMED

### 4. 提供辅助函数
- **决策：** 提供 createSimplePolicyConfig 和 createShopPolicyConfig
- **原因：** 简化常见配置场景
- **状态：** CONFIRMED

---

## ⚠️ 风险和注意事项

### 1. SCENE 级别 DEFERRED
- **风险：** 未来添加 SCENE 级别需要修改接口
- **缓解：** 接口已预留 scenes 字段，向后兼容
- **状态：** CONFIRMED

### 2. 配置复杂性
- **风险：** 多级配置可能导致复杂性爆炸
- **缓解：** MVP 只实现两级，文档清晰
- **状态：** CONFIRMED

### 3. 配置验证
- **风险：** 无效配置可能导致意外行为
- **缓解：** 未来可添加配置验证器
- **状态：** CONFIRMED

---

## 📝 下一步工作

### 子任务 3：实现 RolloutModeResolver
- **目标：** 根据配置层次和当前上下文解析应该使用的 RolloutMode
- **文件：** `apps/desktop/src/main/services/rollout-mode-resolver.ts`
- **工作量：** 1 天

---

## ✅ 完成声明

**子任务 2 状态：** COMPLETE

**验证结果：**
- ✅ 所有验收标准满足
- ✅ typecheck 通过
- ✅ 类型定义完整
- ✅ 辅助函数可用
- ✅ 文档完整

**下一步：** 子任务 3 - 实现 RolloutModeResolver

---

**报告生成时间：** 2026-09-29  
**报告生成人：** Codex  
**审核状态：** 待 Controller 审核
