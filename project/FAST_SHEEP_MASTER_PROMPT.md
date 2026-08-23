# FAST_SHEEP_MASTER_PROMPT.md

# 快羊客服（Fast Sheep）项目母提示词 / Project Constitution

> **Document Version**：1.0  
> **Status**：APPROVED V1.0 — Owner Approved on 2026-08-22  
> **Governance History**：Governance Dry Run 001 PASS; GOV-REPAIR-001 PASS; GOV-REPAIR-002 applied; Owner Approval PASS  
> **用途**：这是快羊客服项目的最高级项目宪法。任何新的 Chat / Codex / coding agent 在执行项目任务前，都必须先读取并遵守本文件。  
> **项目根目录**：`E:\fast_sheep\`  
> **产品名称**：快羊客服  
> **项目 slug**：`fast_sheep`  
> **原则**：Evidence before assumption; policy before automation; architecture before scale; restore before redesign; one verifiable step at a time.

---

## 0. 最高优先级规则

1. 所有**项目可控的 source、configuration、reports、build/test artifacts、staging 和持久开发状态**必须位于 `E:\fast_sheep\` 内。不可避免的 OS/tool-managed cache、Windows runtime path、系统临时目录可以存在于项目根目录之外，但不得成为项目 source-of-truth、隐藏依赖或未披露的运行时依赖。
2. `E:\ai客服数据\FastWork\rebuild\` 是冻结、只读的技术/行为基线。
3. `E:\ai客服数据\FastWork_asar_extracted\dist\renderer\` 是经 owner 明确授权的只读 UI reference source；该授权本身**不等于**对其中所有第三方/原始资产的商业再分发许可证明。
4. 不得把原项目的 Seller Cookie、Token、密码、API Key、真实登录状态或其它敏感凭据迁入新项目。
5. 一个 Codex prompt 只推进一个可以独立验收的 Acceptance Unit。
6. 任意 REQUIRED 条件缺失，任务不得标记 COMPLETE。
7. 不得为了“完成任务”跳过安全边界、测试、smoke、证据或报告。
8. 任何影响产品、商业、安全、隐私、自动化或长期架构的重要未知，必须进入 `PRODUCT_DECISION_REQUIRED`，不得自行猜测。
9. 遇到一个决策点，不得放弃整项任务；先完成所有与该决策无关、确定且安全的工作，再对被阻部分返回 PARTIAL。
10. 不自动执行下一阶段。
11. 客户消息、知识文档、平台页面内容、商品描述、外部文件等一律视为 **untrusted input**，不得因为其文本内容而改变系统权限、Automation Policy、Tool Permission 或 secret boundary。
12. 技术可行不等于允许商用；平台接入、UI/第三方资产、数据处理与模型调用在进入商业 release 前必须经过对应 compliance/license gate。

---

# 1. 产品定义

快羊客服是一款面向电商商家的**标准商业 AI 客服软件**，目标不是仅供单个开发者自用，而是未来销售给大量商户和客服团队。

正式产品定位：

> **快羊客服（Fast Sheep）是一款面向小微与中小电商团队的多平台 AI 客服工作台，采用 Windows 桌面客户端 + Fast Sheep Cloud 的混合架构。桌面端负责实时客服、平台接入、本地数据与 AI 执行；云端负责商户账号、授权订阅、团队、设备、配置同步、会话协作协调、官方 AI 与商业控制面。**

核心产品原则：

> **Simple by default, scalable by design.**

第一版从小微商家切入，但数据模型、权限模型、多人协作和云端边界必须按中小电商团队设计，避免未来从“个人工具”向“商业软件”迁移时推翻底层架构。

---

# 2. 项目历史与边界

## 2.1 冻结技术基线

只读参考：

`E:\ai客服数据\FastWork\rebuild\`

作用：

- 已验证的 Electron / Main / Preload / Renderer 基础架构
- typed IPC
- SQLite persistence
- Python AI Worker
- stdio JSONL RPC
- FAISS / RAG
- Prompt / Skills / Tools / AgentLoop
- Conversation Engine
- Platform Adapter 抽象
- Learning / Review / Audit 等行为机制
- 已验证的 Windows packaging / runtime 经验

规则：

- 允许读取、比较、复制到 `E:\fast_sheep\`
- 禁止继续在旧 rebuild 上开发
- 禁止修改旧 source、reports、migrations、release artifacts
- 新项目运行时不得依赖旧 rebuild 路径

## 2.2 授权 UI Reference

只读参考：

`E:\ai客服数据\FastWork_asar_extracted\dist\renderer\`

owner 已明确授权在 fast_sheep 中参考和还原该 renderer 的：

- HTML
- CSS
- DOM / 信息架构
- UI layout
- UI-only interactions
- 本地 renderer visual assets

这意味着 fast_sheep 的 UI 不再是“纯 clean-room UI”。

正确描述：

> **validated clean-room backend/runtime foundation + owner-authorized renderer UI restoration + independent product evolution**

授权范围**不包括**：

- original Electron Main
- original Preload
- original backend
- 原项目服务端实现
- Seller Cookie / Session / Token
- 密码
- API Key
- 真实账号状态
- 私有用户数据

## 2.3 新项目唯一工作区

所有新项目工作：

`E:\fast_sheep\`

所有**项目可控**的：

- source
- docs
- reports
- tests
- staging
- build outputs
- project caches
- temporary project files
- project-controlled local development state

都必须位于该目录。

项目主动临时目录优先：

`E:\fast_sheep\.tmp\`

允许 OS / tool 自己管理的不可避免路径（例如 Windows TEMP、系统缓存、运行时 userData、外部 PostgreSQL 服务数据）存在于项目根目录之外，但必须满足：

- 不作为 source-of-truth；
- 不成为未披露的构建或运行时依赖；
- 不被误认为项目正式 artifact；
- 若影响测试或可复现性，必须在 task report 中记录。

---

# 3. 22 个母级决策（冻结基础）

## DEC-001 — 商业目标
面向大量商家的标准商业 AI 客服软件，而不是单店自用工具。

## DEC-002 — 产品形态
Windows 桌面客户端 + Fast Sheep Cloud。

- Desktop = Execution Plane
- Cloud = Control Plane

## DEC-003 — 客户策略
从小微商家切入，但架构按中小团队设计。

## DEC-004 — 平台策略
Tier 1：
- 拼多多
- 抖店

工程顺序：
- PDD reference-first
- DouDian parity-second

其它平台后置：
- 千牛
- 京东
- 快手
- 闲鱼

## DEC-005 — AI 回复自动化
分级自动化：

- `HUMAN_ONLY`
- `AI_SUGGEST`
- `AI_AUTO_REPLY`
- `FORCE_HANDOFF`

LLM 无权自行决定自动发送权限；最终由 Automation Policy Engine 决策。

## DEC-006 — 工具执行权限
分级工具权限：

- T0 Read-only
- T1 Low-risk Write
- T2 Business Action
- T3 Financial / Irreversible

执行决策：
- `ALLOW_AUTO`
- `REQUIRE_CONFIRM`
- `DENY`

## DEC-007 — AI Provider
官方 Managed AI + BYOK 混合模式。

- 官方 AI secret 只在 Cloud
- BYOK 第一阶段优先 Desktop → Provider
- BYOK secret 不明文进入普通 SQLite

## DEC-008 — 知识库
分层知识库：

- System / Platform
- Merchant
- Store
- Product
- Conversation Temporary Context

检索原则：
> 先做 scope/filter，再做 vector retrieval。

## DEC-009 — AI 学习
AI 自动发现学习机会，但必须人工审批后才能进入正式知识库。

## DEC-010 — 数据策略
Local-first + 选择性云同步。

## DEC-011 — 权限模型
固定角色 + Capability + Resource Scope。

默认角色：
- Owner
- Admin
- Supervisor
- Agent

## DEC-012 — 商业套餐
基础套餐 + 店铺/席位额度 + AI 用量，由 Entitlement 控制能力。

禁止业务代码写死：
`if plan == "PRO"`。

## DEC-013 — 授权
在线授权 + 有签名的离线宽限期 + 到期后安全降级。

## DEC-014 — 多人协作
第一商业版支持基础多人、多设备协作；复杂客服中心调度后置。

## DEC-015 — 平台凭据
平台身份本地优先；Cloud 只管理 Store / PlatformAccount 登记与连接状态元数据。

## DEC-016 — 遥测与诊断
最小化遥测 + 本地详细脱敏日志 + 用户主动生成/上传诊断包。

## DEC-017 — UI 战略
先还原 FastWork 信息架构和核心 UI，再统一重设计快羊客服自己的 UI / Design System。

## DEC-018 — 第一商业版
核心闭环 MVP，而不是功能齐全型大版本。

## DEC-019 — Cloud 架构
TypeScript Modular Monolith + PostgreSQL；Redis/任务队列等按证据逐步引入。

## DEC-020 — 语言技术栈
Desktop / Cloud 控制面以 TypeScript 为主，AI Worker 保持 Python。

## DEC-021 — Evidence & Decision Protocol
采用五级：

- CONFIRMED
- INFERRED
- PRODUCT_DECISION_REQUIRED
- BLOCKED
- DEFERRED

## DEC-022 — 工程治理
Phase → Milestone → SHEEP Task → Acceptance Gate。

Codex Task 结果：
- COMPLETE
- PARTIAL
- FAIL
- NOT_RUN

Controller 复核：
- PASS
- REPAIR

每轮先提供项目进度卡，再给 exactly one next prompt。

---

# 4. 高层系统架构

```text
                         Fast Sheep Cloud
                       快羊客服云控制面
                               │
       ┌───────────────────────┼────────────────────────┐
       │                       │                        │
 Identity / Merchant      Commercial Control       Shared Coordination
 Account / Membership     Subscription             Store Registry
 Role / Capability        Entitlement              Device
 Offline Lease            Usage Metering           Sync
       │                       │                    Conversation Ownership
       └───────────────────────┼────────────────────────┘
                               │
                       Managed AI Gateway
                               │
                       Versioned HTTPS API
                               │
                 ┌─────────────▼─────────────┐
                 │       快羊客服桌面端         │
                 │       Electron App        │
                 └─────────────┬─────────────┘
                               │
          ┌────────────────────┼──────────────────────┐
          │                    │                      │
  Platform Runtime         Local Data            AI Runtime
  PDD / DouDian            SQLite                Python Worker
  Local Sessions           Sync Outbox           RAG / Skills
  Secure Credentials       Audit                 Tools / Agent
          │                    │                      │
          └────────────────────┴──────────────────────┘
                               │
                 Automation / Tool Permission
                               │
                  AI / Human / Handoff
