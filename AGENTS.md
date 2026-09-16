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
5. `project/PROJECT_STATE.json` — current execution ledger and authorization
6. the reviewed Coding Roadmap plus the current SHEEP task prompt

All SHEEP task prompts must follow the active reviewed Codex Task Template.
Resolve exact active paths from `project/PROJECT_STATE.json`; do not infer them
from old filenames.

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