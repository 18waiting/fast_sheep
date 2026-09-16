# FAST SHEEP PDD MVP V1

> Status: LOCKED MVP SCOPE  
> Document version: 1.0  
> Product authority: `docs/product/FAST_SHEEP_NORTH_STAR.md`  
> Execution authority: `project/PROJECT_STATE.json`  
> Execution order: reviewed Coding Roadmap  
> One open product decision: second V1 reply scene

This document owns current PDD MVP scope. It does not own overall product
identity, implementation status, task authorization, or platform-independent
architecture principles.

---

## 1. Current MVP

PDD is first.

The architecture is multi-shop ready, but the initial real rollout is one
controlled PDD shop.

The current reply MVP should advance this loop:

```text
PDD inbound
-> identity-safe normalized message
-> scene
-> authoritative facts / knowledge
-> AI ReplyPlan
-> deterministic policy
-> SHADOW / HUMAN_CONFIRM / AUTO
-> platform transport
-> result verification
-> audit
-> human escalation when required
```

The original embedded PDD surface is transport, authentication/session,
diagnostic, and fallback infrastructure. It is not the primary product
experience.

Raw PDD UI polishing is not resumed by default.

---

## 2. Reply Scenes

Confirmed first reply scene:

`SHIPPING_TIME`

Second reply scene:

`OPEN_DECISION`

Controller recommendation only:

`LOGISTICS`

Do not close the second-scene decision without explicit Owner approval.

Planned later scenes:

- `STOCK_AVAILABILITY`
- `PRODUCT_BASIC_PARAMETERS`
- `AFTER_SALES_POLICY`

---

## 3. RolloutMode

`RolloutMode` is a product/configuration concept:

- `OFF`
- `SHADOW`
- `HUMAN_CONFIRM`
- `AUTO`

Meaning:

| RolloutMode | Meaning |
|---|---|
| `OFF` | No AI reply execution for the configured scope. |
| `SHADOW` | The AI pipeline runs and generates/evaluates a ReplyPlan, but no platform send occurs. |
| `HUMAN_CONFIRM` | AI proposes a reply and human confirmation is required before Transport execution. |
| `AUTO` | A policy-approved reply may execute automatically. |

RolloutMode does not replace the existing runtime automation vocabulary.

Existing runtime concepts remain:

- `HUMAN_ONLY`
- `AI_SUGGEST`
- `AI_AUTO_REPLY`
- `FORCE_HANDOFF`

Conceptual mapping:

- `OFF` -> `HUMAN_ONLY`
- `SHADOW` -> `HUMAN_ONLY` execution semantics plus shadow AI evaluation
- `HUMAN_CONFIRM` -> `AI_SUGGEST`
- `AUTO` -> `AI_AUTO_REPLY`
- `FORCE_HANDOFF` -> runtime safety/escalation override, not a RolloutMode value

The existing runtime automation model is preserved.

---

## 4. Configuration Hierarchy

RolloutMode must conceptually support:

```text
GLOBAL
-> SHOP
-> SCENE
```

Precedence and persistence details are implementation decisions for a later
governed task. This document does not hard-code them.

---

## 5. Inbound Aggregation

V1 target:

> Aggregate consecutive inbound customer messages for approximately 3-5
> seconds before creating the AI turn.

This is a target behavior, not a final hard-coded timing implementation.

Multiple questions:

- prefer one complete combined answer when accuracy can be preserved
- accuracy is more important than minimizing reply count

---

## 6. Knowledge V1

Authoritative V1 knowledge is:

- Owner-supplied official shop rules
- shop data
- product data
- order/logistics facts
- other explicit authoritative data

Historical conversations are future supporting evidence only.

Historical conversations are not V1 authoritative truth.

Conflict, freshness, scope, and retrieval rules remain governed by the Master
Constitution and existing Knowledge contracts.

---

## 7. Global Safety Contract and PDD V1 Consequences

PDD V1 inherits the global safety hierarchy, UNKNOWN policy, and
human-exception principles from `docs/product/FAST_SHEEP_NORTH_STAR.md` §7.
This document does not restate that global body.

PDD-V1-specific consequences:

- an uncertain PDD send outcome follows the global UNKNOWN contract
- no automatic retry occurs
- reason and context are retained for audit
- the case is surfaced to a human through the V1 desktop handoff/notification path
- additional escalation triggers follow the global North Star contract

V1 notification channel:

> Fast Sheep desktop notification.

Enterprise WeChat, mobile, and other notification channels are later backlog.
---

## 8. Business Actions

Long-term Fast Sheep may automatically execute business actions such as:

- cancel order
- modify address
- refund
- reshipment
- after-sales actions

AI may propose an ActionPlan. AI confidence never grants execution authority.

Future execution must follow the canonical identity/fact/action safety contract
in `docs/product/FAST_SHEEP_NORTH_STAR.md` §7 and the existing Tool, Policy, and
deterministic-execution contracts. Detailed gates are not restated here.

Business-action automation is not current reply-MVP implementation work.
---

## 9. First MVP Product Priority

The next substantive implementation direction must advance the AI-first loop:

```text
PDD inbound
-> identity-safe normalized message
-> scene
-> facts/knowledge
-> AI ReplyPlan
-> policy
-> SHADOW / HUMAN_CONFIRM / AUTO
-> transport send
-> result verification
-> audit
```

If a proposed task primarily optimizes raw PDD UI and does not advance this
loop, remove a blocker, or have explicit Controller diagnostic authorization,
the correct task decision is:

`PRODUCT_DIRECTION_MISMATCH`

---

## 10. Later / Backlog

Later or backlog scope includes:

- second and additional reply scenes after the first-scene decision path
- Enterprise WeChat, mobile, and other human-notification channels
- automatically executed business actions with deterministic safety gates
- additional platform adapters
- advanced quality dashboards and audit sampling
- broader multi-shop rollout after isolation is proven

None of these items are automatically authorized by this document.

---

## 11. Ownership and Change Control

- Product identity: `docs/product/FAST_SHEEP_NORTH_STAR.md`
- Locked decisions: `project/DECISIONS.md`
- Current execution state: `project/PROJECT_STATE.json`
- Execution order: reviewed Coding Roadmap

The reviewed Roadmap/Template remain unchanged in Product Alignment Package 1.
A governed Roadmap V1.1 revision is required after this product authority is
accepted.