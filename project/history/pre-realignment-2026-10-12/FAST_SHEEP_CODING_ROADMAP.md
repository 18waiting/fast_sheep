# FAST_SHEEP_CODING_ROADMAP.md

> **历史草稿 / 非当前执行入口**：本文是未 reviewed 的早期 Roadmap，正文中的「正式编码尚未开始」、Phase/任务顺序等只反映编写时状态。V1.0 reviewed 版本已取代本草稿；当前执行顺序请读 [V1.1 reviewed Roadmap](FAST_SHEEP_CODING_ROADMAP_V1.1_REVIEWED.md)，当前进度与授权只看 [PROJECT_STATE.json](PROJECT_STATE.json)。此提示不修改草稿正文，也不赋予任何任务执行授权。

# 快羊客服（Fast Sheep）完整 Coding Roadmap

> **项目根目录**：`E:\fast_sheep\`  
> **路线原则**：一次只推进一个可独立验收任务。  
> **项目状态**：顶层产品与架构决策已锁定；正式编码尚未开始。  
> **总控结果**：Codex 自报 COMPLETE 不代表任务关闭，只有 Controller `PASS` 才算 closed。

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

---

## Pre-Phase Lifecycle Stage — PRE_CODING_GOVERNANCE

`PRE_CODING_GOVERNANCE` 是 Roadmap Phase 0 之前的治理前置状态，不计入 15 个实施 Phase 的 100% 权重。
只有治理文件冻结并经 Controller 允许后，`current_phase` 才进入 `PHASE_0`。

---

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

## GATE-P1-DOMAIN-FOUNDATION
PASS：
- domain models stable
- IDs scoped by Merchant/Store
- capability/resource scope exists
- migrations green
- old behavior regression green

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

---

# Phase 5 — PDD Core Platform
**Weight: 9%**

PDD 是 reference adapter。

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

---

# Phase 6 — DouDian Core Platform
**Weight: 8%**

目标：用抖店验证抽象不是 PDD-specific。

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

---

# Phase 12 — Local-first Sync & Team Collaboration
**Weight: 5%**

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

---

# Phase 13 — Security / Privacy / Diagnostics
**Weight: 4%**

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

1. 当前完整治理文件集经 owner/controller 审核：root `AGENTS.md` + `project/` 下 active Master Prompt、Task Template、Coding Roadmap、PROJECT_STATE.json、DECISIONS.md。
2. `E:\fast_sheep\` 路径确认。
3. old rebuild read-only。
4. UI renderer 授权范围确认。
5. 22 个母级决策已记录到 Decision Log。
6. 当前下一任务明确为 `SHEEP-001`。
7. 一次只执行一个 task。

---

# 7. Roadmap 完成定义

完成 Phase 14 并不自动等于“商业大规模生产验证完成”。

至少区分：

- `COMMERCIAL_RC_READY`
- `SIGNED`
- `PRODUCTION_PLATFORM_VALIDATED`
- `LIVE_PROVIDER_VALIDATED`
- `REAL_MERCHANT_PILOT_VALIDATED`
- `PRODUCTION_VALIDATED`

必须基于真实证据逐层升级，不允许状态名称超过证据。
