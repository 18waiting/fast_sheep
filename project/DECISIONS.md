# DECISIONS.md — Fast Sheep Locked Product & Architecture Decisions

> Project: 快羊客服 / fast_sheep  
> Project root: `E:\fast_sheep\`  
> Status: Initial locked decision set before coding  
> Rule: Codex MUST NOT silently override a locked decision. Any change requires a new decision that explicitly supersedes the old one, with reason, impact, and migration implications.

---

## Decision Status Vocabulary

- **LOCKED** — owner has approved this direction.
- **SUPERSEDED** — replaced by a later approved decision.
- **PENDING** — not yet decided.
- **DEFERRED** — intentionally postponed.

---

## DEC-001 — Commercial Product Goal
**Status:** LOCKED

Fast Sheep is a standard commercial AI customer-service product intended to be sold to many merchants, not a personal single-shop utility.

---

## DEC-002 — Product Form
**Status:** LOCKED

Use a hybrid architecture:

- Windows Desktop Client = Execution Plane
- Fast Sheep Cloud = Control Plane

---

## DEC-003 — Target Customer Strategy
**Status:** LOCKED

Start with small/micro merchants for usability and go-to-market, while designing the underlying architecture for small and mid-sized ecommerce teams.

Principle:

> Simple by default, scalable by design.

---

## DEC-004 — Platform Strategy
**Status:** LOCKED

Tier-1 commercial platform focus:

1. PDD
2. DouDian

Engineering order:

- PDD reference-first
- DouDian parity-second

JD / Qianniu / Kuaishou / Xianyu are later expansion platforms.

---

## DEC-005 — Reply Automation
**Status:** LOCKED

Use graded automation:

- `HUMAN_ONLY`
- `AI_SUGGEST`
- `AI_AUTO_REPLY`
- `FORCE_HANDOFF`

An LLM does not self-authorize automatic sending. Automation Policy decides.

---

## DEC-006 — Tool Permission Model
**Status:** LOCKED

Use graded tool permissions/risk:

- T0 Read-only
- T1 Low-risk Write
- T2 Business Action
- T3 Financial / Irreversible

Final decisions:

- `ALLOW_AUTO`
- `REQUIRE_CONFIRM`
- `DENY`

---

## DEC-007 — AI Provider Strategy
**Status:** LOCKED

Support both:

- Fast Sheep Managed AI
- BYOK

Managed provider secrets stay Cloud-side.
BYOK secrets remain local by default and are protected through SecretStore.

---

## DEC-008 — Knowledge Architecture
**Status:** LOCKED

Use layered knowledge:

1. System / Platform
2. Merchant
3. Store
4. Product
5. Conversation Temporary Context

Retrieval must scope/filter before vector retrieval.

---

## DEC-009 — Learning Model
**Status:** LOCKED

AI may automatically discover learning candidates, but candidates require human review before becoming approved production knowledge.

---

## DEC-010 — Data Strategy
**Status:** LOCKED

Use:

> Local-first + selective cloud synchronization.

Data must be classified as Cloud-authoritative, Local-authoritative, or Replicated.

---

## DEC-011 — Roles and Authorization
**Status:** LOCKED

First version exposes fixed roles:

- Owner
- Admin
- Supervisor
- Agent

Underlying authorization uses:

> Capability + Resource Scope

Do not make long-term authorization depend on `if role == ...` logic.

---

## DEC-012 — Commercial Packaging / Entitlement Model
**Status:** LOCKED

Use:

> Base plan + Store/Seat quotas + Managed AI usage + Entitlements.

Plan names are not application authorization logic.
Features are driven by Entitlements.

---

## DEC-013 — License / Offline Authorization
**Status:** LOCKED

Use:

> Online authorization + signed offline grace lease + safe degradation after expiry.

Cloud owns signing private key.
Desktop validates using public key.

---

## DEC-014 — Multi-user / Multi-device MVP
**Status:** LOCKED

The first commercial version supports basic multi-user and multi-device collaboration.

Required architectural concepts include:

- conversation ownership
- claim/release
- handoff
- supervisor takeover
- basic presence/coordination

Complex call-center scheduling and workforce management are deferred.

---

## DEC-015 — Seller Platform Identity
**Status:** LOCKED

Seller/platform identity is local-first.

Cloud stores:

- Store registration
- PlatformAccount metadata
- connection/health metadata

Seller cookies, sessions and tokens are not centrally cloud-synchronized by default.

---

## DEC-016 — Telemetry / Logs / Diagnostics
**Status:** LOCKED

Use:

- minimal default telemetry
- detailed local redacted logs
- user-triggered diagnostics package/upload

Audit, diagnostics and telemetry are distinct systems.

---

## DEC-017 — UI Product Strategy
**Status:** LOCKED

Two-track UI strategy:

### Track A
Restore FastWork information architecture and core UI as a reference baseline.

### Track B
Redesign into Fast Sheep's own commercial information architecture and Design System.

Principle:

> Restore first, understand second, redesign third.

Reference restoration does not automatically grant commercial redistribution rights for every asset.

---

## DEC-018 — First Commercial MVP
**Status:** LOCKED

Use a Core Loop MVP.

P0 commercial loop centers on:

- Account / Merchant
- PDD + DouDian
- Conversation Workbench
- Managed AI + BYOK
- Automation Policy
- Layered Knowledge / RAG
- low-risk tools
- basic Team
- Audit
- Local-first data/sync foundation
- Diagnostics

Do not block first commercial MVP on every future enterprise feature.

---

## DEC-019 — Cloud Architecture
**Status:** LOCKED

First cloud architecture:

> TypeScript Modular Monolith + PostgreSQL.

Redis, queues, search systems and service extraction are introduced only after evidence demonstrates a need.

---

## DEC-020 — Language Strategy
**Status:** LOCKED

- Desktop / Cloud control plane: TypeScript
- AI Worker: Python

Do not introduce additional primary languages without evidence and an approved architecture decision.

---

## DEC-021 — Evidence & Decision Protocol
**Status:** LOCKED

All material findings are classified as:

- `CONFIRMED`
- `INFERRED`
- `PRODUCT_DECISION_REQUIRED`
- `BLOCKED`
- `DEFERRED`

Important unknowns affecting money, security, privacy, data, automation, product behavior or long-term architecture require a Decision Package rather than Codex guessing.

---

## DEC-022 — Engineering Governance
**Status:** LOCKED

Project execution structure:

> Phase → Milestone → SHEEP Task → Acceptance Gate

Codex task results:

- COMPLETE
- PARTIAL
- FAIL
- NOT_RUN

Controller review decisions:

- PASS
- REPAIR

Only Controller PASS closes a SHEEP task.

Each controller turn should:
1. show current project progress/status;
2. review evidence;
3. decide PASS/REPAIR;
4. provide exactly one next task when appropriate.

---

## DEC-023 — AI-First Product Identity
**Status:** LOCKED
**Decision package:** Product Alignment Package 1, 2026-09-16

Fast Sheep is an:

- AI-first
- multi-shop-ready
- future multi-platform
- ecommerce customer-service automation product

Primary customer value:

> Reduce required human customer-service work safely.

Fast Sheep is not primarily a PDD embedded-workbench/UI product.

Stable product identity is owned by `docs/product/FAST_SHEEP_NORTH_STAR.md`.

---

## DEC-024 — PDD Adapter and Transport Role
**Status:** LOCKED
**Decision package:** Product Alignment Package 1, 2026-09-16

PDD is the first Platform Adapter / Transport Runtime.

The embedded PDD workbench is:

- transport infrastructure
- authentication/session infrastructure
- diagnostic/fallback surface

It is not the primary product experience.

This decision supplements DEC-004 and does not remove PDD's Tier-1
reference-first engineering role. It changes product framing, not the platform
tier order or UI asset/license rules.

---

## DEC-025 — Identity, Fact, and Action Safety Priority
**Status:** LOCKED
**Decision package:** Product Alignment Package 1, 2026-09-16

The global identity/fact/action safety hierarchy is adopted as locked policy.

Detailed definitions are owned by
`docs/product/FAST_SHEEP_NORTH_STAR.md` §7 and must not be duplicated here.
This decision locks the priority: target identity and fact/action correctness
outrank wording variance, and AI confidence never grants execution authority.
---

## DEC-026 — UNKNOWN and Uncertain Outcome Semantics
**Status:** LOCKED
**Decision package:** Product Alignment Package 1, 2026-09-16

UNKNOWN handling and uncertain-outcome behavior are locked globally.

Canonical detailed semantics are owned by
`docs/product/FAST_SHEEP_NORTH_STAR.md` §7. PDD-specific operational
consequences are owned by `docs/product/PDD_MVP_V1.md` §7. UNKNOWN is not to be
guessed away, and uncertain execution must not retry automatically.
---

## DEC-027 — Multi-Shop-Ready Architecture / One-Shop Initial Rollout
**Status:** LOCKED
**Decision package:** Product Alignment Package 1, 2026-09-16

Architecture must be multi-shop ready from the start.

The initial real rollout is one controlled PDD shop.

Shop, session, customer, knowledge, policy, and audit boundaries remain
logically isolated.

One-shop success does not prove multi-shop isolation.

AI Core, Policy, Knowledge, and Audit should not require platform-specific
rewrites merely because a new platform adapter is introduced.

---

## DEC-028 — RolloutMode Semantics
**Status:** LOCKED
**Decision package:** Product Alignment Package 1, 2026-09-16

The `RolloutMode` model is adopted for PDD V1: `OFF`, `SHADOW`,
`HUMAN_CONFIRM`, and `AUTO`.

Canonical detailed definitions, the conceptual mapping to the existing runtime
automation vocabulary, and the configuration hierarchy are owned by
`docs/product/PDD_MVP_V1.md` §§3-4. This decision locks adoption by reference
and supplements DEC-005 without replacing the existing runtime automation
model. `FORCE_HANDOFF` remains a runtime safety/escalation override.
---

## DEC-029 — Human Notification V1
**Status:** LOCKED
**Decision package:** Product Alignment Package 1, 2026-09-16

V1 human handoff/intervention notification channel:

> Fast Sheep desktop notification.

Enterprise WeChat, mobile, and other notification channels are later backlog.

---

## DEC-030 — V1 Knowledge Authority and Historical Conversation Boundary
**Status:** LOCKED
**Decision package:** Product Alignment Package 1, 2026-09-16

PDD V1 knowledge authority is locked by reference.

The concrete authoritative-source inventory and the historical-conversation
boundary are owned by `docs/product/PDD_MVP_V1.md` §6. Historical conversations
are not V1 authoritative truth.
---

## DEC-031 — PDD Surface Diagnostic/Fallback Role and Product Direction Guard
**Status:** LOCKED
**Decision package:** Product Alignment Package 1, 2026-09-16

The original PDD surface is diagnostic/fallback infrastructure.

Raw PDD UI work is current priority only when it:

- enables the AI customer-service loop
- removes a Transport/runtime blocker
- is explicitly authorized diagnostic/fallback work

Otherwise the task decision is:

`PRODUCT_DIRECTION_MISMATCH`

Before substantial implementation, Codex must produce the product-alignment
block required by `AGENTS.md`.

---

## DEC-032 — SHEEP-091 Pause and Governed Roadmap V1.1 Requirement
**Status:** LOCKED
**Decision package:** Product Alignment Package 1, 2026-09-16

`SHEEP-091` remains:

`NOT_STARTED / PAUSED`

Reason:

Controller is re-aligning future execution to the AI-first MVP.

PDD Product/SKU Context remains potentially useful future work, but it is not
automatically resumed merely because it is next in the historical Roadmap.

The reviewed Roadmap and Task Template remain unchanged in Product Alignment
Package 1. A governed Roadmap V1.1 revision is required after the product
authority is accepted.

---
## DEC-033 — IdentityLock Architecture
**Status:** LOCKED
**Decision package:** Product Alignment Package 2, 2026-09-16

The AI-first architecture adopts an immutable IdentityLock for replies and
future actions.

Canonical detailed semantics are owned by
`docs/architecture/AI_CUSTOMER_SERVICE_CORE.md` and
`docs/architecture/REPLY_AND_ACTION_SAFETY.md`.

For PDD, `customerUid` remains the platform customer identity and is distinct
from the internal conversation identity.

---

## DEC-034 — ReplyPlan Evolution / No Duplicate Reply Model
**Status:** LOCKED
**Decision package:** Product Alignment Package 2, 2026-09-16

ReplyPlan is the governed evolution/replacement direction of the existing
Suggestion and SendRequest structures.

Canonical detailed ownership is recorded in
`docs/architecture/AI_CUSTOMER_SERVICE_CORE.md`. No competing second canonical
reply model is permitted.

---

## DEC-035 — AI Proposes / Deterministic Code Executes
**Status:** LOCKED
**Decision package:** Product Alignment Package 2, 2026-09-16

AI proposes ReplyPlan or ActionPlan output. It does not directly execute
platform side effects.

Deterministic application code owns policy authorization and execution.
Detailed boundaries are owned by
`docs/architecture/AI_CUSTOMER_SERVICE_CORE.md` and
`docs/architecture/REPLY_AND_ACTION_SAFETY.md`.

---

## DEC-036 — PlatformAdapter Hides Transport Implementation
**Status:** LOCKED
**Decision package:** Product Alignment Package 2, 2026-09-16

The product-level PlatformAdapter boundary hides implementation-private
transport details.

Canonical detailed semantics are owned by
`docs/architecture/PLATFORM_ADAPTER_CONTRACT.md`.

DOM selectors, WebContents mechanics, page bridge messages, fixture mechanics,
and official API payloads remain implementation-private.

---

## DEC-037 — Separate Transport Strategy Deferred
**Status:** LOCKED
**Decision package:** Product Alignment Package 2, 2026-09-16

A mandatory separate transport-strategy architecture is not introduced for the
current MVP.

For the current PDD MVP, the PlatformAdapter implementation may encapsulate the
embedded-runtime transport.

A separate transport strategy may be extracted only when a real second
transport exists or evidence proves the need. Detailed ownership is recorded in
`docs/architecture/PLATFORM_ADAPTER_CONTRACT.md`.

---

## DEC-038 — Uncertain Side-Effect Retry Prohibition
**Status:** LOCKED
**Decision package:** Product Alignment Package 2, 2026-09-16

When an execution attempt may have caused a platform side effect, automatic
retry is prohibited.

A safe pre-attempt or authoritatively `NOT_ATTEMPTED` failure may become
retryable only under future explicit policy.

Canonical architecture semantics are owned by
`docs/architecture/REPLY_AND_ACTION_SAFETY.md`.

Current implementation gap: `ConversationOrchestrator.performSend` retries a
failed send once. This must be reconciled before production AUTO.

---

## DEC-039 — Multi-Shop AUTO Isolation Precondition
**Status:** LOCKED
**Decision package:** Product Alignment Package 2, 2026-09-16

Multi-shop AUTO is not considered safe until production orchestration,
worker identity scope, knowledge/context scope, audit/handoff scope, and
adversarial cross-shop isolation have been resolved and validated.

Canonical detailed precondition ownership is recorded in
`docs/architecture/AI_CUSTOMER_SERVICE_CORE.md` and
`docs/architecture/REPLY_AND_ACTION_SAFETY.md`.

---

## DEC-040 — Package 2 Architecture Authority Ownership
**Status:** LOCKED
**Decision package:** Product Alignment Package 2, 2026-09-16

Architecture authority ownership is established as:

- `docs/architecture/AI_CUSTOMER_SERVICE_CORE.md`
- `docs/architecture/PLATFORM_ADAPTER_CONTRACT.md`
- `docs/architecture/REPLY_AND_ACTION_SAFETY.md`

Each document owns only the boundaries stated in its header. Product identity,
RolloutMode definitions, constitutional rules, and current authorization state
remain with their existing canonical owners.

---
## DEC-041 — Roadmap V1.1 Supersedes V1.0 as Current Execution Authority
**Status:** LOCKED
**Decision package:** AI-First Roadmap V1.1 Migration, 2026-09-17

`FAST_SHEEP_CODING_ROADMAP_V1.1_REVIEWED.md` becomes the current execution
authority. `FAST_SHEEP_CODING_ROADMAP_V1.0_REVIEWED.md` remains immutable
historical reviewed governance.

---

## DEC-042 — V1.0 Historical Task IDs Remain Immutable
**Status:** LOCKED
**Decision package:** AI-First Roadmap V1.1 Migration, 2026-09-17

All V1.0 task definitions and IDs remain immutable and are not reused or
redefined. Unfinished V1.0 IDs `SHEEP-091` through `SHEEP-281` are classified
as `DEFERRED_HISTORICAL_V1_0` unless explicitly migrated by reference.

---

## DEC-043 — New Execution Block Begins at SHEEP-300
**Status:** LOCKED
**Decision package:** AI-First Roadmap V1.1 Migration, 2026-09-17

The AI-first execution plan uses a new validator-compatible task block
beginning at `SHEEP-300`. Historical IDs `091–281` are not reused.

---

## DEC-044 — SHADOW Is the First Real Customer-Data Milestone
**Status:** LOCKED
**Decision package:** AI-First Roadmap V1.1 Migration, 2026-09-17

The first real customer-data milestone is SHADOW:

real PDD inbound -> canonical IdentityLock -> durable normalized message ->
aggregation -> scene -> ContextEnvelope -> AI ReplyPlan -> deterministic policy
-> persistent audit, with `TRANSPORT SEND CALLS = 0`.

---

## DEC-045 — HUMAN_CONFIRM Precedes AUTO and Requires Retry Safety
**Status:** LOCKED
**Decision package:** AI-First Roadmap V1.1 Migration, 2026-09-17

HUMAN_CONFIRM precedes AUTO. The
`ConversationOrchestrator.performSend()` automatic-retry conflict must be
resolved before the first real production send, and wrong-target pre-send
validation is mandatory.

---

## DEC-046 — AUTO Requires Separate Production Authorization
**Status:** LOCKED
**Decision package:** AI-First Roadmap V1.1 Migration, 2026-09-17

Completing AUTO implementation tasks does not authorize production AUTO.
AUTO requires a separate Controller production authorization after all
identity, wrong-target, retry, verification, audit, escalation, and isolation
prerequisites pass.

---

## DEC-047 — SHEEP-091 Is Deferred Rather Than Resumed
**Status:** LOCKED
**Decision package:** AI-First Roadmap V1.1 Migration, 2026-09-17

`SHEEP-091` remains `NOT_STARTED / PAUSED / DEFERRED_HISTORICAL_V1_0`.

Product/SKU Context is not required by default for the first `SHIPPING_TIME`
scene and may be reconsidered only if the approved SHIPPING_TIME rule explicitly
requires product-level exceptions.

---
# Operational Reference Sources

These are not new product decisions; they define currently available evidence sources.

## REF-001 — Frozen Rebuild Baseline
`E:\ai客服数据\FastWork\rebuild\`

Classification:

`READ_ONLY_VALIDATED_TECHNICAL_BASELINE`

## REF-002 — Authorized Renderer Reference
`E:\ai客服数据\FastWork_asar_extracted\dist\renderer\`

Classification:

`READ_ONLY_OWNER_AUTHORIZED_UI_REFERENCE`

Commercial redistribution/license status must be reviewed separately.

## REF-003 — Reverse-engineering Evidence Repository
`E:\nixiang\`

Classification:

`READ_ONLY_POTENTIAL_EVIDENCE_SOURCE / NOT_YET_CLASSIFIED`

Before broad use, perform a dedicated inventory/classification task.

Do not migrate:
- credentials
- cookies
- tokens
- passwords
- API keys
- real seller sessions
- private user data

---

# Pending Governance Item

## GOV-OWNER-REVIEW-001 — Master Prompt V1.0 Owner Approval
**Status:** APPROVED / CLOSED

On 2026-08-22, the Release Owner explicitly approved:

`FAST_SHEEP_MASTER_PROMPT V1.0`

The six Review-1 owner points are accepted.

This closes Review 1 — Master Prompt.
Formal coding remains blocked until Review 2, Review 3, and Final Governance Freeze are complete.

## GOV-DRYRUN-001 — Governance Dry Run 001
**Status:** PASS

Verified:
- 6 / 6 governance files read;
- 0 files modified;
- 0 files created;
- 0 external reference trees inspected;
- `E:\nixiang\` not inspected;
- 0 TRUE_CONTRADICTION;
- Codex correctly concluded `SHEEP-001` must not start in the dry run.

Dry Run findings C-01..C-04 are handled by GOV-REPAIR-001.
Roadmap dependency risks R-01..R-07 are inputs to Review 2, not silently implemented during governance repair.

## GOV-REPAIR-001 — Post Dry-Run Governance Consistency Repair
**Status:** PASS / CLOSED

Scope:
- active Master path/self-reference consistency;
- distinguish PRE_CODING_GOVERNANCE lifecycle stage from Roadmap Phase 0;
- update Roadmap governance-file count wording;
- align SHEEP-014 ownership state list with Master;
- update PROJECT_STATE with Dry Run PASS.

This repair does not start implementation and does not resolve Review-2 roadmap architecture risks.


## GOV-REPAIR-VERIFY-001 — Governance Repair Verification 001
**Status:** PASS

Verified:
- all 10 repair checks PASS;
- 6 / 6 governance files read;
- 0 files modified;
- 0 files created;
- 0 external reference contents inspected;
- `E:\nixiang\` not inspected;
- 0 TRUE_CONTRADICTION remains in repaired scope;
- `SHEEP-001` remains blocked from starting.

## GOV-REPAIR-002 — Owner-Review Status Alignment
**Status:** APPLIED / CLOSED

Scope:
- align Master §42 wording with actual order: Dry Run already PASS, Owner confirmation now pending;
- update `PROJECT_STATE.json` master status from stale `PENDING_OWNER_REVIEW_AND_GOVERNANCE_DRY_RUN` to `PENDING_OWNER_REVIEW_AND_V1_APPROVAL`;
- no product/architecture decision changes;
- no implementation;
- no Roadmap Review-2 risk resolution.

---



## GOV-MASTER-V1-APPROVAL — Fast Sheep Master Prompt V1.0
**Status:** PASS / APPROVED

**Approval Date:** 2026-08-22

Active Master:

`E:\fast_sheep\project\FAST_SHEEP_MASTER_PROMPT.md`

Version:

`1.0`

This Master is now the authoritative Fast Sheep project constitution.

The prior reviewed candidate is historical provenance only and MUST NOT be treated as the active Master.

Next required governance stage:

`REVIEW_2_CODING_ROADMAP`

Then:

`REVIEW_3_CODEX_TASK_TEMPLATE`

Then:

`FINAL_GOVERNANCE_FREEZE`

`SHEEP-001` remains blocked until Final Governance Freeze.

---

# Decision Change Protocol

To change a LOCKED decision:

1. Create a new `DEC-XXX`.
2. State which prior decision it supersedes.
3. Explain why.
4. Record product/security/data/architecture impact.
5. Record whether migration is required.
6. Obtain owner/controller approval.
7. Update the Master Prompt and Project State.
8. Only then implement the changed direction.

Never rewrite history to make a prior decision look like it never existed.
