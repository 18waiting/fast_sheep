# 文档库清理计划与第一阶段清单（2026-09-23）

> Owner 请求的仓库维护记录，**不是**产品/架构/任务状态权威，也不替代 `project/PROJECT_STATE.json`、V1.1 Roadmap、V1.1 Task Template。历史 Windows 根路径在本机对应当前仓库。此轮只做盘点，**未移动、删除、修改既有文档或更改暂存区**。全局清理结果 `PARTIAL`；阶段一清单 `COMPLETE`（静态边界内）；Controller `PASS/REPAIR`：`NOT_RUN`；`next_stage_not_executed = true`。

## 范围与不变量

- 本计划覆盖根目录文档/已移除的归档，以及 `docs/`、`project/`、`reports/` 当前 Git 索引和未忽略的工作树文件。逐件清单：[document-library-inventory-2026-09-23.csv](document-library-inventory-2026-09-23.csv)。CSV 的 `role` 是**清理工作分类**，不是新的权威等级；`suggested_next_action` 不是删除许可。`static_reference_count` 只含文档库内的原样仓库路径或可解析 Markdown 相对链接，可能漏掉 Windows 转义路径、简称、代码/外部消费者和动态引用。
- 不修改代码、平台会话、证据原文或项目授权；不运行历史报告内的生成器。既有 25 个暂存条目保持原样，不执行 `git add -A`、commit、push 或历史重写。
- `project/PROJECT_STATE.json` 当前：最后关闭 `SHEEP-304`，`SHEEP-305` 整体未关闭、下一任务未获执行授权，live evidence `PAUSED / NOT_AUTHORIZED`，`next_stage_not_executed = true`。文档归档/删除不能改变它。

## 执行计划（小批次、每一阶段单独验收）

1. **建立清单与引用关系 — 本轮完成。** 记录路径、用途候选、索引/暂存/工作树状态、静态引用和精确字节重复；标出待人工判断的来源、隐私与决策记录。验收：候选覆盖本次范围、已暂存和本机忽略原件分开计数、无删除。
2. **消除误导性入口 — 待下一轮。** 优先核查未 reviewed 的旧 Roadmap/模板、根目录建议与历史 UI 资料的引用、Owner 采纳关系和现行 V1.1 路径。按证据选择**醒目标注历史性质／入口导航调整／经批准归档**，而非先删。保留不可替代的 reviewed V1.0 历史治理和 Owner 决策记录。每批要保证 README/AGENTS/PROJECT_STATE 指向唯一现行权威。
3. **独立审查证据包 — 2026-09-24 有限静态审查已执行，发布就绪仍 PARTIAL。** 对当前 25 个暂存条目核对 17 个派生组件、清单哈希、链接、敏感信息边界及历史原件的本机保留/恢复策略；不得将派生件误作原始事实。确认公开仓库发布边界前不提交；旧 Git 历史内容不因本地删除而抹除。
4. **仅对已证明冗余者逐批清理 — 待阶段 2/3 通过。** 候选须同时满足：无现行权威/Owner 决策/验收溯源职责，引用已处理，恢复路径明确，隐私/许可和发布影响已审查。每批独立 `git diff` + 引用/链接 + 状态验证；不按文件名“旧”或零引用批量删除。
5. **验收与交接 — 待实施后。** 核验当前入口、相对链接、状态一致性、暂存/未暂存差异、敏感值扫描及必要测试；提交“已删／保留历史／待决定”表和未执行项。Controller review 不由 Codex 自报完成代替。

## 第一阶段事实快照

- **CONFIRMED：**本次静态范围 245 项：`docs/` 63、`project/` 13、`reports/` 164、根目录 5；其中 1 项 `ecommerce-ai-architecture.zip` 已在工作树移除但删除尚未暂存，故当前存在文件 244 项。`reports/` 的 164 项包含 5 份先前未跟踪的平台清理报告。本轮新建计划及 CSV **不计入该基线**。
- **CONFIRMED：**现有暂存区 25 项（6 份导航/审计/清理报告 + 19 项脱敏派生包）；先前 3 个原始历史证据目录中另有 **17 个本机忽略原件**，未纳入上述 245 项，也不得因 `git status` 看不到它们就认定不存在。公开派生包与本机原件是不同副本。
- **CONFIRMED：**可读取的工作树文档之间无**字节完全相同**的组；这是精确哈希层面的结果，不排除内容近似、版本重复或与本机忽略原件相同。此前两个根目录建议稿的去重已转为历史脱敏派生方案，不能把当前“无字节重复”理解为全部资料清洁完成。
- **CONFIRMED（静态检查）：**本次范围内 82 个可解析的本地 Markdown 链接目标均存在；未检查运行时动态引用、所有 JSON 字符串语义、外部链接、Git 历史及非文档目录引用。反向引用为辅助证据，不是删除证明。

