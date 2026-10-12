# Golden Fixture Evidence Ledger

> TASK-014 deliverable (2026-08-15). Append-only ledger for golden evidence changes. No entry may be silently edited.

## 2026-08-15 — Initial SPEC_DERIVED freeze (fixture version 2026-08-15.1)
- All 222 fixtures frozen as SPEC_DERIVED from the recovered specification set (source per fixture in provenance).
- Sources: spec/ai/*, spec/architecture/*, spec/contracts/*, spec/states/*, spec/data/*, spec/rebuild/*, docs/adr/ADR-001..007.
- Spec drift corrections applied: DRIFT-001..004, DRIFT-010 (see spec/parity/spec-drift-report.md); no observed spec modified.
- Reference unknowns without oracle (remain DESIGN_CONFORMANCE or config-isolated, not resolved):
  - edited manual suggestion destination (U-035); order-status relaxed branch (<10); rerank scheduler skip N/S; message retention (U-036); cloud-sync scope (U-036); X5/X10 model names (U-027); forbidden-filter original order (U-028).

## Future entries
- Any change to a FROZEN fixture: date, fixture version, reason (evidence update/parity review), before/after case_ids, review ref, traceability update ref.

## 2026-08-15 — Schema revision SCHEMA-REV-001 (golden-fixture.schema.json)
- Reason: TASK-015 M0 golden-schema gate surfaced ERROR-001 — 165/222 golden fixtures legitimately assert only `decisions`/`trace`/`events`/`persistence`/`external_calls` without an `expected.result`, but the schema marked `expected.result` as `required`.
- Change: `expected.result` made OPTIONAL (removed from `expected.required`). No frozen fixture content, case_id, behavior_ids, or stored SHA-256 was modified.
- Parity review: decision/trace/persistence/external-call oracles are valid per TASK-014 comparison-mode model (NO_CALL, ORDERED_TRACE, PERSISTENCE_DIFF, EVENT_SEQUENCE do not require a `result`).
- Fixture version: fixtures remain FROZEN 2026-08-15.1 (p0-golden-manifest hashes unchanged).
- Traceability update: `spec/rebuild/m0-contract-metadata-audit.md` ERROR-001 marked RESOLVED; M0 status COMPLETE.

## 2026-10-12 — GF-TOOL-008 entitlement mock removed (realignment B2)
- Reason: Owner decision D2 (2026-10-12) skips the entire entitlement/billing/trial line; REA batch-1 evidence (`~/Documents/ChatGPT/fastwork-rea-batch1/BLINDSPOTS.md`, `I-delta.md`) shows FastWork's 积分/卡密/试用 system is cloud-dependent and outside the replicated scope. The `entitlement` gate parameter no longer exists in `ToolExecutor.execute`.
- Change: `GF-TOOL-008.json` — removed `mocks.entitlement`; title changed from "tool disabled / insufficient points" to "tool disabled (definition enabled=false)"; expected result unchanged (`tool.disabled`, NO_CALL). Behavior B-TOOL-005's disabled-path coverage is preserved via definition-level `enabled: false`, which remains a real FastWork concept (技能启用/停用, see F-settings-keys `启用区的技能才生效`).
- Before/after case_ids: GF-TOOL-008 (single fixture; P1, not in p0-golden-manifest, no frozen hashes affected).
- Review ref: project/REALIGNMENT_DEMOLITION_ORDER.md B2; constitution V2.0 §5 (parity-tests single-clause rule).