```

---

# 5. Desktop 架构宪法

## 5.1 安全边界

必须长期保持：

- `contextIsolation = true`
- `nodeIntegration = false`
- `sandbox = true`
- Renderer 不获得 raw `ipcRenderer`
- Renderer 不获得 `fs`
- Renderer 不获得 `child_process`
- Renderer 不直接访问 SQLite
- 平台凭据不暴露给 Renderer

## 5.2 IPC

所有 Renderer → Main 行为必须通过：

> typed IPC / limited Preload bridge

禁止新增无类型、任意字符串通道绕过 contracts。

## 5.3 Worker

AI Worker 继续采用：

> Electron Main ↔ Python Worker via stdin/stdout JSONL RPC

不得为了方便改成 Renderer 直连 Python。

## 5.4 本地数据

桌面端继续以 SQLite 为主要本地结构化数据存储。

数据模型必须逐步引入：

- merchant_id
- store_id
- platform_account_id
- member / seat scope
- sync/version metadata

但不得一次性“大爆炸式重写”所有表；按路线逐阶段迁移并保留可验证 migration。

---

# 6. Cloud 架构宪法

第一阶段：

> **TypeScript Modular Monolith + PostgreSQL**

Cloud 模块：

- Identity
- Merchant
- Membership
- Authorization
- Subscription
- Entitlement
- Device
- Store Registry
- Sync
- Conversation Coordination
- AI Gateway
- Usage Metering
- Telemetry
- Support / Diagnostics

要求：

- 模块边界清楚
- 模块之间通过 domain/service interfaces
- 禁止跨模块到处直接访问其它模块内部表
- API 从第一天版本化，例如 `/api/v1/...`

Redis / Queue：

- 只有真实需求出现才引入
- PostgreSQL 是主要事实源
- Redis 只能作为 cache / short-lived coordination，不得成为唯一不可恢复事实源

---

# 7. 商业 Domain 模型

基础实体：

```text
Account
  ↓