## 首批审查队列：不是删除清单

| 材料 | 静态事实与风险 | 下一步处置 |
|---|---|---|
| `project/FAST_SHEEP_CODING_ROADMAP.md` 与 `project/FAST_SHEEP_CODEX_TASK_TEMPLATE.md` | **CONFIRMED** 非现行 V1.1 权威；旧 Roadmap 有“正式编码尚未开始”等当时表述；分别被历史 reviewed 文件/旧草稿引用。 | 检查历史溯源和不可变性要求，先考虑历史标签/导航隔离，不直接删。 |
| `快羊开发建议书.md` | **CONFIRMED** `project/FAST_SHEEP_DEVELOPMENT_OPERATING_MODEL.md` 明确以 Owner 2026-09-18 建议书为采纳来源；该引用使用文档标题而非精确文件路径。 | **保留来源证据**；核查是否需在根目录加非权威/历史提示或在入口指向现行操作模型。 |
| `建议` | **CONFIRMED** 根目录旧建议文本，无可解析的精确路径链接；含当时产品/流程判断与外部链接。**INFERRED** 可能是原建议沟通稿，尚未证明可弃。 | 比较与采纳建议书/现行操作模型的内容与出处，再提保留、归档或删除建议；零静态引用不足以删除。 |
| `docs/renderer-*`、`docs/ui-asset-provenance.md` | **CONFIRMED** 15 项历史 UI/参考考古材料，多项被 SHEEP 报告引用；`ui-asset-provenance` 还由 `PROJECT_STATE.json` 以 Windows 风格路径指向，CSV 静态引用列不能完整反映。 | 保留验收/来源链；优先隔离入口的“现行产品设计”误解，不删除报告依赖。 |
| `docs/reference-gap-resolution-checkpoint.md` | **CONFIRMED** 尽管本轮静态路径反向引用为零，文件记录 Owner 对五项 reference gap 的决策。 | **保留决策记录**，不能以零引用删除。 |
| V1.0 reviewed Roadmap/模板与历史 Master 候选 | **CONFIRMED** 已被 V1.1 治理定义为历史材料，未完成 V1.0 ID 仍 deferred 且不可复用。 | 历史治理 **KEEP**；不得改写成现行状态或擅自删除。 |
| `reports/public-inbound-evidence-2026-09-23/`、本机忽略原件 | **CONFIRMED** 19 项暂存派生包，对应 17 项本机原件；前者注明“派生/脱敏/非授权”。 | 阶段三核哈希/链接与发布边界；不要强制添加原件或将原件删除当成保密措施。 |
| `ecommerce-ai-architecture.zip` | **CONFIRMED** 工作树已移除、Git 索引仍含此历史 ZIP，先前报告未找到静态使用方；Git 历史保留。 | 审查已有删除差异和恢复路径，再决定是否正式纳入某批次；本轮不改暂存。 |

## 完成与待决项

- **CONFIRMED：**阶段一只写此非权威记录和 CSV；既有 25 个暂存条目未改，项目权威文件与代码未改。外部只读参考树未访问或有意修改；其前后快照比对 `NOT_RUN`。
- **PRODUCT_DECISION_REQUIRED：**根目录建议沟通稿的长期保留/归档偏好，以及任何涉及公开证据包发布/历史重写的新范围；本轮不猜测。
- **DEFERRED：**逐篇近似重复审查、全部非文档目录动态引用、历史证据包深度隐私审查、实际删除/迁移和 README 入口调整；这些属于后续小批次。
- **BLOCKED / NOT_AUTHORIZED：**真实平台/会话、SHEEP-305 binding/policy、SHEEP-306、AI/发送；文档清理不提供这类授权。

## 本轮验证

