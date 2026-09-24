# PDD 入站历史证据：公开脱敏派生包

> **DERIVED / REDACTED — 2026-09-23。** 下列 17 个组件派生自 2026-09-20 的本地历史诊断、第三方静态审阅和工程建议；**不是原文字节、实时平台验证、现行产品/架构权威，也不是执行授权**。当前状态与授权只看 [`PROJECT_STATE.json`](../../project/PROJECT_STATE.json)。本包无 Controller PASS；`next_stage_not_executed = true`。

- [入站诊断与建议](pdd-inbound-analysis-2026-09-20/analysis.md)、[建议文档](pdd-inbound-analysis-2026-09-20/recommended-solution.md)、[离线输出](pdd-inbound-analysis-2026-09-20/offline-tests.tap)
- [第三方公开源码的历史静态审阅](zhinianboke-pdd-review-2026-09-20/analysis.md)；不是第三方源码的再分发或平台接入许可。
- [整合工程建议](pdd-inbound-engineering-plan-2026-09-20/engineering-plan.md)；不替代 [V1.1 Roadmap](../../project/FAST_SHEEP_CODING_ROADMAP_V1.1_REVIEWED.md)。
- [17 项派生文件 SHA-256 清单](manifest.json)。

## 派生规则与可验证范围

1. 原始 17 文件未改动，留在本机 `reports/` 的三个原目录中，**不纳入新的公开暂存集**。逐件原 SHA-256 与原件→派生件对应记录留在忽略的 `.tmp/evidence-publication-2026-09-23/original-provenance.json`；该本地记录不随仓库分发。旧 Git 历史里原先已跟踪的两个根 Markdown 仍可恢复；本次不重写历史。
2. 作者机器的项目绝对路径改为可移植的仓库相对引用：Markdown 可链接目标改为相对此文件的链接；JSON 路径以仓库根为基准；非链接行的仓库路径也以仓库根为基准。派生包内的交叉引用改指向本包。`REPO_ROOT` 表示当时本机项目根，不是固定运行路径。历史行号/哈希不保证适用于当前源码。
3. 忽略的 `.tmp` 快照与第三方源码未入包，路径标为 `LOCAL_ONLY:.tmp/...`，**不可当作公开仓库有效链接**。本机工具运行时标为 `LOCAL_TOOL_RUNTIME_NOT_INCLUDED`。仓库外原附件标为 `PRIVATE_ATTACHMENT_NOT_INCLUDED`，其原哈希替换为 `PRIVATE_ATTACHMENT_HASH_NOT_PUBLISHED`；不随包提供附件或从中推导权限。
4. 每个 Markdown、TAP、JSON、脚本组件都加派生标记/护栏，所以各文件的字节哈希均不同于原件。两个脚本保留供静态阅读，但在开头强制抛错，**不可直接执行**；原脚本会写/覆写历史输出。不要为“复验历史”运行原脚本。JSON 的 `_derived_notice` 是新增元数据；原始静态测试结论、源码快照哈希和旧状态快照仍是**当时**的记录，未当作现行运行结果重算。
5. 三处 `report_sha256` / `document_sha256` 已重算为派生 Markdown 的实际字节 SHA-256；工程建议的字符/行数同步更新。[清单](manifest.json)校验的是本包的 17 个派生组件本身，不证明未收录附件、第三方源码或当前平台行为。旧校验项中的 `passed` 仅表示原历史检查，不声称派生后的文档已重跑旧生成器。

本包的脱敏是静态、按已识别路径及常见敏感形态的有限检查，不是绝对的隐私保证。原报告中的旧 `COMPLETE` / SHEEP-301 快照不改变当前 SHEEP-305 的门禁。任何真实平台绑定、政策激活、发送、商用许可和下一 SHEEP 阶段仍需各自授权。