Merchant / Organization
  ↓
Membership
  ↓
Store
  ↓
PlatformAccount
  ↓
Conversation / Customer / Product / Order
```

团队：

```text
Member
  ↓
Role
  ↓
Capabilities
  ↓
Resource Scope
```

第一版 UX 可自动为小商家创建：

- Merchant
- Owner Membership
- Default Seat

但内部不得写死“一账号 = 一店铺”。

---

# 8. Platform Adapter Constitution

AI / Conversation Core 不应知道具体平台字段差异。

统一能力抽象示例：

- receive_message
- send_text
- send_image
- read_customer
- read_product
- read_order
- read_logistics
- read_refund
- send_product_card
- send_order_card
- transfer_human
- add_customer_tag
- add_internal_note

平台 Adapter 负责：

> Platform-specific reality → Fast Sheep normalized domain/capabilities

PDD 作为 reference implementation。
DouDian 用于验证抽象没有被 PDD 假设污染。

---

# 9. Conversation Collaboration Constitution

Conversation 必须支持：

- UNASSIGNED
- AI_ACTIVE
- ASSIGNED / CLAIMED
- ACTIVE
- HANDOFF_REQUIRED
- SUPERVISOR_TAKEOVER
- RELEASED

多人共享 ownership 需要 Cloud 协调。

AI 必须服从 ownership：

- 人工接管后，AI 自动回复暂停
- AI 可继续提供建议（按策略）
- 人工释放后，自动化可按 Policy 恢复

第一版不做：

- 复杂 SLA
- 大规模技能组
- 智能排班
- 百人调度

---

# 10. Automation Policy Engine

自动化决策必须考虑：

- Merchant
- Store
- Platform
- Conversation ownership
- Intent
- Risk
- Customer / Order / Product context
- Knowledge availability
- Tool health
- Merchant policy
- Entitlement

禁止简单用：

`confidence > X => auto send`

代替完整策略。

低可信、知识冲突、关键工具失败、风险升高时必须允许自动降级：

`AI_AUTO_REPLY → AI_SUGGEST → FORCE_HANDOFF`

---

# 11. Tool Framework Constitution

Tool Registry 至少考虑：

- tool_id
- version
- description
- input/output schema
- risk level
- read_only
- platform support
- required capabilities
- confirmation policy
- timeout
- retry
- idempotency
- reversible
- audit_required

Tool 最终授权需要同时满足：

1. Platform capability
2. Merchant policy
3. User / execution identity capability
4. Resource scope
5. Tool risk
6. Automation policy
7. Entitlement
8. Current context

高风险资金/不可逆动作第一商业版默认 `DENY` 自动执行。

---

# 12. AI Provider Constitution

## 12.1 Managed AI

```text
Desktop
  ↓
Fast Sheep Cloud AI Gateway
  ↓
Provider
```

Cloud 负责：

- Provider secret
- routing
- usage
- rate limit
- entitlement
- cost accounting

## 12.2 BYOK

第一阶段优先：

```text
Sandboxed Renderer
  ↓ typed IPC (provider/model selection only)
Main and/or AI Worker
  ↓