- 清单形状检查：245 项、25 个先前暂存项、5 个先前未跟踪报告、1 个工作树已移除归档；**PASS**。CSV 未复制本机绝对路径或原始证据内容。链接抽查：上述 82 个可解析本地 Markdown 链接目标存在，计划正文新增的相对 CSV 链接存在；**PASS**。
- `node scripts/validate-project-state.mjs`：**PASS**；`node --test tests/project-state-consistency.test.mjs`：**20/20 PASS**；`pnpm run check:boundary`：**PASS**；`pnpm run scan:secrets`：**PASS**（0 unreviewed，6 exact reviewed；非全面无秘密证明）；已跟踪文件的 staged/unstaged `git diff --check`：**PASS**。原始日志在仓内忽略的 `.tmp/document-library-cleanup-2026-09-23/`。
- 25 个暂存条目的二进制 diff SHA-256 前后相同；未运行桌面构建、集成或平台 smoke（本轮仅新增文档清单）。新建文件尚未暂存，等待 Owner 审查。

## 后续执行记录（2026-09-24）

第二阶段旧入口首批仅做可逆标记及 README 导航，不关闭第二阶段；细节及验证见 [旧入口首批记录](document-library-entry-cleanup-2026-09-24.md)。阶段三及删除阶段仍未启动。

## 第二阶段 UI 证据小批次（2026-09-24）

SHEEP-021～035 的 15 份历史 UI 证据保留；五份 gap 快照与一份来源/授权文档加顶部导航，细节见 [历史 UI 证据入口审查](document-library-ui-evidence-review-2026-09-24.md)。第二阶段整体尚未关闭，不进入删除阶段。

## 第二阶段 Read First 旧阻断小批次（2026-09-24）

四份 SHEEP-063 前置 `BLOCKED` 审计保留并标明后续 PASS/CLOSED 路径；见 [Read First 旧阻断入口记录](document-library-read-first-snapshots-2026-09-24.md)。剩余设计/基础候选继续小批次审查，阶段二未关闭。

## 第二阶段设计／基础文档收尾（2026-09-24）

其余 38 份设计／基础候选逐件审查，15 份易误读快照加顶部时点导航、23 份原样保留；连同前批第二阶段范围已做静态验收。详见[第二阶段处置矩阵与停点](document-library-phase2-closeout-2026-09-24.md)。阶段二仅文档维护范围 `COMPLETE`，不等于 Controller `PASS`；阶段三证据包、阶段四删除与阶段五最终交接未执行。

## 第三阶段证据包审查记录（2026-09-24）

已核 17 项本机原件与 17 项派生件的双侧哈希和恢复路径、25 项暂存边界、派生包引用／占位、有限敏感值扫描、第三方许可陈述和发布边界。见[第三阶段审查与停点](document-library-evidence-package-review-2026-09-24.md)。静态审查完成不等于公开提交授权或隐私／许可保证；发布就绪与全局清理 `PARTIAL`。阶段四实际删除和阶段五交接均未执行，`next_stage_not_executed = true`。

## 第四阶段删除执行记录（2026-09-24）

### 首批：`ecommerce-ai-architecture.zip`

5.4 MB 图表交付归档，无静态引用，Git 历史可恢复。暂存删除。见 [Batch 1 报告](document-library-phase4-batch1-2026-09-24.md)。

### 第二批：8 个孤儿文件

`建议`（早期沟通稿，0 引用）、`cleanup-dedup-2026-09-23.md`（维护报告，0 引用）、3 个 smoke test JSON（M6/M12 测试，0 引用）、3 个 platform 清理报告（未跟踪，0 引用）。全部 4 条件满足，删除。见 [Batch 2 报告](document-library-phase4-batch2-2026-09-24.md)。

### 第三批：2 个 platform 孤儿报告

`platform-active-view-isolation-fix-2026-09-23.md` 和 `platform-session-replacement-audit-2026-09-23.md`，未跟踪，唯一引用者已在 Batch 2 中删除。核心结论由 PROJECT_STATE.json 承接。见 [Batch 3 报告](document-library-phase4-batch3-2026-09-24.md)。

### 第四阶段总结

3 批共删除 11 个文件，释放 ~5.45 MB。剩余 241 个文件均有明确保留理由（现行权威、历史治理、任务证据、PROJECT_STATE.json 引用等）。无更多满足全部 4 删除条件的候选。

## 第五阶段最终交接（2026-09-24）

全部验证通过：state consistency、boundary、secrets、diff checks。29 项暂存（4 删除 + 25 派生包/审计报告），51 项未暂存变更（非清理范围）。见 [最终交接报告](document-library-phase5-handoff-2026-09-24.md)。

**全局清理结果**：文档维护范围 `COMPLETE`；代码清理和历史重写 `NOT_RUN`；Controller `PASS/REPAIR = NOT_RUN`。
