# SHEEP-309 Subtask 5 Report: AuditReportGenerator

**Status:** ✅ COMPLETE
**Date:** 2026-09-30
**File:** `apps/desktop/src/main/services/audit-report-generator.ts`

## Summary

Implemented the AuditReportGenerator — generates human-readable audit reports from SHADOW pipeline executions. Provides both structured `AuditReport` objects and formatted Markdown reports.

## Implementation

### Interfaces

- **`AuditReport`**: Complete report with run metadata, pipeline summary, step details, key metrics, and safety verification
- **`PipelineSummary`**: Step counts (total/successful/failed/skipped) and total duration
- **`ReportStepDetail`**: Per-step info (order, name, status, duration, I/O summaries, errors)
- **`KeyMetrics`**: Extracted from step outputs — transport calls, scene, knowledge, ReplyPlan, policy
- **`SafetyVerification`**: Zero-call verification for transport, platform API, and messages

### Class: AuditReportGenerator

**Methods:**
1. `generateReport(runId)` → `Promise<AuditReport>` — structured report
2. `generateMarkdownReport(runId)` → `Promise<string>` — formatted Markdown

**Private helpers:**
- `buildPipelineSummary(steps)` — counts step statuses and sums durations
- `buildStepDetails(steps)` — maps AuditStep to ReportStepDetail
- `extractKeyMetrics(steps)` — extracts scene, knowledge count, ReplyPlan, policy from step outputs
- `buildSafetyVerification(run, steps, events)` — verifies zero transport/platform/send calls

### Key Metrics Extraction

| Step | Metric Extracted |
|------|-----------------|
| SCENE_CLASSIFY | `scene` → `sceneDetected` |
| KNOWLEDGE_RETRIEVAL | `entry_count` → `knowledgeRetrieved` |
| REPLY_PLAN | `plan_id` exists → `replyPlanGenerated` |
| POLICY_EVAL | `rollout_mode` → `policyDecision` |
| TRANSPORT_VERIFY | `successfulSends` → `transportSendCalls`, `allowed` → `transportVerified` |

### Markdown Report Structure

1. Header (Run ID, Shop, Merchant, Status, Timestamps)
2. Pipeline Summary (table)
3. Key Metrics (table with ✅/❌ indicators)
4. Safety Verification (table with PASS/FAIL per check)
5. Step Details (per-step sections with I/O summaries)
6. Footer

## Verification

- **Typecheck:** ✅ `pnpm run typecheck` passes for all packages
- **Tests:** DEFERRED — requires personal PC (Windows + Node.js v22+)

## Acceptance Criteria

- [x] AC1: AuditReportGenerator correctly generates AuditReport
- [x] AC2: Report includes all 11 steps' details
- [x] AC3: Key metrics correctly computed (transportSendCalls, sceneDetected, etc.)
- [x] AC4: Safety verification correct (allZero = all metrics === 0)
- [x] AC5: generateMarkdownReport() generates formatted Markdown
- [x] AC6: Typecheck passes