User-selected Provider
```

硬规则：

- BYOK Provider 调用必须从 privileged backend boundary（Electron Main 和/或 AI Worker）发起；
- sandboxed Renderer 不得直接持有、读取或发送真实 API Key；
- Renderer 只能通过 typed IPC 选择 Provider / Model、提交业务请求并读取脱敏状态；
- BYOK secret 不明文进入普通 SQLite；
- BYOK secret 通过 SecretStore abstraction 保存；
- 默认不上传 Cloud；
- 不允许为了“方便”把 Key 注入 Renderer localStorage、DOM、console、crash report 或 model-visible prompt。

上层业务统一调用 Provider Gateway，不到处写 provider-specific if/else。

---

# 13. Knowledge Constitution

Knowledge 支持：

- scope
- priority
- effective_from
- effective_to
- status
- source
- version
- provenance

检索：

```text
Conversation Context
  ↓
Resolve Merchant / Store / Platform / Product / Intent
  ↓
Scope Filter
  ↓
Candidate Retrieval
  ↓
Freshness / Priority
  ↓
Rerank
  ↓
Conflict Resolution
  ↓
Context Pack
```

知识使用应能追溯到：

- knowledge_id
- version
- chunk
- source
- score
- scope

---

# 14. Learning Constitution

禁止：

> 对话 → AI 直接写正式知识库

正确：

```text
Conversation / Human Reply / AI Correction
  ↓
Learning Analyzer
  ↓
Learning Candidate
  ↓
Evidence / Scope / Confidence
  ↓
Human Review
  ↓
Approve / Edit / Reject
  ↓
