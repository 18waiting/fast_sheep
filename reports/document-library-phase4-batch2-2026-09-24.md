# 文档库第四阶段第二批：已证明冗余材料的逐批清理（2026-09-24）

> 本报告是仓库维护记录，不是产品/架构/任务状态权威，也不替代 `project/PROJECT_STATE.json`。本批仅处理已满足删除条件的材料：无现行权威职责、引用已处理、恢复路径明确、隐私/许可/发布影响已审查。每批独立验收，不批量删除。Controller `PASS/REPAIR = NOT_RUN`，`next_stage_not_executed = true`。

## 删除条件

候选必须同时满足：
1. 无现行权威/Owner 决策/验收溯源职责
2. 引用已处理（仓库内无静态引用或引用已更新）
3. 恢复路径明确（Git 历史可恢复）
4. 隐私/许可/发布影响已审查

## 候选审查

### 1. `建议`（9,769 bytes，根目录）

| 条件 | 状态 | 证据 |
|---|---|---|
| 无现行权威职责 | ✅ CONFIRMED | 早期沟通稿；`README.md` 明确标注"二者均不是当前规则或执行授权" |
| 引用已处理 | ✅ CONFIRMED | CSV 静态引用 0；`PROJECT_STATE.json` 无文件路径引用（仅一处"使用建议"为中文普通词组，非文件引用）；无任何 JSON 文件引用 |
| 恢复路径明确 | ✅ CONFIRMED | Git 历史可完整恢复 |
| 隐私/许可/发布影响 | ✅ CONFIRMED | 产品方向建议对话，无敏感数据 |

### 2. `reports/cleanup-dedup-2026-09-23.md`（3,787 bytes）

| 条件 | 状态 | 证据 |
|---|---|---|
| 无现行权威职责 | ✅ CONFIRMED | 早期去重维护报告，非权威 |
| 引用已处理 | ✅ CONFIRMED | 仓库内无任何引用（CSV 静态引用 0，全库搜索 0） |
| 恢复路径明确 | ✅ CONFIRMED | 未跟踪文件，已从工作树删除；内容记录在 `cleanup-2026-09-23.md` 中 |
| 隐私/许可/发布影响 | ✅ CONFIRMED | 纯维护记录，无敏感数据 |

### 3. `reports/m12-migration-matrix-report.json`（361 bytes）

| 条件 | 状态 | 证据 |
|---|---|---|
| 无现行权威职责 | ✅ CONFIRMED | M12 schema migration smoke test 结果，非权威 |
| 引用已处理 | ✅ CONFIRMED | 仓库内无文件路径引用；`package.json` 脚本定义指向脚本文件，非此报告 |
| 恢复路径明确 | ✅ CONFIRMED | Git 历史可完整恢复 |
| 隐私/许可/发布影响 | ✅ CONFIRMED | 纯测试结果 JSON，无敏感数据 |

### 4. `reports/m12-profile-smoke-report.json`（104 bytes）

| 条件 | 状态 | 证据 |
|---|---|---|
| 无现行权威职责 | ✅ CONFIRMED | M12 profile smoke test 结果，非权威 |
| 引用已处理 | ✅ CONFIRMED | 仓库内无任何引用 |
| 恢复路径明确 | ✅ CONFIRMED | Git 历史可完整恢复 |
| 隐私/许可/发布影响 | ✅ CONFIRMED | 纯测试结果 JSON，无敏感数据 |

### 5. `reports/m6-electron-smoke-report.json`（449 bytes）

| 条件 | 状态 | 证据 |
|---|---|---|
| 无现行权威职责 | ✅ CONFIRMED | M6 Electron smoke test 结果，非权威 |
| 引用已处理 | ✅ CONFIRMED | 仓库内无文件路径引用；`package.json` 脚本定义指向脚本文件；SHEEP-029/035/045 报告中提及测试名称为叙述性文字，非文件路径引用 |
| 恢复路径明确 | ✅ CONFIRMED | Git 历史可完整恢复 |
| 隐私/许可/发布影响 | ✅ CONFIRMED | 纯测试结果 JSON，无敏感数据 |

### 6-8. 三个 platform 清理报告（未跟踪文件，已从工作树删除）

| 文件 | 字节 | 引用 | 状态 |
|---|---|---|---|
| `reports/platform-fallback-and-secret-scan-gate-2026-09-23.md` | 5,718 | 0 | ✅ CONFIRMED 全部 4 条件 |
| `reports/platform-native-view-gate-2026-09-23.md` | 5,406 | 0 | ✅ CONFIRMED 全部 4 条件 |
| `reports/platform-shop-queue-identity-cleanup-2026-09-23.md` | 4,686 | 0 | ✅ CONFIRMED 全部 4 条件 |

三者均为 2026-09-23 平台清理验证报告，非权威、无引用、未跟踪（不在 Git 历史中，删除即永久移除，但内容价值低——仅为一次性验证记录）。

## 操作记录

- **操作前暂存哈希**：`7e679ce7aad351486ebdbdf6ead0bb44fe3724a9d46459d138a0f1d35cae1444`
- **操作**：
  - 工作树删除 8 个文件（`rm`）
  - `git rm --cached` 暂存 5 个已跟踪文件的删除：`建议`、`reports/cleanup-dedup-2026-09-23.md`、`reports/m12-migration-matrix-report.json`、`reports/m12-profile-smoke-report.json`、`reports/m6-electron-smoke-report.json`
  - 3 个未跟踪文件（platform 报告）仅从工作树删除，无暂存操作
- **操作后暂存哈希**：`99ebcf6b3194e71c85be6e890b17d072d2c4b7b8ba222cf8c031340615d72fc0`
- **当前暂存状态**：29 项（25 项原有 + 4 项新暂存删除：`ecommerce-ai-architecture.zip` + `建议` + 3 个 smoke test JSON）

## 验收结果

- `node scripts/validate-project-state.mjs`：**PASS**
- `node --test tests/project-state-consistency.test.mjs`：**20/20 PASS**
- `pnpm run check:boundary`：**PASS**
- `pnpm run scan:secrets`：**PASS**（0 unreviewed、6 exact reviewed）
- `git diff --check` 和 `git diff --cached --check`：**PASS**
- 删除后引用检查：**PASS**（无断链；`package.json` 脚本定义指向脚本文件，SHEEP 报告叙述性提及非文件路径引用）

## 结论

- **CONFIRMED**：8 个文件已从工作树移除；5 个已跟踪文件的删除已暂存，3 个未跟踪文件直接删除。所有验证通过，无断链。
- **INFERRED**：此操作不影响任何现行权威、任务状态或运行时代码；仅清理无引用的历史维护/测试记录。
- **BLOCKED / NOT_AUTHORIZED**：提交和推送未执行；需另行授权。
- **DEFERRED**：第四阶段后续批次（其他候选）需逐件审查。

## 暂存区当前状态

- 原有 25 项（19 项派生包 + 6 份导航/审计报告）
- Batch 1：`ecommerce-ai-architecture.zip` 删除
- Batch 2：`建议`、`reports/cleanup-dedup-2026-09-23.md`、`reports/m12-migration-matrix-report.json`、`reports/m12-profile-smoke-report.json`、`reports/m6-electron-smoke-report.json` 删除
- 总计 29 项暂存

## 后续

第四阶段第二批完成，全局清理仍 `PARTIAL`。后续批次需逐件审查候选。阶段五最终交接未执行。
