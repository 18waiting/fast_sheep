# AGENTS.md — Fast Sheep Project Navigation

Project root: `E:\fast_sheep\`
Product: 快羊客服 / fast_sheep

This file is the Codex navigation and execution entrypoint. It does not replace
the project constitution, locked decisions, product authority, or current state.

---

## 1. Required Read Order

Before any project task, read in this order:

1. `project/FAST_SHEEP_MASTER_PROMPT.md` — constitution and hard invariants
2. `project/DECISIONS.md` — locked/superseding product and architecture decisions
3. `docs/product/FAST_SHEEP_NORTH_STAR.md` — stable product identity
4. `docs/product/PDD_MVP_V1.md` — current PDD MVP scope
5. `docs/architecture/AI_CUSTOMER_SERVICE_CORE.md` — core lifecycle and ownership
6. `docs/architecture/PLATFORM_ADAPTER_CONTRACT.md` — platform adapter boundary
7. `docs/architecture/REPLY_AND_ACTION_SAFETY.md` — deterministic execution safety
8. `project/PROJECT_STATE.json` — current execution ledger and authorization
9. the reviewed Coding Roadmap plus the current SHEEP task prompt

All SHEEP task prompts must follow the active reviewed Codex Task Template.
Resolve exact active paths from `project/PROJECT_STATE.json`; do not infer them
from old filenames. The current execution authorities are the V1.1 Roadmap
and V1.1 Task Template. V1.0 Roadmap/Template/task definitions are historical
governance and unfinished V1.0 IDs remain deferred, not reusable.

`project/PROJECT_STATE.json` owns current lifecycle/authorization. It must not
be treated as product narrative. The North Star and PDD MVP documents own
product meaning and current MVP scope respectively.

---

## 2. Product Alignment Guard

Before substantial implementation, state:

```text
PRODUCT_ALIGNMENT:
CURRENT_MVP_RELEVANCE:
CUSTOMER_VALUE:
SAFETY_IMPACT:
OUT_OF_SCOPE:
DECISION:
```

Allowed `DECISION` values:

- `PROCEED`
- `PRODUCT_DIRECTION_MISMATCH`

If a task primarily optimizes raw PDD UI and does not advance the AI-first
customer-service loop, remove a Transport/runtime blocker, or have explicit
Controller diagnostic/fallback authorization, stop with:

`PRODUCT_DIRECTION_MISMATCH`

Do not start the next SHEEP task automatically. Wait for Controller `PASS` or
`REPAIR`.

---

## 3. Write Boundary and External References

All project-controlled source, configuration, reports, tests, artifacts,
staging, temporary project files, and persistent state must remain under:

`E:\fast_sheep\`

Preferred project temp root:

`E:\fast_sheep\.tmp\`

External reference trees are read-only:

- `E:\ai客服数据\FastWork\rebuild\`
- `E:\ai客服数据\FastWork_asar_extracted\dist\renderer\`
- `E:\nixiang\` — pending classification; only with explicit task authorization

Do not modify, rename, delete, or generate into those trees. Do not copy
credentials, cookies, tokens, passwords, API keys, live seller sessions, or
private user data.

---

## 4. Evidence and Task Discipline

Every material finding must be classified as:

- `CONFIRMED`
- `INFERRED`
- `PRODUCT_DECISION_REQUIRED`
- `BLOCKED`
- `DEFERRED`

Codex task results are only:

- `COMPLETE`
- `PARTIAL`
- `FAIL`
- `NOT_RUN`

Controller review decisions are only:

- `PASS`
- `REPAIR`

A Codex `COMPLETE` does not close a task. Only Controller `PASS` closes it.

Do not guess or implement a `PRODUCT_DECISION_REQUIRED` item. Record it and
complete only independent, safe work.

---

## 5. Non-Negotiable Constraints by Reference

The Master Constitution remains authoritative for:

- Desktop security and typed IPC boundaries
- tenant isolation and authoritative merchant scope
- SecretStore and credential handling
- Local-first data, sync, retention, and deletion rules
- AI automation authority and tool-risk gates
- platform commercial-compliance gates
- release, migration, backup, and supply-chain requirements

A current task prompt may narrow scope but must not override the Master.
To change a Master invariant, use the governance decision process first.

The current review authority is:

- Product identity: `docs/product/FAST_SHEEP_NORTH_STAR.md`
- Current MVP: `docs/product/PDD_MVP_V1.md`
- Core architecture: `docs/architecture/AI_CUSTOMER_SERVICE_CORE.md`
- Adapter architecture: `docs/architecture/PLATFORM_ADAPTER_CONTRACT.md`
- Execution safety: `docs/architecture/REPLY_AND_ACTION_SAFETY.md`
- Locked decisions: `project/DECISIONS.md`
- Current state/authorization: `project/PROJECT_STATE.json`
- Execution order: reviewed Coding Roadmap

Do not create a second source of truth for these areas.

---

## 6. Validation Before COMPLETE

Before claiming `COMPLETE`:

- verify every required output exists
- run required tests, integration/smoke, and negative tests
- verify security, tenant, data, and secret boundaries where applicable
- verify read-only reference trees were not modified
- write the required task report
- disclose `INFERRED` findings
- leave unresolved `PRODUCT_DECISION_REQUIRED` items unimplemented
- ensure `next_stage_not_executed = true`

If a required path or core validation is missing, do not claim `COMPLETE`.

---

## 7. Current Hard Stop

Do not resume `SHEEP-091` or add live execution authorization merely because a
Roadmap item is next. Current task/live authorization remains exactly as
recorded in `project/PROJECT_STATE.json`.
---

## 8. Development and Testing Environment

**重要：开发和测试环境分离**

### 8.1 开发环境（公司电脑）

- **机器：** macOS（当前开发机）
- **项目路径：** `/Users/wb02605050/Documents/ChatGPT/fast_sheep`
- **Node.js 版本：** v20（通过 Homebrew 安装）
- **可用操作：**
  - ✅ TypeScript 编译（`pnpm run typecheck`）
  - ✅ 代码编辑和重构
  - ✅ Git 操作
  - ❌ **单元测试**（需要 Node.js v22+ 支持 `--experimental-strip-types`）

### 8.2 测试环境（个人电脑）

- **机器：** 个人电脑（Windows，项目路径 `E:\fast_sheep\`）
- **Node.js 版本：** v22+（支持 `--experimental-strip-types`）
- **可用操作：**
  - ✅ 单元测试（`pnpm run test`）
  - ✅ 集成测试
  - ✅ 完整验证流程

### 8.3 Codex 执行约束

在**公司电脑**（macOS 开发环境）上执行任务时：

1. **不要声称测试已运行** — 如果任务要求运行单元测试，但当前环境是 macOS 开发机，必须明确说明"测试需要在个人电脑上运行"
2. **不要尝试升级 Node.js** — 开发环境保持 v20，不要为了跑测试而升级
3. **typecheck 是最高验证标准** — 在开发环境上，`pnpm run typecheck` 通过即为代码正确性的最高保证
4. **测试验证标记为 DEFERRED** — 如果任务需要测试验证，在任务报告中标记为 `DEFERRED: 需要在个人电脑上运行测试`

### 8.4 环境识别

可以通过以下方式识别当前环境：

```bash
# macOS 开发环境
uname -s  # 输出: Darwin
whoami    # 输出: wb02605050（公司账号）

# Windows 测试环境
# 项目路径包含 E:\fast_sheep\
```

**当前环境：** macOS 开发环境（公司电脑）