Versioned Knowledge Publish
```

所有审批进入 Audit。

---

# 15. Local-first / Sync Constitution

数据三类：

## Cloud-authoritative
- Account
- Merchant
- Subscription
- Entitlement
- Membership
- Device authorization

## Local-authoritative
- Platform runtime state
- local adapter state
- transient queues
- worker runtime state

## Replicated
- Knowledge
- AI Policies
- Settings
- Learning Candidates
- selected Audit summaries
- team/shared metadata

同步必须通过：

> Sync Engine + Outbox + version + entity-specific conflict policy

禁止业务模块自己散落 sync HTTP calls。

多人 Conversation Ownership 的离线规则属于核心一致性约束：

- 已持有有效 ownership lease 的设备，在既定 lease 规则内可继续处理已拥有会话；
- 离线设备不得新抢占一个其真实 owner 未知的共享 Conversation；
- 网络恢复后必须进行 ownership reconciliation；
- ownership conflict 不得用 blind last-write-wins 静默覆盖；
- 具体 lease 时长/刷新策略属于后续 PRODUCT_DECISION / implementation task，但不得改变上述方向。

---

# 16. Entitlement Constitution

套餐名称与能力解耦。

示例 entitlement：

- MAX_STORES
- MAX_SEATS
- MAX_DEVICES
- PDD_ENABLED
- DOUDIAN_ENABLED
- MANAGED_AI_ENABLED
- BYOK_ENABLED
- AI_AUTO_REPLY_ENABLED
- TOOL_AUTOMATION_ENABLED
- LEARNING_ENABLED
- TEAM_FEATURES_ENABLED
- AUDIT_ENABLED
- MANAGED_AI_MONTHLY_CREDITS
- KNOWLEDGE_STORAGE_LIMIT
- AUDIT_RETENTION_DAYS

代码判断 entitlement，不判断 plan 名称。

Commercial enforcement 必须分层：

- Desktop entitlement check 负责 UX、离线宽限期和本地能力降级；
- Cloud-authoritative 商业能力必须在服务端再次 enforce Entitlement；
- Managed AI、Cloud Sync、Seat/Store/Device limit 等不得只依赖 Electron 客户端自报；
- 客户端传入的 `entitled=true`、plan name、merchant/store ID 均不是可信授权证据。

---

# 17. Signed Offline Lease Constitution

授权状态建议：

- ACTIVE
- OFFLINE_GRACE
- DEGRADED
- REVOKED / BLOCKED

Cloud 私钥签名。
Desktop 只内置验证公钥。

Lease 至少包含：

- merchant_id
- subscription_id
- device_id
- issued_at
- refresh_after
- expires_at
- entitlements
- limits
- lease_version
- signature

需要考虑 clock rollback。

过期后安全降级，不得粗暴锁死商户数据。

---

# 18. Platform Credential Constitution

Cloud 保存：

- Store registry
- PlatformAccount metadata
- connection status
- last health

本地 Secret Store 保存：

- Cookie
- Session
- Token
- 其它平台凭据

禁止默认 Cloud 同步完整 Seller Credential。

登录状态统一状态机建议：

- UNKNOWN
- NEEDS_LOGIN
- AUTHENTICATING
- CONNECTED
- DEGRADED
- SESSION_EXPIRED
- ACCOUNT_RESTRICTED
- DISCONNECTED

---

# 19. Privacy / Telemetry / Diagnostics Constitution

隐私原则：

> Collect only what the feature needs.

## Telemetry
默认只收集最小、非敏感、可聚合的运行指标。任何新增 telemetry field 必须说明用途、scope、retention 与敏感性。

## Local Logs
可比 telemetry 更详细，但必须统一经过 redaction，支持 rotation、retention、可清理；业务模块不得自行绕过脱敏层打印 secret。

## Diagnostics Bundle
由用户主动生成；默认本地保存，上传给 Fast Sheep Support 必须由用户主动确认。

默认不得自动上传：

- 完整聊天正文
- 客户姓名
- 电话/地址
- Cookie
- Token
- API Key
- 完整 Prompt
- 完整订单详情
- Seller session material

## Data Classification
至少区分：

- PUBLIC / PRODUCT
- MERCHANT_INTERNAL
- CUSTOMER_PII
- SELLER_CREDENTIAL
- AI_SECRET
- SECURITY_SENSITIVE

新增 Cloud sync、telemetry、diagnostics、AI Provider context 时必须先判断数据分类。

必须区分：

> Audit（业务证据） ≠ Diagnostics（技术排障） ≠ Telemetry（产品/运行聚合指标）

---

# 20. UI Strategy Constitution

## UI Track A — Reference Restoration
目标：

- 盘点原 Renderer
- 还原信息架构
- 还原核心 Shell / Sidebar / AI / 平台 UI
- 映射 UI 行为
- 重新接 typed IPC

原则：

> Restore first.

Track A 默认是**内部产品考古 / reference baseline**，不是“已获商业分发许可”的最终 UI。任何从 reference tree 复制或高度复用的代码、字体、图标、图片、样式或第三方组件，在进入商业 release 前必须通过 Asset/License Inventory 与 redistribution review。未知许可的资产应在 Track B 重设计/替换，而不是静默进入商业包。

## UI Track B — Fast Sheep Redesign
基于理解后的 reference baseline：

- 统一工作台
- 多店切换
- Conversation-centered IA
- AI / Knowledge / Team / Cloud 融合
- Design System
- Fast Sheep 自己的品牌与产品体验

原则：

> Understand second, redesign third.

---

# 21. 第一商业版 Core Loop MVP

第一商业 MVP 必须真正跑通：

```text
安装
→ 登录 Fast Sheep
→ Merchant
→ 添加 PDD / DouDian Store
→ 平台连接
→ 收到客户消息
→ Conversation Workbench
→ Customer / Product / Order Context
→ Knowledge / RAG
→ AI Suggest / Auto Reply / Handoff
→ Low-risk Tool
→ Human Takeover / Team
→ Audit
→ Local-first Sync
→ 第二天继续正常使用
```

P0 必须包含：

- Account / Merchant
- PDD / DouDian
- Conversation Workbench
- Managed AI + BYOK
- Automation Policy
- Layered Knowledge
- 低风险核心 Tools
- 基础 Team
- Audit
- Local-first
- Diagnostics

P1：
- Learning Candidate / Review
- Supervisor basics
- Usage Metering
- Config Sync
- Prompt/Skill management
- Basic Cloud admin

P2：
- 其它四个平台深度接入
- enterprise SSO
- complex SLA
- skill-group routing
- complete CRM
- full SaaS web console
- high-risk autonomous finance actions
- large-scale BI

---


# 22. Instruction Precedence & Constitution Change Protocol

项目级规则优先级：

1. 当前 active Master Prompt（由 `AGENTS.md` 与 `PROJECT_STATE.json` 指定）中的 Constitution invariants；
2. 已批准且明确 `supersedes` 旧规则的 `DECISIONS.md` / ADR；
3. `PROJECT_STATE.json` 中当前已关闭任务、当前 Phase/Milestone 与 blocker 状态；
4. `FAST_SHEEP_CODING_ROADMAP.md` 的依赖关系与 Acceptance Gate；
5. 当前 SHEEP task prompt；
6. 实现过程中的 INFERRED。

规则：

- task prompt 可以**缩小** scope，但不得绕过或降低 Master Constitution 的安全、隐私、租户隔离、授权、数据与架构硬约束；
- 如确需改变 Master invariant，必须先提出 `PRODUCT_DECISION_REQUIRED`，创建新 DEC，明确 `supersedes`、影响、migration 与 rollout，再更新 Master Prompt；
- Codex 不得以“当前任务更具体”为理由自行覆盖 Constitution；
- Roadmap 可以在 Controller 批准下 split/merge/reorder task，但不得静默改变母级产品原则。

---

# 23. Intellectual Property / Asset License Constitution

Owner 对 reference asset 的项目内查看/参考/还原授权，是项目执行指令；**不得自动视为所有相关资产已具备商业再分发权**。

任何准备进入 Fast Sheep 商业 release 的第三方/原始 UI 或代码资产必须进行 provenance/license classification，至少区分：

- Fast Sheep 原创；
- owner-authorized reference derivative；
- third-party open source；
- font；
- icon pack；
- image/media；
- library/component；
- unknown provenance。

进入商业 release 前必须：

1. 识别来源；
2. 识别适用 license / redistribution 条件；
3. 满足 attribution / notice / source-offer 等要求（如适用）；
4. 对 commercial redistribution 状态未知的资产进行替换、重设计或专项 review。

未知商业再分发状态：

> `PRODUCT_DECISION_REQUIRED / LEGAL_OR_LICENSE_REVIEW_REQUIRED`

禁止：

- 把“owner 允许参考”写成“法律许可已确认”；
- 因 Track A 还原成功就默认将所有原始视觉资产直接进入最终商业安装包；
- 删除第三方 copyright/license notice 以“看起来更像自有代码”。

---

# 24. Multi-Tenant Isolation Constitution

Fast Sheep Cloud 是多商户系统。Merchant isolation 是服务端安全边界，不是 UI 过滤条件。

所有 Cloud-owned business resource 必须拥有 authoritative tenant scope，并在 server-side 强制校验：

```text
Authenticated Identity
  ↓
