# FAST SHEEP NORTH STAR

> Status: LOCKED PRODUCT AUTHORITY  
> Document version: 1.0  
> Owner: Fast Sheep product authority  
> Scope: stable product identity and principles only  
> Current rollout scope: `docs/product/PDD_MVP_V1.md`  
> Current execution state: `project/PROJECT_STATE.json`

This document owns stable product identity. It does not own current task state,
implementation status, tactical UI decisions, release dates, or runtime
configuration values.

---

## 1. Product Identity

Fast Sheep / 快羊客服 is:

- AI-FIRST
- MULTI-SHOP READY
- FUTURE MULTI-PLATFORM
- ECOMMERCE CUSTOMER-SERVICE AUTOMATION

Fast Sheep is not primarily a PDD embedded-workbench or PDD UI product.

PDD is the first Platform Adapter / Transport Runtime. The embedded PDD
workbench is transport, authentication/session, diagnostic, and fallback
infrastructure. It is not the primary product experience.

---

## 2. Primary Customer Value

The primary customer value is:

> Reduce required human customer-service work safely.

Automation volume alone is not success. A wrong result, guessed fact, unsafe
action, or hidden uncertainty is more important than speed or coverage.

---

## 3. AI-First Principle

Normal customer-service work should be handled by the AI customer-service
pipeline when authoritative facts, policy, and transport conditions permit.

The target conceptual loop is:

```text
Inbound Platform Message
-> Identity Lock
-> Scene Classification
-> Authoritative Knowledge / Facts
-> AI Reasoning
-> ReplyPlan / ActionPlan
-> Deterministic Policy Engine
-> Platform Transport
-> Result Verification
-> Audit
-> Human escalation when required
```

AI produces structured plans. Deterministic application and transport code
executes them.

AI must never directly manipulate:

- PDD DOM
- PDD WebContents
- screen coordinates
- browser selectors
- platform transport internals

---

## 4. Humans as Exception

Humans should focus on exceptions, uncertainty, high-risk cases, and cases that
require judgment rather than repetitive routine handling.

Human intervention is required when the system encounters:

- UNKNOWN
- an unsupported case
- an unsafe or high-risk case
- insufficient authoritative knowledge
- transport/runtime uncertainty
- an explicit handoff policy

The system must surface uncertainty honestly rather than hiding it behind
generated language.

---

## 5. Platform and UI Non-Goal

Fast Sheep does not aim to reproduce or optimize the original PDD merchant UI
as its primary product experience.

Raw PDD UI work is justified only when it:

- enables the AI customer-service loop
- removes a Transport/runtime blocker
- is explicitly authorized diagnostic or fallback work

Otherwise the correct result is `PRODUCT_DIRECTION_MISMATCH`.

Reference UI work remains useful only within its existing governance,
license, provenance, and commercial-release boundaries.

---

## 6. Multi-Shop and Multi-Platform Model

Architecture must be multi-shop ready from the start.

The first real rollout may use one controlled PDD shop, but the architecture
must preserve logical isolation for:

- shop
- session
- customer
- knowledge
- policy
- audit

One-shop success does not prove multi-shop isolation.

AI Core, Policy, Knowledge, and Audit should not require platform-specific
rewrites merely because a new platform adapter is introduced. Future adapters
may include PDD, Taobao, Douyin, JD, and others; they are not enumerated as
permanent product boundaries.

Platform-specific values, selectors, login mechanics, and transport details
belong behind the platform adapter boundary.

---

## 7. Safety Hierarchy

Priority of correctness:

1. Wrong shop/customer/order/action target is unacceptable.
2. A false deterministic fact or incorrect consequential business action is unacceptable.
3. Wording, tone, and style variance is tolerable within bounded quality standards.

Facts are hard constraints.

UNKNOWN is a valid state and must never be guessed away.

An uncertain send outcome must:

- not be retried automatically
- retain reason and context for audit
- be surfaced to a human

AI confidence alone never grants execution authority.

---

## 8. Architecture-Neutral Product Principles

The product requires:

- authoritative facts before consequential generation or action
- explicit identity and target binding
- deterministic policy and risk gates
- result verification
- audit and traceability
- safe degradation when knowledge, policy, identity, or transport is uncertain
- least-privilege access to capabilities and data
- no hidden dependence on a platform-specific UI

Technology choices, schemas, services, and deployment topology remain governed
by the Master Constitution and locked architecture decisions. They are not
owned by this product document.

---

## 9. Product Non-Goals

Fast Sheep is not:

- a PDD embedded-workbench clone
- a screen-scraping product whose primary value is controlling another UI
- a system where LLM confidence grants action authority
- a system that guesses missing deterministic facts
- a single-shop architecture with multi-shop marketing language
- a product that requires platform-specific rewrites of AI Core, Policy,
  Knowledge, or Audit for every adapter
- a product that hides uncertainty from the human operator

---

## 10. Ownership and Change Control

- Constitution: `project/FAST_SHEEP_MASTER_PROMPT.md`
- Locked decisions: `project/DECISIONS.md`
- Stable product identity: this document
- Current PDD MVP scope: `docs/product/PDD_MVP_V1.md`
- Current execution/authorization: `project/PROJECT_STATE.json`
- Execution order: the reviewed Coding Roadmap

Changes to this document require a Controller-approved product decision.
Do not duplicate this document into `PROJECT_STATE.json` or `AGENTS.md`.