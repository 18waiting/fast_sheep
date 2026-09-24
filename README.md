# 快羊客服（Fast Sheep）

面向电商商家的 AI-first、多店铺就绪客服客户端。当前 MVP 以拼多多（PDD）为首个平台：平台页面承担登录/会话、Transport、诊断与人工兜底，不是产品的主要日常界面。AI 只提出结构化计划；确定性策略与平台 Transport 负责执行和结果核验。

> 本仓库仍有历史 `fastwork-*` 包名及 M0–M12 工程资产。它们不代表当前产品定位或任务进度；不要仅凭目录名判断模块可以删除。

## 从哪里了解项目

按 [AGENTS.md](AGENTS.md) 的顺序阅读权威文件：

- 产品定位：[North Star](docs/product/FAST_SHEEP_NORTH_STAR.md)；当前范围：[PDD MVP V1](docs/product/PDD_MVP_V1.md)。
- 不可越过的约束：[Master Constitution](project/FAST_SHEEP_MASTER_PROMPT.md) 与 [locked decisions](project/DECISIONS.md)。
- **当前进度和授权**：[PROJECT_STATE.json](project/PROJECT_STATE.json)。其中的 `last_closed_task`、下一任务 ID 和授权字段为当前权威；`current_task` / `next_task` 是便于阅读的投影。Reviewed Roadmap 中的任务 `Status` 是编写时的基线，不能替代当前状态账本。
- 执行顺序：[V1.1 Roadmap](project/FAST_SHEEP_CODING_ROADMAP_V1.1_REVIEWED.md)；任务格式：[V1.1 Template](project/FAST_SHEEP_CODEX_TASK_TEMPLATE_V1.1_REVIEWED.md)。
- 开发工作方式：[Owner 采纳的操作模型](project/FAST_SHEEP_DEVELOPMENT_OPERATING_MODEL.md)。根目录[《快羊开发建议书》](快羊开发建议书.md)是采纳来源，`建议`是更早的沟通稿；二者均不是当前规则或执行授权。未 reviewed 的[旧 Roadmap](project/FAST_SHEEP_CODING_ROADMAP.md)和[旧模板](project/FAST_SHEEP_CODEX_TASK_TEMPLATE.md)仅作历史溯源，不用于派生新任务。
- 历史 UI 资料：[SHEEP-021～035 证据导航与 gap 处置说明](reports/document-library-ui-evidence-review-2026-09-24.md)。这些是当时的验收/来源证据，不是当前产品界面规范；原始参考的使用仍受许可与授权边界约束。
- 历史设计/基础文档：[文档库第二阶段处置矩阵](reports/document-library-phase2-closeout-2026-09-24.md)。它只帮助辨认时点和验收链；当前产品、架构及执行授权仍以上述权威文件为准。

未经授权不要进行真实平台操作、AI 自动回复、发送或政策激活。一个离线子单元获得 Controller PASS，也不等于整个 SHEEP 任务关闭或真实操作获授权。

## 代码位置

- `apps/desktop/`：Electron Main、Preload、Renderer 和桌面测试。
- `packages/`：领域契约、持久化、编排、平台适配器等 workspace 包。
- `services/ai-worker/`：Python AI Worker；`resources/worker/` 是桌面打包所需的运行制品。
- `scripts/`、`tests/`、`parity-tests/`：校验、测试和冻结证据。
- `project/`、`docs/`、`reports/`：治理、产品/架构定义与验收证据。历史报告不是当前授权来源。

## 本地开发

仓库使用 pnpm workspace（`packageManager` 在 `package.json` 中固定）。常用离线检查：

```sh
pnpm install
pnpm run typecheck
pnpm run test
node scripts/validate-project-state.mjs
node --test tests/project-state-consistency.test.mjs
```

桌面包单独构建：`pnpm --filter @fastwork/desktop run build`。完整 CI 包含 Windows/Python 与打包环境依赖；具体命令以根目录 `package.json`、各包脚本及 `.github/workflows/` 为准，不要把当前主机上的单项测试通过视作发行验收。