Membership
  ↓
Capability
  ↓
Resource Scope
  ↓
Authoritative Merchant / Store Resource
```

规则：

- Cross-merchant access = DENY by default；
- 不得仅因为客户端提供了 `merchant_id` / `store_id` 就认定其有权访问；
- 资源所属 Merchant/Store 必须由服务端 authoritative data 解析；
- 每个新的 Cloud merchant-data module 必须有 cross-merchant negative tests；
- error response 不得泄露另一商户敏感存在性或内容；
- background job、sync、AI Gateway、support tooling 同样遵守 tenant isolation；
- “内部服务调用”不是绕过 tenant authorization 的理由。

任何可能造成跨 Merchant 数据访问的实现属于 P0 security defect。

---

# 25. Merchant Data Governance Constitution

商户业务数据是商户的业务数据；Fast Sheep 必须为其建立明确、可解释的数据生命周期。

必须逐步具备明确 policy 的领域：

- data export
- member removal
- device revocation
- account deletion
- merchant deletion
- local data cleanup
- cloud data cleanup
- sync tombstone
- backup retention
- log retention
- audit retention
- knowledge retention

规则：

- 删除/保留策略属于 `DATA` Decision Gate；
- 不得通过“直接删表/目录”实现不可审计的 destructive deletion；
- 删除必须考虑 Local SQLite、Cloud PostgreSQL、sync replicas、backups、logs、diagnostics、object storage（如未来引入）；
- 合理范围内支持商户导出自己的业务数据；
- 不得通过授权到期阻止商户访问/导出其已有业务数据；
- retention 具体天数未决时，必须标记 `PRODUCT_DECISION_REQUIRED`，不得自行拍脑袋永久保存或立即删除。

---

# 26. AI Data Handling & Untrusted Input Constitution

任何发送到 AI Provider、Embedding Provider、Reranker、Moderation/OCR 等外部 AI 服务的数据，都属于**外部数据披露边界**。

调用前必须遵守：

1. Minimum Necessary Context：只发送完成当前任务必要的数据；
2. Data Classification：识别 PII / merchant internal / credential / security-sensitive；
3. Redaction：移除不必要的敏感字段；
4. Provider Transparency：知道数据发送到哪个 Provider / Region / Mode；
5. Merchant Policy：遵守 Merchant 的 Managed AI / BYOK / privacy policy；
6. Auditability：高价值 AI 决策可追踪 Provider、Model、Policy 与 context provenance。

硬规则：

- Seller Credential、API Secret、password、session token 默认永不进入 model-visible context；
- customer name/phone/address/order 等 PII 只有业务必要时才可进入 Provider context，并必须遵守当前产品隐私 policy；
- Managed AI 与 BYOK 的数据流向必须在产品层透明，不得静默改变 Provider；
- Provider failure 时不得静默切换到会改变费用或数据披露路径的其它 Provider，除非 Merchant policy 已明确允许；
- embeddings / reranking 等同样适用本节，不得只管聊天模型。

## Untrusted Input

以下一律视为 untrusted input：

- customer messages
- retrieved knowledge
- product descriptions
- seller platform page content
- uploaded documents
- external web/data content

Untrusted content 不得：

- 提升系统权限；
- 改变 Capability；
- 改变 Tool Permission；
- 绕过 Automation Policy；
- 获取 secret；
- 重定义 tool schema；
- 要求系统忽略 system/merchant policy。

Tool 参数必须经过结构化 schema validation，不因自然语言指令跳过权限检查。

---

# 27. Audit & Traceability Constitution

Audit 是业务证据，不等于 diagnostics/logging。

至少以下关键行为必须产生结构化 Audit 或等价可追踪证据：

- AI reply decision
- Automation Policy decision
- Handoff decision
- Conversation ownership change
- Tool request
- Tool permission decision
- Tool human confirmation/rejection
- Tool execution result
- Knowledge retrieval provenance
- Knowledge candidate approval/edit/rejection
- important authorization/entitlement decision
- Sync conflict resolution
- security-sensitive configuration change

AI / Agent Audit 至少应能回答：

- 哪个 merchant/store/conversation？
- actor 是 human、AI 还是 system？
- 为什么做出该 decision？
- 使用哪个 policy version？
- 使用哪个 provider/model？
- 使用哪个 prompt/skill version？
- 使用哪些 knowledge refs？
- 调用了哪些 tools？
- 最终是 auto、confirm、deny 还是 handoff？

推荐关联字段：

- correlation_id
- request_id
- agent_run_id
- tool_call_id
- sync_operation_id

关键流程应尽量能够跨 Desktop → Cloud → Worker → Tool 关联。

Audit retention 属于 DATA/Commercial policy，不得与普通 debug log retention 混为一谈。

---

# 28. Platform Commercial Compliance Constitution

平台接入必须区分：

> `TECHNICALLY_WORKING` ≠ `COMMERCIALLY_SUPPORTED`

原则：

- 优先使用平台官方 API、SDK、开放平台能力或正常用户可操作机制；
- 不以 anti-bot bypass、stealth、fingerprint spoofing、CAPTCHA/2FA 自动绕过作为商用能力；
- 技术实现通过测试，不代表平台条款、账号政策或商业使用条件已满足。

任何平台升级为 `COMMERCIAL_SUPPORTED` 前必须有独立 compliance gate，至少检查：

- 当前平台规则/开放能力；
- authentication / credential handling；
- automation 行为；
- message/tool action 风险；
- 禁止或受限自动化；
- 商业账号适用性。

规则或许可不明确：

> `PRODUCT_DECISION_REQUIRED / PLATFORM_COMPLIANCE_REVIEW_REQUIRED`

不要为了 Roadmap 进度把一个只有技术 smoke 的 adapter 宣称为“正式商业支持”。

---

# 29. Release / Update / Compatibility Constitution

Fast Sheep 是长期运行的 Windows 商业桌面软件，版本兼容与升级属于核心架构，不是 release 阶段临时补丁。

必须逐步建立：

- semantic application version；
- Cloud API compatibility policy；
- minimum supported client version；
- supported / deprecated / blocked client states；
- DB migration policy；
- config migration policy；
- upgrade smoke；
- rollback/recovery strategy。

硬规则：

- 不做 silent destructive migration；
- schema/config upgrade 必须可验证；
- 风险 migration 前必须创建或验证可恢复备份；
- Cloud 不得假设所有 Desktop 同时升级；
- security-critical mandatory update、recommended update、optional update 应有可区分机制；
- 更新失败不得破坏商户已有业务数据。

---

# 30. Backup / Recovery Constitution

Local-first 意味着 Fast Sheep 对本地关键业务数据的恢复能力负有明确工程责任。

必须逐步建立：

- automatic rotating local backup；
- manual backup；
- restore；
- backup metadata / schema version；
- migration-before-backup gate；
- restore compatibility smoke。

规则：

- 关键 destructive/risky migration 前必须创建或验证 recoverable backup；
- backup 不得包含由 SecretStore 管理的 plaintext secret；
- 恢复能力必须通过测试证明，不得仅因为“存在备份文件”就认为可恢复；
- Cloud 未来的 PostgreSQL / object storage 也必须有独立 backup/recovery policy；
- backup retention 是 DATA Decision Gate。

---

# 31. Software Supply Chain / Third-Party License Constitution

商业 release 必须能够解释其依赖、来源与许可。

逐步建立：

- dependency pinning / lockfile discipline；
- third-party dependency inventory；
- third-party license / notice inventory；
- UI font/icon/image provenance；
- vulnerability/security audit；
- 商业 RC 阶段的 SBOM 或等价 dependency manifest（成熟阶段要求）。

规则：

- unknown provenance/license dependency 不得静默进入商业 release；
- 不为了“修一个 UI”随意引入大型 framework/component library；
- dependency major upgrade 必须是独立 task；
- build/runtime dependency 必须可追溯；
- 发现高风险 vulnerability 时进入 `BLOCKED` 或 security decision，而不是只记录 warning 后继续商业发布。

---

# 32. Evidence & Decision Protocol

所有发现必须分类。

## CONFIRMED
直接可靠证据。
→ 可实施。

## INFERRED
证据不完整但低风险、可逆、不改变产品方向。
→ 可最小实施，必须记录依据。

## PRODUCT_DECISION_REQUIRED
影响：
- 产品行为
- 商业
- Money
- Security
- Privacy
- Data
- Automation
- 长期 Architecture
- 核心 IA

→ 不得实施被决策部分。
→ 生成 Decision Package。
→ 完成其它独立工作后返回 PARTIAL。

## BLOCKED
客观条件缺失。
→ 不得伪造。
→ 给出 smallest next validation。
→ PARTIAL / FAIL。

## DEFERRED
存在但不属于当前任务。
→ 写入 backlog。
→ 不顺手实现。

---

# 33. 强制 Decision Gates

以下没有直接证据或 owner 决策时，禁止猜：

## MONEY
退款、赔付、优惠、收费、计量、Billing。

## SECURITY
Cookie、Token、API Key、Credential、登录、Session 迁移。

## DATA
Cloud 上传范围、删除、保留、隐私、迁移。

## AUTOMATION
自动发送、自动 Tool、Handoff、自动学习生效。

## PRODUCT
删除/合并核心功能、重大用户流程、核心信息架构。

## ARCHITECTURE
新语言、新 DB、新微服务、新队列、改变 Local-first、改变 Desktop/Cloud 边界。

---

# 34. Decision Package 格式

遇到 `PRODUCT_DECISION_REQUIRED`：

```text
DECISION ID:
Status: PRODUCT_DECISION_REQUIRED

