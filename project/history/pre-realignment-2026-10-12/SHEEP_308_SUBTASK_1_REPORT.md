# SHEEP-308 子任务 1 完成报告：定义 PolicyDecision 类型

**任务 ID:** SHEEP-308  
**子任务:** 1 - 定义 PolicyDecision 类型（TypeScript）  
**状态:** ✅ COMPLETE  
**日期:** 2026-09-29  
**工作量:** 0.5 天（计划）/ 实际完成

---

## 📋 目标

定义类型化的策略决策结果，明确表达 policy 评估的输出。

---

## ✅ 验收标准完成情况

| # | 验收标准 | 状态 | 证据 |
|---|---------|------|------|
| AC-1.1 | PolicyDecision 接口定义完整 | ✅ | `policy-decision.ts:54-100` |
| AC-1.2 | 包含 allowed, rollout_mode, requires_confirmation | ✅ | 第 63, 71, 77 行 |
| AC-1.3 | 包含 reasons, warnings, blocking_issues | ✅ | 第 84, 91, 98 行 |
| AC-1.4 | 包含评估元数据（evaluated_at, policy_version） | ✅ | 第 105, 112 行 |
| AC-1.5 | 从 domain 包导出 | ✅ | `index.ts` 添加导出 |
| AC-1.6 | typecheck 通过 | ✅ | `pnpm run typecheck` 通过 |

---

## 🔧 实现详情

### 文件：`packages/domain/src/policy-decision.ts`

**核心接口：** `PolicyDecision`

**字段说明：**

1. **allowed** (boolean)
   - 是否允许执行 ReplyPlan
   - 当 blocking_issues 非空时必须为 false

2. **rollout_mode** (RolloutMode)
   - OFF: 不执行 AI 回复
   - SHADOW: 生成回复但不发送（审计/测试）
   - HUMAN_CONFIRM: 需要人工确认
   - AUTO: 可自动执行（MVP 未授权）

3. **requires_confirmation** (boolean)
   - 是否需要人工确认
   - 当 rollout_mode 为 HUMAN_CONFIRM 时为 true

4. **confirmation_reason** (string, 可选)
   - 确认要求的原因说明

5. **reasons** (readonly string[])
   - 支持此决策的原因列表
   - 信息性，不影响执行

6. **warnings** (readonly string[])
   - 评估过程中检测到的警告
   - 记录日志但不阻止执行

7. **blocking_issues** (readonly string[])
   - 阻止执行的阻塞问题列表
   - 非空时 allowed 必须为 false

8. **evaluated_at** (string)
   - ISO 8601 时间戳，评估时间

9. **policy_version** (string)
   - 策略配置版本号，用于审计

**辅助函数：**

1. **createBlockedDecision()**
   - 创建阻止执行的决策
   - 自动设置 allowed=false, rollout_mode="OFF"
   - 用于评估失败场景

2. **createModeDecision()**
   - 创建指定模式的决策
   - 自动设置 requires_confirmation（HUMAN_CONFIRM 时为 true）
   - 用于评估成功场景

---

## 📊 影响范围

### 新增的文件
1. `packages/domain/src/policy-decision.ts`

### 修改的文件
1. `packages/domain/src/index.ts` — 添加导出

### 依赖关系
- **依赖：** `context-envelope.ts`（复用 RolloutMode 类型）
- **被依赖：** 子任务 3（RolloutModeResolver）、子任务 4（PolicyEngine）

---

## 🔗 设计决策

### 1. 复用 RolloutMode 类型
- **决策：** 从 `context-envelope.ts` 导入 RolloutMode
- **原因：** 避免重复定义，保持类型一致性
- **状态：** CONFIRMED

### 2. 使用 readonly 数组
- **决策：** reasons/warnings/blocking_issues 使用 readonly string[]
- **原因：** 不可变性，防止意外修改
- **状态：** CONFIRMED

### 3. 提供辅助函数
- **决策：** 提供 createBlockedDecision 和 createModeDecision
- **原因：** 简化常见场景的决策创建
- **状态：** CONFIRMED

### 4. 包含评估元数据
- **决策：** 包含 evaluated_at 和 policy_version
- **原因：** 支持审计和可追溯性
- **状态：** CONFIRMED

---

## ⚠️ 风险和注意事项

### 1. 向后兼容
- **风险：** 新增类型不影响现有代码
- **缓解：** 纯新增，无修改现有类型
- **状态：** CONFIRMED

### 2. 类型安全
- **风险：** RolloutMode 类型必须与 context-envelope.ts 一致
- **缓解：** 使用 import type 确保一致性
- **状态：** CONFIRMED

---

## 📝 下一步工作

### 子任务 2：定义 PolicyConfig 配置层次
- **目标：** 定义策略配置的层次结构
- **文件：** `packages/domain/src/policy-config.ts`
- **工作量：** 0.5 天

---

## ✅ 完成声明

**子任务 1 状态：** COMPLETE

**验证结果：**
- ✅ 所有验收标准满足
- ✅ typecheck 通过
- ✅ 类型定义完整
- ✅ 辅助函数可用
- ✅ 文档完整

**下一步：** 子任务 2 - 定义 PolicyConfig 配置层次

---

**报告生成时间：** 2026-09-29  
**报告生成人：** Codex  
**审核状态：** 待 Controller 审核
