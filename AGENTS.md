# AGENTS.md — Fast Sheep Project Instructions

Project root: `E:\fast_sheep\`
Product: 快羊客服 / fast_sheep

This file is the entrypoint for Codex/project agents. It does not replace the project constitution.
Before any implementation, audit, migration, UI restoration, cloud, platform, AI, or release task, read the governance files below in the required order.

---

## 1. Mandatory read order

Before doing any project task, read:

1. `project/FAST_SHEEP_MASTER_PROMPT.md`
2. `project/PROJECT_STATE.json`
3. `project/DECISIONS.md`
4. the current SHEEP task prompt

When planning phase/milestone dependencies, also read:

5. the active Coding Roadmap — exact path per `project/PROJECT_STATE.json` `roadmap.path` / `roadmap.reviewed_path`; currently `project/FAST_SHEEP_CODING_ROADMAP_V1.0_REVIEWED.md` (Review 2 approved; `project/FAST_SHEEP_CODING_ROADMAP.md` = v1.0 historical baseline)

All SHEEP task prompts must follow:

6. the active Codex Task Template — exact path per `project/PROJECT_STATE.json` `task_template.path` / `task_template.reviewed_path`; currently `project/FAST_SHEEP_CODEX_TASK_TEMPLATE_V1.0_REVIEWED.md` (Review 3 approved; `project/FAST_SHEEP_CODEX_TASK_TEMPLATE.md` = v1.0 historical baseline)

Current active Master is:

`project/FAST_SHEEP_MASTER_PROMPT.md`

Status:

`APPROVED V1.0`

Do not switch to an older reviewed candidate or any alternate Master file unless a later approved governance decision explicitly changes the active Master path.

---

## 2. Project write boundary

All project-controlled source, configuration, reports, build/test artifacts, staging, temporary project files, and persistent development state must remain under:

`E:\fast_sheep\`

Preferred project temp root:

`E:\fast_sheep\.tmp\`

Unavoidable OS/tool-managed caches and runtime system paths may exist outside the project root, but they must never become project source-of-truth, hidden build dependencies, or hidden runtime dependencies.

---

## 3. External reference trees — READ ONLY

### Frozen validated technical baseline
`E:\ai客服数据\FastWork\rebuild\`

Allowed:
- read
- compare
- inspect architecture
- copy permitted source into Fast Sheep when the current SHEEP task explicitly authorizes it

Forbidden:
- modify
- build into
- write reports into
- update dependencies in
- rewrite historical reports/migrations/releases

### Owner-authorized renderer UI reference
`E:\ai客服数据\FastWork_asar_extracted\dist\renderer\`

Allowed only for UI reference/restoration tasks:
- inspect HTML/CSS/renderer JS
- inspect information architecture
- inspect UI-only interaction patterns
- copy/adapt assets only when the current task and license/provenance rules permit it

Forbidden:
- modify the reference tree
- use it as a production runtime dependency
- assume owner authorization proves every asset is commercially redistributable
- import seller credentials/auth state/secrets

### Reverse-engineering evidence repository — PENDING CLASSIFICATION
`E:\nixiang\`

Status:
`READ_ONLY / POTENTIAL_EVIDENCE_SOURCE / NOT_YET_CLASSIFIED`

Rules:
- Do not modify, rename, delete, normalize, format, or regenerate files under `E:\nixiang\`.
- Do not copy arbitrary content into production source.
- Do not treat reverse-engineered observations as automatically safe for commercial reuse.
- Use this tree only when the current task explicitly authorizes reverse-engineering evidence review.
- Before relying on this tree broadly, perform a dedicated inventory/classification task.
- Credentials, cookies, tokens, passwords, API keys, private user data, live seller sessions, or similar sensitive material are OUT OF SCOPE for migration and must never be copied into Fast Sheep.
- Findings from this tree must be classified using the project Evidence & Decision Protocol.

---

## 4. Task discipline

One task = one independently verifiable Acceptance Unit.

Do not execute the next SHEEP task automatically.

Codex task results are only:

- `COMPLETE`
- `PARTIAL`
- `FAIL`
- `NOT_RUN`

A Codex `COMPLETE` does NOT close a task.
The external project Controller must review the evidence and decide:

- `PASS`
- `REPAIR`

Only Controller PASS closes the task.

---

## 5. Evidence & Decision Protocol

Every material finding must be classified as one of:

- `CONFIRMED`
- `INFERRED`
- `PRODUCT_DECISION_REQUIRED`
- `BLOCKED`
- `DEFERRED`

### CONFIRMED
Direct reliable evidence exists. Implementation may proceed within task scope.

### INFERRED
Evidence is incomplete, but the inference is low-risk, reversible, and does not change product/commercial/security/privacy/automation/architecture policy. Record the inference.

### PRODUCT_DECISION_REQUIRED
Do not guess or implement the affected decision.

Use this for material unknowns involving:
- money / refund / compensation / billing
- security / credentials / cookies / tokens / API keys
- privacy / cloud data / deletion / retention
- AI automation / auto-send / tool authority
- important product behavior / information architecture
- long-term architecture / language / database / service boundaries
- platform commercial-compliance behavior

Complete all independent safe work first, then return PARTIAL with a Decision Package if the decision blocks REQUIRED scope.

### BLOCKED
An objective completion condition is unavailable.
Do not fabricate PASS. Provide evidence, impact, and the smallest next validation.

### DEFERRED
Real issue, but outside the current Acceptance Unit.
Record it in backlog; do not implement it “while here”.

---

## 6. Constitution invariants

A current task prompt may narrow scope, but MUST NOT override a Master Constitution invariant.

To change a Master invariant:
1. raise `PRODUCT_DECISION_REQUIRED`;
2. create/approve a new decision that explicitly supersedes the old rule;
3. update governance;
4. only then implement.

Do not use “the task prompt is more specific” as a reason to bypass security, tenant isolation, data governance, entitlement, automation, or architecture rules.

---

## 7. Desktop security invariants

Electron Renderer must preserve:

- `contextIsolation = true`
- `nodeIntegration = false`
- `sandbox = true`

Never expose to Renderer:

- raw `ipcRenderer`
- `fs`
- `child_process`
- direct SQLite access
- unrestricted Electron/system APIs
- seller credentials
- API secrets

Renderer → privileged operations must use the limited typed Preload / typed IPC boundary.

---

## 8. Architecture invariants

### Languages
- Desktop / Cloud control plane: TypeScript
- AI Worker: Python

### Cloud
- Modular monolith first
- PostgreSQL primary persistent source of truth
- Redis / queues / service extraction only when evidence proves the need
- No speculative microservices

### Data
- Local-first + selective cloud sync
- Sync through explicit Sync Engine / Outbox / version/conflict policy
- No scattered ad-hoc sync calls

### Platforms
Tier 1:
- PDD
- DouDian

Engineering order:
- PDD reference-first
- DouDian parity-second

### UI
- Restore/reference first
- Understand second
- Fast Sheep commercial redesign third

UI Track A is not automatic proof of commercial redistribution rights.

---

## 9. AI / Agent authority invariants

LLM does not self-authorize automatic sending.

Reply automation levels:
- `HUMAN_ONLY`
- `AI_SUGGEST`
- `AI_AUTO_REPLY`
- `FORCE_HANDOFF`

Tool risk model:
- T0 Read-only
- T1 Low-risk Write
- T2 Business Action
- T3 Financial / Irreversible

Tool execution must pass:
- platform capability
- merchant policy
- current identity capability
- resource scope
- tool risk
- automation policy
- entitlement
- current context

Untrusted customer/knowledge/platform/document text must never grant authority, reveal secrets, or bypass policy/tool permission.

---

## 10. Merchant / tenant security

Fast Sheep Cloud is multi-tenant.

Never trust a client-supplied `merchant_id` or `store_id` as authorization by itself.

Server-side merchant resource access must resolve:

authenticated identity
→ membership
→ capability
→ resource scope
→ authoritative tenant resource

Cross-merchant access is deny-by-default.

Cloud merchant-data features require cross-merchant negative tests.

---

## 11. Secrets / credentials

Seller identity is local-first.

Cloud stores registration/status metadata by default, not full seller credentials.

BYOK:
- raw API key must not be exposed to Renderer
- provider calls originate from Main and/or AI Worker
- key is stored via SecretStore abstraction
- no plaintext key in ordinary SQLite, logs, diagnostics, DOM, localStorage, or model prompt

Official Managed AI provider secrets remain Cloud-side.

---

## 12. Validation before COMPLETE

Before claiming `COMPLETE`:

- verify every REQUIRED output exists
- run every required test
- run required integration/smoke
- run required negative tests
- verify security invariants
- verify tenant/data/secret boundaries where applicable
- verify old read-only reference trees were not modified
- write the required task report
- disclose INFERRED findings
- do not implement unresolved PRODUCT_DECISION_REQUIRED items
- ensure `next_stage_not_executed = true`

If a REQUIRED path or core validation is missing, do not claim COMPLETE.

---

## 13. Historical / project state

After Phase 0 governance bootstrap:

- `project/PROJECT_STATE.json` is REQUIRED
- `project/DECISIONS.md` is REQUIRED

Do not invent overall project progress inside a task.
Overall weighted progress is Controller-managed from the roadmap.

Historical stage evidence must not be silently overwritten by reusable current-run scripts.

---

## 14. Hard stop

Master V1.0 is approved, but formal implementation remains blocked until:
- Review 2 — Coding Roadmap is closed;
- Review 3 — Codex Task Template is closed;
- Final Governance Freeze is approved.

Do not start `SHEEP-001` merely because Master V1.0 is approved.

For any SHEEP task after governance freeze:
Do not start the next SHEEP task automatically.
Wait for Controller `PASS` / `REPAIR`.
