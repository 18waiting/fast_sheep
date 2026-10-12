# 交接文档：SHEEP-312 完成 → SHEEP-313 规划

**创建日期:** 2026-09-30  
**交接场景:** 从 macOS 开发环境迁移到 Windows 开发环境  
**目的:** 确保上下文不丢失，可以在新机器上无缝继续开发

---

## 📍 当前项目状态

### ✅ 已完成的任务链

```
SHEEP-305 (地基) → SHEEP-306 (框架) → SHEEP-307 (RPC)
    ↓
SHEEP-308 (消息收发) → SHEEP-309 (审计日志)
    ↓
SHEEP-310 (发送失败分类) → SHEEP-311 (人工确认)
    ↓
SHEEP-312 (安全审计) ✅ 刚刚完成
```

### 🎯 项目整体进度

- **当前里程碑:** MVP-D AUTO (安全执行层) ✅ 已完成
- **下一个里程碑:** MVP-E MULTI_SHOP_EXPANSION (多店铺扩展)
- **下一个任务:** SHEEP-313 (多店铺隔离验证) - 已规划，待执行

---

## 🔥 关键上下文（必须知道）

### 1. 环境差异

| 项目 | macOS (当前) | Windows (目标) |
|------|-------------|---------------|
| **路径** | `/Users/wb02605050/Documents/ChatGPT/fast_sheep` | `E:\fast_sheep` |
| **Node.js** | v20 (Homebrew) | v22+ (需要安装) |
| **测试能力** | ❌ 不能运行单元测试 | ✅ 可以运行单元测试 |
| **验证标准** | `pnpm run typecheck` | `pnpm run test` |

**重要:** 
- macOS 上只能用 typecheck 验证代码正确性
- Windows 上可以运行完整测试
- 所有标记为 `DEFERRED: 需要在个人电脑上运行` 的测试，到了 Windows 机器上都要跑一遍

### 2. SHEEP-312 刚完成的工作

**核心成果:**
- ✅ 修复了 7 个 bug（包括 2 个 HIGH 级别）
- ✅ 记录了 3 个已知风险
- ✅ 完成了 36 个对抗性测试
- ✅ typecheck 全部通过

**关键文件:**
- `packages/orchestrator/src/core/human-confirm-controller.ts` - 人工确认控制器
- `packages/orchestrator/tests/auto-safety-adversarial.test.ts` - 对抗性测试
- `packages/domain/tests/audit-correlation.test.ts` - 审计链测试
- `project/SHEEP_312_CODE_REVIEW_REPORT.md` - 代码审查报告

**已知风险（已记录，不阻塞）:**
1. `confirm()` 对过期请求返回两种不同消息（LOW）
2. `isAuditComplete()` 不检查 `confirmation` 字段（INFO，SHEEP-311 遗留）
3. `tests/` 不在 tsconfig include 中（LOW，架构决策）

### 3. SHEEP-313 规划要点

**目标:** 证明多店铺隔离性不是推断出来的，而是验证过的

**8 项退出标准:**
1. EC-1: 并发运行隔离
2. EC-2: 会话/客户隔离
3. EC-3: 知识/RAG 隔离
4. EC-4: 发送隔离
5. EC-5: 审计/交接隔离
6. EC-6: 故障/恢复隔离
7. EC-7: 配置隔离
8. EC-8: 跨商户对抗测试

**执行计划:** 7 个子任务，预计 7 天
- 子任务 1: 隔离机制审计（0.5 天）
- 子任务 2: 测试基础设施（0.5 天）
- 子任务 3-6: 各项隔离测试（各 1-1.5 天）
- 子任务 7: 任务报告（0.5 天）

**关键文档:**
- `project/SHEEP_313_TASK_DEFINITION.md` - 任务定义
- `project/SHEEP_313_EXECUTION_PLAN.md` - 执行计划

---

## 🚀 在新机器上的操作步骤

### Step 1: 拉取最新代码

```bash
cd E:\fast_sheep
git pull origin main
```

### Step 2: 验证环境

```bash
# 检查 Node.js 版本
node --version  # 应该是 v22+

# 检查依赖
pnpm install

# 运行 typecheck
pnpm run typecheck
```

### Step 3: 运行之前 DEFERRED 的测试

```bash
# 运行所有测试
pnpm run test

# 特别关注这些测试文件：
# - packages/orchestrator/tests/auto-safety-adversarial.test.ts
# - packages/domain/tests/audit-correlation.test.ts
# - packages/orchestrator/tests/multi-shop-*.test.ts (SHEEP-313 会创建)
```

### Step 4: 开始 SHEEP-313

```bash
# 阅读任务定义
cat project/SHEEP_313_TASK_DEFINITION.md

# 阅读执行计划
cat project/SHEEP_313_EXECUTION_PLAN.md

# 开始子任务 1：隔离机制审计
# 告诉 Codex: "开始执行 SHEEP-313 子任务 1"
```

---

## ⚠️ 容易丢失的上下文

### 1. 开发习惯

- **先 typecheck，再测试** - 这是项目的工作流
- **测试标记 DEFERRED** - 在 macOS 上不能跑的测试要标记
- **每个任务都要有验收标准** - 不能模糊完成

### 2. 关键决策

- **SHEEP-313 使用模拟数据** - 不需要真实店铺
- **隔离验证 ≠ 性能验证** - 只验证隔离机制，不验证性能
- **不修改现有架构** - 只验证，不重构

### 3. 项目约定

- **所有文档放在 `project/` 目录**
- **测试文件放在对应包的 `tests/` 目录**
- **任务报告必须包含 8 项退出标准的验证结果**

---

## 📞 如果遇到问题

### 问题 1: 测试跑不起来

**检查:**
- Node.js 版本是否 v22+
- 是否运行了 `pnpm install`
- 是否有 `--experimental-strip-types` 支持

### 问题 2: 上下文不清楚

**查看:**
- `project/PROJECT_STATE.json` - 当前项目状态
- `project/FAST_SHEEP_CODING_ROADMAP_V1.1_REVIEWED.md` - 整体路线图
- `project/HANDOFF_SHEEP_312_TO_313.md` - 本文档

### 问题 3: 不知道下一步做什么

**答案:** 开始 SHEEP-313 子任务 1（隔离机制审计）

---

## ✅ 交接检查清单

在离开当前机器前，确认：

- [ ] 所有更改已 commit
- [ ] 已 push 到远程仓库
- [ ] 本文档已创建并提交
- [ ] 新机器上已安装 Node.js v22+
- [ ] 新机器上已安装 pnpm

到达新机器后，确认：

- [ ] `git pull` 成功
- [ ] `pnpm install` 成功
- [ ] `pnpm run typecheck` 通过
- [ ] `pnpm run test` 通过（至少核心测试）
- [ ] 可以开始 SHEEP-313 子任务 1

---

**最后提醒:** 新机器上的 Codex 实例会读取 `AGENTS.md` 和 `project/` 目录的文档，所以只要文档完整，上下文就不会丢失。关键是确保所有规划文档都已提交。

祝开发顺利！🚀
