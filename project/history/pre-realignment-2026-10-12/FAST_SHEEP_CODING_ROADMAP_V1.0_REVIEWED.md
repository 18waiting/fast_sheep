# FAST_SHEEP_CODING_ROADMAP_V1.0_REVIEWED.md

# 快羊客服（Fast Sheep）完整 Coding Roadmap — Reviewed V1.0

> **项目根目录**：`E:\fast_sheep\`
> **Document Version**：V1.0_REVIEWED
> **Status**：REVIEWED — Review 2 PASS（R-01 ~ R-07 已应用）— 待 Final Governance Freeze 后生效
> **Review History**：
> - 2026-08-22：Roadmap V1.0 初版
> - 2026-08-23：Review 2 完成。R-01 ~ R-07 全部 PASS / CLOSED，结论与 Controller 收紧项已合并进本文件。
> **Supersedes**：`FAST_SHEEP_CODING_ROADMAP.md`（v1.0）作为正式 coding Roadmap 的当前版本（Freeze 后生效）。
> **路线原则**：一次只推进一个可独立验收任务。
> **项目状态**：顶层产品与架构决策已锁定；正式编码尚未开始。
> **总控结果**：Codex 自报 COMPLETE 不代表任务关闭，只有 Controller `PASS` 才算 closed。

---

# 0. Review 2 应用记录（R-01 ~ R-07）

本文件是 Review 2 合并产物。以下每条均已 PASS / CLOSED，并已落实到对应 Phase / Milestone / Gate：

## R-01 — SecretStore 依赖顺序（提前 minimal foundation）
- 结论：Phase 1 提前 minimal SecretStore foundation；不提前完整 Security Phase（完整 Security/SecretStore 仍在 Phase 13）。
- 应用：新增 **M1.5 — Early Cross-Cutting Foundation**（见 Phase 1）。
- Controller 收紧项：
  - 不强制 minimal SecretStore interface 必须包含 rotate；
  - 不提前锁死 DPAPI 为唯一方案；
  - 要求 = OS-backed secure local storage capability（能力级，不锁实现）。

## R-02 — Conversation Ownership 云权威顺序
- 结论：Phase 1 ownership domain 已存在（SHEEP-014）；提前 Local Ownership Execution Semantics / authority boundary；Cloud coordination 继续 Phase 12。
- 应用：新增 M1.5 项 + GATE-P1 检查；Phase 12（SHEEP-229 ~ 233）保留 Cloud 侧 ownership 协调。
- Controller 收紧项：
  - 不锁死临时 SHEEP 编号；
  - 具体 lease duration / refresh 策略 = DEFERRED（不得在本 Roadmap 锁死）。

## R-03 — Entitlement 依赖顺序
- 结论：Phase 1 提前 minimal Entitlement Contract / local enforcement boundary；Cloud-authoritative Subscription / Entitlement / AI Gateway 继续 Phase 11。
- 应用：新增 M1.5 项 + GATE-P1 检查；GATE-P5 要求 Phase 1 Entitlement foundation 进入 Phase 5 前可消费。
- Controller 收紧项：
  - 不永久写死 `UNKNOWN => DISABLED`；
  - 没有有效 authoritative / signed / permitted evidence 时不得 fail-open；
  - Offline Lease / Grace 可构成合法 evidence。

## R-04 — Platform/UI 商业合规 Gate
- 结论：建立 asset/license evidence、provenance、platform compliance evidence、release-scope blocking gates；technical acceptance ≠ commercial release authorization。
- 应用：Phase 2（SHEEP-024 资产来源）+ GATE-P2；Phase 5/6 Gate；GATE-P14 release-scope blocking gates；Roadmap §7 完成定义。
- Controller 收紧项：
  - 未授权具体 distributable asset 不进入 commercial asset set；
  - IA / ideas / independently redesigned output 不等同于“未授权 asset”；
  - Release Gate 针对 current release scope；明确排除项需记录，但不必然阻塞整个 release。

## R-05 — 签名 / clean-machine 验证位置
- 结论：明确 release 状态区分；Signing + clean-machine 是正式 distribution 必要条件之一，不是充分条件。
- 应用：Roadmap §7 完成定义 + Phase 14 GATE-P14。
- Controller 收紧项：
  - 最终 clean-machine distribution validation 针对准备实际发布的 signed artifact；
  - unsigned build 可提前做 internal smoke，但不能替代最终验证。

## R-06 — Retention / Cloud-sync DATA 决策顺序
- 结论：Phase 12 前需要 Data Authority / Sync Scope Decision Gate；Retention / Export / Deletion / Backup policies 必须在对应 Gate 前关闭；Backup/Restore 不能全部拖到 Phase 14。
- 应用：Phase 1 增加 backup/restore foundation 前置要求；Phase 12 preconditions；Phase 14 保持对应 release 级验证。
- Controller 收紧项：
  - 不把 Diagnostics / Telemetry / support bundle 硬塞进业务 authority 三分类；允许独立 handling / upload eligibility / privacy / retention；
  - `AUDIT_RETENTION_DAYS` 不自动证明第一版必须按套餐差异化 Audit retention；
  - Backup foundation 必须早于高风险 migration。

## R-07 — 早期 sync/version metadata
- 结论：Phase 1 增加 **Sync-Ready Persistence Contract**；`sync-ready ≠ sync-enabled`；Phase 1 不实现 Outbox；真正 Sync Engine 保持 Phase 12。
- 应用：新增 M1.5 项 + GATE-P1 检查；Phase 4/5/6/9 消费该 contract；Phase 12 保留 Outbox / Pull / Conflict / Reconciliation 实现。
- Controller 收紧项：
  - 不要求所有实体拥有 Cloud authoritative ID；
  - 不锁死 `created_at` / `updated_at` / `deleted_at` / `revision` 等具体字段；
  - 不强制所有表拥有 sync revision；
  - 要求的是：persistence architecture 不封死未来 selected sync（能力/契约级，不锁实现）。

> 生效说明：本文件所有 `【Review 2】` 标记为新增/修订内容；未标记部分与原 Roadmap V1.0 一致。正式 SHEEP 编号以 Controller 后续 task prompt 为准（新增项暂不分配固定编号）。

---

# 1. Roadmap 计算规则

项目采用带权 Phase 进度，而不是简单按 task 数量平均。

| Phase | 名称 | Weight |
|---|---|---:|
| 0 | Project Governance & Fork | 4% |
| 1 | Architecture & Domain Foundation | 7% |
| 2 | FastWork UI Reference Restoration | 8% |
| 3 | Fast Sheep UX / Design System Redesign | 8% |
| 4 | Core Conversation Workbench | 8% |
| 5 | PDD Core Platform | 9% |
| 6 | DouDian Core Platform | 8% |
| 7 | AI Conversation & Automation | 9% |
| 8 | Tool Framework & Agent | 7% |
| 9 | Knowledge / RAG / Learning | 7% |
| 10 | Fast Sheep Cloud Foundation | 6% |
| 11 | Subscription / Entitlement / AI Gateway | 5% |
| 12 | Local-first Sync & Team Collaboration | 5% |
| 13 | Security / Privacy / Diagnostics | 4% |
| 14 | Commercial RC & Distribution | 5% |
|  | **TOTAL** | **100%** |

Phase 内按 Milestone 权重再计算。

---

# 2. 全局 Acceptance Gates

所有 Phase 必须经过明确 Gate，不允许“差不多”进入后续。

主要 Gate：

- `GATE-P0-GOVERNANCE`
- `GATE-P1-DOMAIN-FOUNDATION`
- `GATE-P2-UI-REFERENCE`
- `GATE-P3-FAST-SHEEP-UX`
- `GATE-P4-CONVERSATION-CORE`
- `GATE-P5-PDD-TIER1`
- `GATE-P6-DOUDIAN-TIER1`
- `GATE-P7-AI-AUTOMATION`
- `GATE-P8-TOOLS-AGENT`
- `GATE-P9-KNOWLEDGE-LEARNING`
- `GATE-P10-CLOUD-FOUNDATION`
- `GATE-P11-COMMERCIAL-CONTROL`
- `GATE-P12-SYNC-TEAM`
- `GATE-P13-SECURITY-DIAGNOSTICS`
- `GATE-P14-COMMERCIAL-RC`

【Review 2 / R-06】新增跨 Phase 数据决策 Gate（不属于上述 Phase Gate，但为依赖前置）：

- `DATA-DECISION-GATE` — Data Authority / Sync Scope Matrix（R-06）：任何实体 sync 启用前必须 PASS；Retention / Export / Deletion / Backup 策略必须在对应依赖 Gate 前关闭。

---

## Pre-Phase Lifecycle Stage — PRE_CODING_GOVERNANCE

`PRE_CODING_GOVERNANCE` 是 Roadmap Phase 0 之前的治理前置状态，不计入 15 个实施 Phase 的 100% 权重。
只有治理文件冻结并经 Controller 允许后，`current_phase` 才进入 `PHASE_0`。
# Phase 0 — Project Governance & Fork
**Weight: 4%**

目标：创建一个真正独立、可长期演进的 `E:\fast_sheep\`，并建立项目治理系统。

## M0.1 — Governance Bootstrap
建议 tasks：

### SHEEP-001 — Project Workspace Bootstrap
- 创建 `E:\fast_sheep\`
- 物理复制 rebuild 技术基线
- 排除旧 release/report history 作为“新项目历史”
- 禁止 symlink 回旧 rebuild
- 建立 `.tmp/ docs/ reports/ project/`

### SHEEP-002 — Project Governance Integrity Install / Verify
验证并固化已批准的治理文件集，而不是凭 Roadmap 重新创建或覆盖它们：
- root `AGENTS.md`
- active Master Prompt（exact path 由 `project/PROJECT_STATE.json` 的 `master_prompt.path` 指定）
- `project/FAST_SHEEP_CODEX_TASK_TEMPLATE.md`
- `project/FAST_SHEEP_CODING_ROADMAP.md`
- `project/FAST_SHEEP_CODING_ROADMAP_V1.0_REVIEWED.md`（Review 2 后为 active coding roadmap 依据，待 Freeze 生效）
- `project/PROJECT_STATE.json`
- `project/DECISIONS.md`

要求：
- 保留 Controller 已批准的治理内容；
- 不因旧示例路径自行创建另一个 Master Prompt；
- Master 从 Reviewed Candidate 切换到 `FAST_SHEEP_MASTER_PROMPT.md` 必须是单独、明确的治理批准动作。

### SHEEP-003 — Fork Provenance & Read-only Baselines
建立：
- old rebuild baseline
- authorized renderer reference baseline
- write-boundary audit

## M0.2 — Product Identity
### SHEEP-004 — Product Identity Migration
- productName = 快羊客服
- slug = fast_sheep
- appId
- executable identity
- userData isolation

### SHEEP-005 — Business Data Root Isolation
- `%LOCALAPPDATA%\fast_sheep\data`
- legacy env compatibility policy
- tests

## M0.3 — Independent Build Baseline
### SHEEP-006 — Dependency Reproduction
- pnpm lock-based install
- no old-workspace dependency

### SHEEP-007 — Baseline Typecheck / Tests
- typecheck
- desktop tests
- Worker integration
- renderer smoke

### SHEEP-008 — Independent Runtime Path Audit
- no runtime dependency on old rebuild
- no project writes outside root

## GATE-P0-GOVERNANCE
PASS 条件：
- independent physical project
- governance docs installed
- old rebuild read-only
- project identity isolated
- baseline tests green

---

# Phase 1 — Architecture & Domain Foundation
**Weight: 7%**

目标：先建立未来商业系统不可轻易变化的 Domain IDs 和边界。

## M1.1 — Core Identity Domain
### SHEEP-010 — Merchant Domain Model
实体：
- AccountRef
- Merchant
- Store
- PlatformAccount

### SHEEP-011 — Membership / Seat Domain
- Member
- Membership
- Seat
- default roles

### SHEEP-012 — Capability & Resource Scope Model
- capability registry
- store scope
- role composition

## M1.2 — Conversation Domain
### SHEEP-013 — Normalized Conversation Identity
- merchant/store/platform/conversation IDs
- normalized message identity

### SHEEP-014 — Conversation Ownership Domain
- UNASSIGNED
- AI_ACTIVE
- ASSIGNED
- CLAIMED
- ACTIVE
- HANDOFF_REQUIRED
- SUPERVISOR_TAKEOVER
- RELEASED

## M1.3 — Product / Customer / Order Context
### SHEEP-015 — Customer Domain
### SHEEP-016 — Product / SKU Domain
### SHEEP-017 — Order / Logistics Domain

## M1.4 — Persistence Evolution
### SHEEP-018 — New Domain Migration Plan
只新增 migration，不修改历史 migration。

### SHEEP-019 — Domain Persistence Integration
### SHEEP-020 — Legacy/Existing Data Compatibility Smoke

## 【Review 2】M1.5 — Early Cross-Cutting Foundation

> 本 Milestone 是 Review 2（R-01 / R-02 / R-03 / R-07）新增。只建立最小能力/契约，不提前实现完整 Phase（Security/Entitlement/Sync Engine 仍在其对应 Phase）。
> 新增项暂不分配固定 SHEEP 编号；正式编号由 Controller 生成 task prompt 时确定（不锁死临时编号）。

### R-01 — SecretStore Foundation（minimal）
- OS-backed secure local storage capability（能力级，不锁实现方案）
- 不强制 minimal interface 必须包含 rotate
- 不锁死 DPAPI 为唯一方案
- 明确：完整 Security / SecretStore Phase 仍在 Phase 13（SHEEP-240 ~ 243）
- 明确：真实 secret 只停留在 privileged boundary，Renderer 不接触（与 Master §5 / §11 一致）

### R-02 — Local Ownership Execution Semantics / Authority Boundary
- 在 SHEEP-014 ownership domain 之上建立本地执行语义：claim / release / handoff / supervisor takeover 的本地 authority 边界
- Cloud 侧 ownership coordination 继续 Phase 12（SHEEP-229 ~ 233）
- 具体 lease duration / refresh = DEFERRED（不在本 Roadmap 锁死）

### R-03 — Minimal Entitlement Contract / Local Enforcement Boundary
- 最小 Entitlement 契约 + 本地 enforcement boundary（Phase 5 前可消费）
- 没有有效 authoritative / signed / permitted evidence 时不得 fail-open
- 不永久写死 `UNKNOWN => DISABLED`
- Offline Lease / Grace 可构成合法 evidence
- Cloud-authoritative Subscription / Entitlement / AI Gateway 继续 Phase 11（SHEEP-200 ~ 215）

### R-07 — Sync-Ready Persistence Contract
- 能力/契约级，不锁字段名、不锁数据库类型、不实现同步：
  - stable entity identity（Merchant / Store / PlatformAccount / Conversation，复用 SHEEP-010 / 013，不创造第二套 ID）
  - 显式区分：local entity identity ≠ platform external identity ≠ cloud authoritative identity
  - change metadata capability（created/updated 能力，不锁字段名）
  - entity revision capability（能力存在即可，不强制所有表有 sync revision）
  - typed repository / mutation boundary（供未来 Outbox 接入，不实现 Outbox）
  - authority / sync-class reference hook（对齐 Master §15 三分类：Cloud-authoritative / Local-authoritative / Replicated）
  - 明确边界：`sync-ready ≠ sync-enabled`；具体实体是否 sync 由 R-06 `DATA-DECISION-GATE` 决定
- Phase 1 不实现 Outbox、不实现 pull/apply、不实现 sync state（实际 Sync Engine 在 Phase 12，SHEEP-220 ~ 224）

### 【Review 2 / R-06】Backup / Restore Foundation（早期）
- 建立可恢复备份能力与 `migration-before-backup` gate 要求（Master §30）
- backup 不得包含 SecretStore 管理的 plaintext secret
- Backup/Restore 不能全部拖到 Phase 14；高风险 migration 前必须已有 backup foundation

## GATE-P1-DOMAIN-FOUNDATION
PASS：
- domain models stable
- IDs scoped by Merchant/Store
- capability/resource scope exists
- migrations green
- old behavior regression green

【Review 2】新增 PASS 条件（R-01 / R-02 / R-03 / R-06 / R-07）：
- Sync-Ready Persistence Contract 存在（stable identity + 三向身份区分 + change metadata 能力 + revision 能力 + mutation boundary + authority hook；`sync-ready ≠ sync-enabled`；无 Outbox、无 sync state）
- minimal SecretStore foundation 存在（OS-backed secure local storage capability）
- minimal Entitlement Contract / local enforcement boundary 存在（no fail-open）
- Local Ownership Execution Semantics / authority boundary 存在
- Backup/Restore foundation 存在（migration-before-backup gate）
---

# Phase 2 — FastWork UI Reference Restoration
**Weight: 8%**

目标：建立可运行的 reference UI baseline，理解原产品，而不是最终商业 UI。

## M2.1 — Original Renderer Archaeology
### SHEEP-021 — Renderer Asset Inventory
实际扫描：
- HTML
- CSS
- JS
- assets
- network references
- auth-related code

### SHEEP-022 — Page / Feature Map
所有页面分类：
- SHELL
- FIRST_WAVE
- LATER
- DO_NOT_PORT_DIRECTLY

### SHEEP-023 — JS Dependency Classification
- UI_ONLY
- UI_WITH_BRIDGE
- BACKEND_DEPENDENT
- NETWORK_DEPENDENT
- AUTH_OR_SELLER_DEPENDENT
- UNKNOWN

### SHEEP-024 — UI Asset Provenance
正式记录 owner authorization scope。

## M2.2 — Global Shell Restoration
### SHEEP-025 — Global CSS / Tokens Reference Restoration
### SHEEP-026 — App Shell Restoration
### SHEEP-027 — Sidebar Restoration
### SHEEP-028 — Header / Navigation Restoration
### SHEEP-029 — Dialog / Common Component Restoration

## M2.3 — Core Page Restoration
### SHEEP-030 — Conversation Reference Layout
### SHEEP-031 — AI Panel Reference Layout
### SHEEP-032 — PDD Reference Panel
### SHEEP-033 — DouDian Reference Panel
### SHEEP-034 — Product / Order Context Reference
### SHEEP-035 — Settings Reference Pages

## M2.4 — Safe Rewiring
### SHEEP-036 — UI-only Interaction Wiring
### SHEEP-037 — Typed IPC Mapping
### SHEEP-038 — Remove Original Direct Network/Auth Behavior
### SHEEP-039 — Reference Renderer Smoke

## GATE-P2-UI-REFERENCE
PASS：
- reference IA documented
- core UI visibly restored
- no original direct backend/network/auth behavior active
- no extracted renderer runtime dependency
- typed IPC preserved
- security unchanged

【Review 2 / R-04】新增 PASS 条件：
- UI asset provenance 已记录（SHEEP-024）
- 未授权 redistributable asset 已排除出 commercial asset set（不进入 Phase 3 / 商业 release）
- IA / ideas / independently redesigned output 不与“未授权 asset”混淆（Controller 收紧项）

---

# Phase 3 — Fast Sheep UX / Design System Redesign
**Weight: 8%**

目标：从“还原”进入真正属于快羊客服的产品设计。

## M3.1 — Information Architecture
### SHEEP-040 — Fast Sheep IA Proposal
目标一级导航建议：
- 工作台
- 会话
- AI
- 客户
- 商品
- 订单
- 知识库
- 团队
- 设置

### SHEEP-041 — Multi-store Navigation Model
- 全部店铺
- PDD 店铺
- DouDian 店铺

### SHEEP-042 — Conversation-centered Workspace IA

## M3.2 — Design System
### SHEEP-043 — Design Tokens
### SHEEP-044 — Typography / Spacing / Color
### SHEEP-045 — Component Primitives
### SHEEP-046 — Empty / Error / Loading States
### SHEEP-047 — Accessibility Baseline

## M3.3 — Redesign Core Screens
### SHEEP-048 — Fast Sheep App Shell
### SHEEP-049 — Unified Sidebar / Store Switcher
### SHEEP-050 — Unified Conversation Screen
### SHEEP-051 — AI Assist Panel
### SHEEP-052 — Context Panel
### SHEEP-053 — Knowledge UI
### SHEEP-054 — Team / Settings Basics

## GATE-P3-FAST-SHEEP-UX
PASS：
- product no longer merely FastWork skin
- coherent Fast Sheep IA
- Design System exists
- core workbench usable

---

# Phase 4 — Core Conversation Workbench
**Weight: 8%**

【Review 2 / R-07】Phase 4 消费说明：Conversation / Message / Context / Audit 数据必须经由 Phase 1 建立的 typed repository / mutation boundary 写入，并保留 change metadata 能力，使未来 selected sync 无需重写 repository（`sync-ready ≠ sync-enabled`，是否 sync 由 R-06 `DATA-DECISION-GATE` 决定）。

## M4.1 — Inbox
### SHEEP-060 — Conversation List
### SHEEP-061 — Filters / Store / Platform Scopes
### SHEEP-062 — Unread / Priority / Risk Indicators

## M4.2 — Conversation
### SHEEP-063 — Message Timeline
### SHEEP-064 — Composer
### SHEEP-065 — Attachments / Cards Abstraction
### SHEEP-066 — Message Send Pipeline

## M4.3 — Context
### SHEEP-067 — Customer Context
### SHEEP-068 — Product Context
### SHEEP-069 — Order / Logistics Context

## M4.4 — Ownership / Handoff
### SHEEP-070 — Claim / Release UX
### SHEEP-071 — AI/Human Ownership State
### SHEEP-072 — Handoff Reason / Queue
### SHEEP-073 — Supervisor Takeover Basics

## M4.5 — Workbench Reliability
### SHEEP-074 — Reload / Crash Recovery
### SHEEP-075 — Local Drafts
### SHEEP-076 — Conversation Audit Trail

## GATE-P4-CONVERSATION-CORE

【Review 2 / R-07】GATE-P4 新增 PASS 条件：
- Conversation / Message / Context / Audit 写入已通过 Phase 1 mutation boundary（可观察、可挂接未来 Outbox）
- 未引入任何 sync state / Outbox / sync 传输（Phase 1 contract 只要求能力预留）
---

# Phase 5 — PDD Core Platform
**Weight: 9%**

PDD 是 reference adapter。

【Review 2 / R-03 / R-04】Phase 5 消费说明：
- 进入 Phase 5 前，Phase 1 minimal Entitlement Contract / local enforcement boundary 必须已可消费；
- platform compliance evidence 与 UI/asset license evidence 持续记录（technical acceptance ≠ commercial release authorization）。

## M5.1 — Capability Contract
### SHEEP-080 — Platform Capability Registry
### SHEEP-081 — PDD Capability Matrix

## M5.2 — Identity / Session
### SHEEP-082 — PDD PlatformAccount Local Identity
### SHEEP-083 — PDD Login State Machine
### SHEEP-084 — Secure Credential Reference
### SHEEP-085 — Session Expiry Detection

> 不做 anti-bot bypass、CAPTCHA/2FA 自动绕过、stealth。

## M5.3 — Conversation
### SHEEP-086 — PDD Conversation Discovery
### SHEEP-087 — PDD Incoming Message Normalize
### SHEEP-088 — PDD Send Text
### SHEEP-089 — PDD Send Media/Card Capabilities

## M5.4 — Context
### SHEEP-090 — PDD Customer Context
### SHEEP-091 — PDD Product/SKU Context
### SHEEP-092 — PDD Order Context
### SHEEP-093 — PDD Logistics Context

## M5.5 — Reliability
### SHEEP-094 — DOM / Capability Health
### SHEEP-095 — PDD Adapter Degraded States
### SHEEP-096 — PDD Runtime Audit / Diagnostics

## GATE-P5-PDD-TIER1
需要真实允许的环境验证；若无法确认平台行为，按 Decision Protocol 处理。

【Review 2】新增 PASS 条件：
- Phase 1 minimal Entitlement Contract 已可消费（R-03）
- PDD 平台数据写入已通过 Phase 1 mutation boundary 并保留 change metadata（R-07 消费）
- platform compliance evidence 已记录（R-04）

---

# Phase 6 — DouDian Core Platform
**Weight: 8%**

目标：用抖店验证抽象不是 PDD-specific。

【Review 2 / R-04 / R-07】与 Phase 5 相同的消费说明：mutation boundary + change metadata 消费；platform compliance evidence 记录。

## M6.1 — DouDian Capability
### SHEEP-100 — DouDian Capability Matrix
### SHEEP-101 — Contract Gap Audit

## M6.2 — Identity / Session
### SHEEP-102 — DouDian PlatformAccount Local Identity
### SHEEP-103 — Login State Machine
### SHEEP-104 — Session Expiry / Degraded States

## M6.3 — Conversation
### SHEEP-105 — Conversation Discovery
### SHEEP-106 — Incoming Normalize
### SHEEP-107 — Send Text
### SHEEP-108 — Media / Product Card

## M6.4 — Context
### SHEEP-109 — Customer
### SHEEP-110 — Product
### SHEEP-111 — Order
### SHEEP-112 — Logistics

## M6.5 — Cross-platform
### SHEEP-113 — PDD / DouDian Normalized Parity
### SHEEP-114 — Platform-specific Leakage Audit

## GATE-P6-DOUDIAN-TIER1

【Review 2】新增 PASS 条件：
- PDD / DouDian normalized parity 达成（SHEEP-113）
- 数据写入已通过 Phase 1 mutation boundary（R-07 消费）
- platform compliance evidence 已记录（R-04）

---

# Phase 7 — AI Conversation & Automation
**Weight: 9%**

## M7.1 — Context Aggregation
### SHEEP-120 — Context Envelope Contract
### SHEEP-121 — Merchant / Store / Platform Context
### SHEEP-122 — Customer/Product/Order Context
### SHEEP-123 — Conversation Memory Packing

## M7.2 — Intent / Risk
### SHEEP-124 — Intent Taxonomy
### SHEEP-125 — Risk Taxonomy
### SHEEP-126 — Classification Pipeline
### SHEEP-127 — Classification Audit

## M7.3 — Automation Policy
### SHEEP-128 — Automation Levels Contract
### SHEEP-129 — Merchant Default Policy
### SHEEP-130 — Store / Scenario Overrides
### SHEEP-131 — Ownership-aware Automation
### SHEEP-132 — Runtime Degradation Rules

## M7.4 — Response
### SHEEP-133 — AI Suggest
### SHEEP-134 — AI Auto Reply
### SHEEP-135 — Force Handoff
### SHEEP-136 — Human Edit / Approve
### SHEEP-137 — Reply Audit Provenance

## GATE-P7-AI-AUTOMATION
关键：LLM 无权绕开 Policy Engine。

---

# Phase 8 — Tool Framework & Agent
**Weight: 7%**

## M8.1 — Tool Registry
### SHEEP-140 — Tool Metadata Contract
### SHEEP-141 — Risk Levels
### SHEEP-142 — Platform Capability Binding

## M8.2 — Permission Engine
### SHEEP-143 — Capability Checks
### SHEEP-144 — Resource Scope Checks
### SHEEP-145 — Merchant Tool Policy
### SHEEP-146 — Confirmation Flow
### SHEEP-147 — DENY / Failure Semantics

## M8.3 — Reliability
### SHEEP-148 — Idempotency
### SHEEP-149 — Timeout / Retry
### SHEEP-150 — Tool Audit

## M8.4 — MVP Tools
### SHEEP-151 — Read Order
### SHEEP-152 — Read Logistics
### SHEEP-153 — Read Product
### SHEEP-154 — Customer Tag / Note
### SHEEP-155 — Product Card (where supported)

高风险退款/赔付自动动作明确后置或 Decision Required。

## M8.5 — Agent Loop
### SHEEP-156 — Agent Tool Planning
### SHEEP-157 — Permission-aware Execution
### SHEEP-158 — Tool Result → Response
### SHEEP-159 — Agent Audit

## GATE-P8-TOOLS-AGENT
---

# Phase 9 — Knowledge / RAG / Learning
**Weight: 7%**

【Review 2 / R-07 / R-06】Phase 9 消费说明：Knowledge 已具备 version / provenance（SHEEP-161 / 162 / 177），与 Master §15 Replicated 分类一致，是 sync-ready 基础。是否实际 sync 由 R-06 `DATA-DECISION-GATE` 决定；本 Phase 不实现任何 sync。

## M9.1 — Knowledge Domain
### SHEEP-160 — Knowledge Scope Model
### SHEEP-161 — Effective Date / Version
### SHEEP-162 — Provenance

## M9.2 — Ingestion
### SHEEP-163 — Merchant Text/File Import
### SHEEP-164 — Store Knowledge
### SHEEP-165 — Product Knowledge
### SHEEP-166 — Chunk / Embedding Pipeline

## M9.3 — Retrieval
### SHEEP-167 — Scope Filter
### SHEEP-168 — Candidate Retrieval
### SHEEP-169 — Priority / Freshness
### SHEEP-170 — Reranking / Conflict
### SHEEP-171 — Retrieval Provenance

## M9.4 — Learning
### SHEEP-172 — Learning Candidate Model
### SHEEP-173 — Candidate Generation
### SHEEP-174 — Evidence Summary
### SHEEP-175 — Human Review UI
### SHEEP-176 — Approve / Edit / Reject
### SHEEP-177 — Publish Versioned Knowledge

## GATE-P9-KNOWLEDGE-LEARNING

---

# Phase 10 — Fast Sheep Cloud Foundation
**Weight: 6%**

## M10.1 — Cloud Bootstrap
### SHEEP-180 — TypeScript Cloud Workspace
### SHEEP-181 — Modular Monolith Boundaries
### SHEEP-182 — PostgreSQL Foundation
### SHEEP-183 — API v1 Convention

## M10.2 — Identity
### SHEEP-184 — Account
### SHEEP-185 — Login / Session
### SHEEP-186 — Merchant Creation
### SHEEP-187 — Membership

## M10.3 — Authorization
### SHEEP-188 — Role Templates
### SHEEP-189 — Capability Registry
### SHEEP-190 — Resource Scope

## M10.4 — Device / Store Registry
### SHEEP-191 — Device Registry
### SHEEP-192 — Store Registry
### SHEEP-193 — Platform Connection Metadata

## GATE-P10-CLOUD-FOUNDATION

---

# Phase 11 — Subscription / Entitlement / AI Gateway
**Weight: 5%**

【Review 2 / R-06】Phase 11 说明：
- Cloud-authoritative Subscription / Entitlement / AI Gateway 实现在本 Phase（R-03 确认不提前）；
- `DATA-DECISION-GATE`（Data Authority / Sync Scope Matrix + Retention / Export / Deletion / Backup 策略）必须在 Phase 12 前关闭（R-06）。

## M11.1 — Subscription
### SHEEP-200 — Subscription Domain
### SHEEP-201 — Plan → Entitlement Mapping
### SHEEP-202 — Store/Seat/Device Limits

## M11.2 — Offline Lease
### SHEEP-203 — Signed Lease Contract
### SHEEP-204 — Public-key Verification Desktop
### SHEEP-205 — Offline Grace
### SHEEP-206 — Clock Rollback Detection
### SHEEP-207 — Safe Degradation Matrix

## M11.3 — Managed AI
### SHEEP-208 — Cloud AI Gateway
### SHEEP-209 — Provider Secret Boundary
### SHEEP-210 — Model Routing
### SHEEP-211 — Usage Metering
### SHEEP-212 — Rate / Entitlement Enforcement

## M11.4 — BYOK
### SHEEP-213 — BYOK Config Model
### SHEEP-214 — Local Secret Reference
### SHEEP-215 — BYOK Provider Adapter

## GATE-P11-COMMERCIAL-CONTROL

【Review 2 / R-06】新增 PASS 条件 / 前置：
- `DATA-DECISION-GATE` 已关闭（Data Authority / Sync Scope Matrix；Retention / Export / Deletion / Backup 策略），否则不得进入 Phase 12 的 sync 启用工作
- Diagnostics / Telemetry / support bundle 未被强制塞入业务 authority 三分类（允许独立 handling / upload eligibility / privacy / retention）
---

# Phase 12 — Local-first Sync & Team Collaboration
**Weight: 5%**

【Review 2】Phase 12 前置条件（R-02 / R-06 / R-07）：
- `DATA-DECISION-GATE` 已 PASS：Data Authority / Sync Scope Matrix 决定了哪些实体实际 sync（`sync-ready ≠ sync-enabled`）
- Phase 1 Sync-Ready Persistence Contract 已被 Phase 4/5/6/9 消费（stable identity + change metadata + revision capability + mutation boundary 已存在）
- 本 Phase 是实际 Sync Engine 实现点（Outbox / Pull / Conflict / Reconciliation），不是首次引入 entity version 语义的 retrofit 点

## M12.1 — Sync Engine
### SHEEP-220 — Sync Entity Contract
### SHEEP-221 — Outbox
### SHEEP-222 — Pull / Apply
### SHEEP-223 — Retry / Backoff
### SHEEP-224 — Version Conflict

## M12.2 — Entity Policies
### SHEEP-225 — Knowledge Sync Policy
### SHEEP-226 — AI Policy Sync
### SHEEP-227 — Store / Settings Sync

## M12.3 — Collaboration
### SHEEP-228 — Presence Basics
### SHEEP-229 — Conversation Ownership Cloud Authority
### SHEEP-230 — Ownership Lease
### SHEEP-231 — Claim Race Test
### SHEEP-232 — Offline Ownership Rules
### SHEEP-233 — Reconciliation

## M12.4 — Supervisor
### SHEEP-234 — Basic Team Status
### SHEEP-235 — Handoff Queue
### SHEEP-236 — Supervisor Takeover

## GATE-P12-SYNC-TEAM

【Review 2】新增 PASS 条件：
- 仅同步 `DATA-DECISION-GATE` 批准的实体
- Outbox / Pull / Apply / Retry / Conflict 均已实现并验证
- Conversation Ownership Cloud Authority 与本地 authority boundary 对接（R-02）
- 未同步实体不因本 Phase 引入结构性返工（Phase 1 contract 已预留）

---

# Phase 13 — Security / Privacy / Diagnostics
**Weight: 4%**

【Review 2 / R-01】说明：完整 Security / SecretStore Phase 保留在本 Phase；Phase 1 只提前 minimal foundation，不提前完整 Security Phase。

## M13.1 — Secret Store
### SHEEP-240 — SecretStore Interface
### SHEEP-241 — Windows Secure Implementation
### SHEEP-242 — BYOK Secret Migration
### SHEEP-243 — Seller Credential Reference

## M13.2 — Logging
### SHEEP-244 — Structured Logging
### SHEEP-245 — Redaction Filter
### SHEEP-246 — Rotation / Retention
### SHEEP-247 — Secret Leakage Tests

## M13.3 — Telemetry
### SHEEP-248 — Minimal Telemetry Schema
### SHEEP-249 — Privacy Allowlist
### SHEEP-250 — Opt / Settings UX

## M13.4 — Diagnostics
### SHEEP-251 — Diagnostics Bundle
### SHEEP-252 — Sanitization
### SHEEP-253 — User Preview / Consent
### SHEEP-254 — Support Upload Hook

## M13.5 — Security Audit
### SHEEP-255 — Desktop Security Boundary
### SHEEP-256 — Cloud Authorization Audit
### SHEEP-257 — Cross-merchant Isolation
### SHEEP-258 — Credential Leakage Audit

## GATE-P13-SECURITY-DIAGNOSTICS

---

# Phase 14 — Commercial RC & Distribution
**Weight: 5%**

【Review 2 / R-04 / R-05】Phase 14 说明：
- release 状态必须区分（见 §7 完成定义）：`PACKAGED / INTERNAL RC`、`SIGNED DISTRIBUTION CANDIDATE`、`CLEAN-MACHINE VALIDATED DISTRIBUTION CANDIDATE`、`EXTERNAL PRODUCTION VALIDATION`
- Signing + clean-machine 是正式 distribution 必要条件之一，不是充分条件（R-05）
- Release Gate 针对 current release scope；明确排除项必须记录，不静默跳过（R-04）

## M14.1 — Product Packaging
### SHEEP-260 — Fast Sheep Packaging Identity
### SHEEP-261 — Worker Packaging Regression
### SHEEP-262 — Electron Windows x64
### SHEEP-263 — Installer
### SHEEP-264 — Portable

## M14.2 — Upgrade / Migration
### SHEEP-265 — Version Policy
### SHEEP-266 — DB Upgrade Smoke
### SHEEP-267 — App Upgrade Smoke
### SHEEP-268 — Config Migration

## M14.3 — Commercial Readiness
### SHEEP-269 — License / Entitlement Runtime Smoke
### SHEEP-270 — Managed AI Usage Smoke
### SHEEP-271 — BYOK Smoke
### SHEEP-272 — PDD Commercial Scenario Smoke
### SHEEP-273 — DouDian Commercial Scenario Smoke
### SHEEP-274 — Multi-seat Scenario Smoke
### SHEEP-275 — Offline Grace Scenario
### SHEEP-276 — Diagnostics Support Scenario

## M14.4 — RC Governance
### SHEEP-277 — Release Manifest
### SHEEP-278 — Checksums
### SHEEP-279 — Final Audit
### SHEEP-280 — Commercial RC Freeze
### SHEEP-281 — Final Handoff

## GATE-P14-COMMERCIAL-RC

【Review 2】新增 PASS 条件（R-04 / R-05 / R-06）：
- release-scope blocking gates 已关闭：asset/license evidence、provenance、platform compliance、signing、clean-machine validation（对准备实际发布的 signed artifact）、release manifest、checksums
- 明确排除项已记录（不静默跳过）
- Backup / Restore 验证未被全部推迟到本 Phase（早期 foundation 已在 Phase 1 / 对应 Gate 建立）

RC status 不得自动称 `PRODUCTION_VALIDATED`。
Production DOM / live Provider / signing / real merchant rollout 应有独立外部 acceptance gates。
---

# 3. Cross-cutting Backlogs

以下事项跨 Phase 管理，不应“顺手”插入当前 task。

## A. Additional Platforms
- 千牛
- 京东
- 快手
- 闲鱼

## B. Enterprise
- Custom Roles UI
- SSO
- complex audit retention
- advanced SLA
- workforce management

## C. Advanced AI
- high-risk tool automation
- auto-refund
- compensation
- autonomous promotion

## D. Advanced Cloud
- full conversation cloud storage
- cross-device full CRM
- large BI
- service extraction
- dedicated queues/search

---

# 4. Project State Format

推荐：

`E:\fast_sheep\project\PROJECT_STATE.json`

```json
{
  "project": "fast_sheep",
  "product_name": "快羊客服",
  "current_phase": "PHASE_0",
  "current_milestone": "M0.1",
  "last_closed_task": null,
  "next_task": "SHEEP-001",
  "overall_progress": 0.0,
  "phase_progress": 0.0,
  "open_blockers": [],
  "open_decisions": [],
  "deferred_items": [],
  "roadmap_version": "1.0"
}
```

只有 Controller-approved task closure 流程可以推进 state。

---

# 5. Controller Status Card

每次审查必须先给用户：

```text
FAST SHEEP PROJECT STATUS