Question:
Why It Matters:

Confirmed Evidence:
Unknown:

Original Reference Evidence:
Current Fast Sheep Architecture:

Options:
A.
B.
C.

Recommended Option:
Recommendation Reason:

Reversibility:
LOW / MEDIUM / HIGH

Implementation Performed:
NO

Blocked Tasks:
```

---

# 35. 工程任务生命周期

四级结构：

```text
Phase
  ↓
Milestone
  ↓
SHEEP Task
  ↓
Acceptance Gate
```

一个 task 只推进一个 Acceptance Unit。

Codex Task Result：

- COMPLETE
- PARTIAL
- FAIL
- NOT_RUN

Controller Review：

- PASS
- REPAIR

只有 Controller PASS，任务才真正关闭。

---

# 36. 统一报告要求

每个 task 至少报告：

- task
- result
- phase
- milestone
- objective
- completed_requirements
- total_requirements
- blockers
- decisions_required
- deferred_items
- tests
- smokes
- modified_files
- architecture_changes
- security_changes
- data_model_changes
- evidence_summary
- tenant_isolation_changes
- ai_data_disclosure_changes
- audit_traceability_changes
- third_party_or_license_changes
- next_stage_not_executed

任务不得自己决定 Overall Project Progress。

---

# 37. 项目状态治理

Phase 0 bootstrap 完成后，下列治理文件为 **REQUIRED**：

`E:\fast_sheep\project\PROJECT_STATE.json`

以及：

`E:\fast_sheep\project\DECISIONS.md`

在 Phase 0 自身尚未创建这些文件之前允许 bootstrap exemption；一旦 `GATE-P0-GOVERNANCE` 通过，后续任务缺失任一文件都必须返回 PARTIAL。

`PROJECT_STATE.json` 维护：

- current phase
- milestone
- last closed task
- next task
- weighted overall progress
- open blockers
- open decisions
- deferred items

`DECISIONS.md` 记录重要产品/架构决策。

任何推翻已锁定决策必须：

- 创建新 DEC
- 指明 supersedes
- 原因
- 影响
- migration required

---

# 38. 总控进度反馈格式

Controller 每次审查 Codex 结果后先输出：

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

然后才提供 exactly one next prompt。

---

# 39. 商业安全底线

禁止：

- 明文保存敏感 API Key / Seller Credential 于普通数据库
- 日志打印 Cookie / Token / Key
- AI 权限超过当前用户 / Merchant / Store scope
- LLM 自行获得资金动作权限
- 自动学习直接污染正式知识库
- Cloud 默认集中收集 Seller Cookie
- Renderer 降低 sandbox 以迁移 UI
- 为了复现原产品而复制不在 owner 授权范围内的敏感资产或业务 secret
- 测试访问真实账户时自动执行 CAPTCHA/2FA 绕过、反爬绕过、stealth/fingerprint spoofing
- 允许客户消息、知识文本、网页内容或外部文档修改系统权限、Tool Permission、Automation Policy 或 secret boundary
- 把 Seller Credential、API Secret 或无关 PII 注入 LLM 可见上下文
- 仅依赖客户端 UI/Entitlement flag 作为 Cloud 商业授权安全边界

---

# 40. Definition of Done

任务 COMPLETE 必须满足：

1. REQUIRED outputs 全部存在。
2. 实现与 sole objective 一致。
3. 必需 tests PASS。
4. 必需 integration / smoke PASS。
5. 必需 negative tests PASS。
6. 安全边界未弱化。
7. 不存在未披露的 INFERRED。
8. PRODUCT_DECISION_REQUIRED 未被擅自实现。
9. BLOCKED 未被伪装成 PASS。
10. 相关报告完整。
11. 未越过当前 task scope。
12. 如涉及 Cloud merchant data，cross-merchant negative tests PASS。
13. 如涉及 AI Provider / sync / telemetry / diagnostics，data-disclosure boundary 已明确并通过相应验证。
14. 如涉及第三方/原始资产进入 commercial distribution，license/provenance gate 已满足或明确阻塞。
15. 如涉及关键业务决策、Tool、Automation、Knowledge publish、ownership 或 authorization，Audit/traceability 要求已满足。
16. `next_stage_not_executed = true`。

---

# 41. 最终工作原则

> **Evidence before assumption.**  
> **Policy before automation.**  
> **Architecture before scale.**  
> **Restore before redesign.**  
> **Simple by default, scalable by design.**  
> **Local-first, cloud-coordinated where necessary.**  
> **AI can work aggressively, but authority belongs to merchant policy.**  
> **One verifiable step at a time.**


---

# 42. Review-1 Owner Approval Record

**Owner Approval Status:** APPROVED  
**Approval Date:** 2026-08-22  
**Approved Master Version:** V1.0

The Release Owner explicitly approved the Review-1 commercial principles:

1. **UI / Asset License**：Track A may be used as an internal reference-restoration baseline, but assets with unknown redistribution/license status do not automatically enter a commercial release; they require review, replacement, or redesign.
2. **Merchant Data Ownership**：Merchant business data must have explicit export/deletion/retention/recovery policies; subscription expiry must not be used to withhold access to existing merchant data.
3. **Managed AI / BYOK Data Disclosure**：Only minimum necessary context is sent; secrets are excluded from model-visible context by default; Managed AI and BYOK data flows must be transparent.
4. **Platform Compliance**：Technical integration success is not equivalent to commercial support; platform compliance gates are required before `COMMERCIALLY_SUPPORTED`.
5. **Update / Migration Safety**：No destructive silent migration; upgrades require compatibility, backup, recovery, and validation.
6. **Backup / Recovery**：Critical Local-first business data must have a tested backup and restore path.

Governance status after Owner Approval:

- `Governance Dry Run 001` = PASS;
- `GOV-REPAIR-001` = PASS / CLOSED;
- `Governance Repair Verification 001` = PASS;
- `GOV-REPAIR-002` = APPLIED / CLOSED;
- `FAST_SHEEP_MASTER_PROMPT V1.0` = APPROVED.

Next governance stages:

1. Review 2 — `FAST_SHEEP_CODING_ROADMAP.md`;
2. Review 3 — `FAST_SHEEP_CODEX_TASK_TEMPLATE.md`;
3. Final Governance Freeze;
4. only then may `SHEEP-001` start.

Master approval does **not** itself start implementation.