Current Phase:
Current Milestone:
Reviewed Task:
Controller Decision: PASS | REPAIR

Task Progress:
Phase Progress:
Overall Roadmap Progress:

Open Blockers:
Product Decisions Required:
Deferred Items:

Next Task:
```

然后 exactly one next prompt。

---

# 6. Phase 0 启动前的 Hard Stop

正式编码前必须满足：

1. 当前完整治理文件集经 owner/controller 审核：root `AGENTS.md` + `project/` 下 active Master Prompt、Task Template、Coding Roadmap（含 Reviewed V1.0）、PROJECT_STATE.json、DECISIONS.md。
2. `E:\fast_sheep\` 路径确认。
3. old rebuild read-only。
4. UI renderer 授权范围确认。
5. 22 个母级决策已记录到 Decision Log。
6. Review 2 / Review 3 / Final Governance Freeze 全部完成，Owner GO。
7. 当前下一任务明确为 `SHEEP-001`。
8. 一次只执行一个 task。

---

# 7. Roadmap 完成定义

完成 Phase 14 并不自动等于“商业大规模生产验证完成”。

【Review 2 / R-05】至少区分以下 release 状态，且状态名称不得超过证据：

- `PACKAGED / INTERNAL RC`
- `SIGNED DISTRIBUTION CANDIDATE`
- `CLEAN-MACHINE VALIDATED DISTRIBUTION CANDIDATE`
- `EXTERNAL PRODUCTION VALIDATION`

并保持原有区分：

- `COMMERCIAL_RC_READY`
- `SIGNED`
- `PRODUCTION_PLATFORM_VALIDATED`
- `LIVE_PROVIDER_VALIDATED`
- `REAL_MERCHANT_PILOT_VALIDATED`
- `PRODUCTION_VALIDATED`

硬规则：

```text
RC != SIGNED != CLEAN-MACHINE VALIDATED != PRODUCTION VALIDATED
```

必须基于真实证据逐层升级，不允许状态名称超过证据。

【Review 2 / R-04】commercial release 至少必须通过对应已批准 Gate：signing、signature verification、clean-machine validation、platform compliance、UI/asset/license、third-party dependency/license、release manifest、checksums、data governance、backup/recovery、security audit、tenant isolation、entitlement server enforcement、compatibility/update。具体 release scope 必须明确，被排除内容必须记录，不得静默跳过。

---

# 8. Review 2 关闭记录（本文件）

- Review 2：PASS / CLOSED（2026-08-23）
- 覆盖：R-01 ~ R-07 全部 PASS / CLOSED
- 产物：`FAST_SHEEP_CODING_ROADMAP_V1.0_REVIEWED.md`
- 生效：待 Review 3（Task Template）PASS → Final Governance Freeze → Owner GO 后，作为正式 coding Roadmap 使用
- 正式编码（SHEEP-001）在 Freeze 前保持 BLOCKED
