/**
 * Audit Report Generator (SHEEP-309).
 *
 * Purpose: Generate human-readable audit reports from SHADOW pipeline executions.
 * Produces both structured AuditReport objects and formatted Markdown reports.
 *
 * Governance basis:
 * - Master §5: AI output must be structured and governed.
 * - REPLY_AND_ACTION_SAFETY: Deterministic policy evaluation must be auditable.
 * - SHEEP-309: SHADOW mode requires complete audit trail with human-readable reports.
 *
 * Key invariants:
 * - Reports are generated from AuditLogger data.
 * - Key metrics are computed from step outputs.
 * - Safety verification confirms zero transport calls.
 * - Markdown reports are formatted for human review.
 *
 * Owner SHEEP-309 decisions:
 * D1: Generator is a service class with injected AuditLogger dependency.
 * D2: Reports include both structured data and human-readable Markdown.
 * D3: Key metrics are extracted from step output summaries.
 */

import type { AuditLoggerPort, AuditRun, AuditStep, AuditEvent } from "../ports/audit-logger-port.js";

/**
 * Pipeline summary statistics.
 */
export interface PipelineSummary {
  readonly totalSteps: number;
  readonly successfulSteps: number;
  readonly failedSteps: number;
  readonly skippedSteps: number;
  readonly totalDurationMs: number;
}

/**
 * Step detail in the report.
 */
export interface ReportStepDetail {
  readonly stepOrder: number;
  readonly stepName: string;
  readonly status: string;
  readonly durationMs?: number;
  readonly inputSummary?: Record<string, unknown>;
  readonly outputSummary?: Record<string, unknown>;
  readonly errorDetail?: Record<string, unknown>;
}

/**
 * Key metrics extracted from the pipeline execution.
 */
export interface KeyMetrics {
  readonly transportSendCalls: number; // Must = 0 for SHADOW mode
  readonly transportVerified: boolean; // Whether transport verification passed
  readonly sceneDetected: string | null;
  readonly knowledgeRetrieved: number;
  readonly replyPlanGenerated: boolean;
  readonly policyDecision: string | null; // rollout_mode
}

/**
 * Safety verification results.
 */
export interface SafetyVerification {
  readonly transportCalls: number;
  readonly platformApiCalls: number;
  readonly messagesSent: number;
  readonly allZero: boolean; // All metrics must = 0
}

/**
 * Complete audit report.
 */
export interface AuditReport {
  readonly runId: string;
  readonly shopId: string;
  readonly merchantId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly status: "COMPLETED" | "FAILED";

  // Pipeline summary
  readonly pipelineSummary: PipelineSummary;

  // Step details
  readonly steps: readonly ReportStepDetail[];

  // Key metrics
  readonly keyMetrics: KeyMetrics;

  // Safety verification
  readonly safetyVerification: SafetyVerification;
}

/**
 * Audit Report Generator.
 *
 * Generates human-readable audit reports from SHADOW pipeline executions.
 *
 * Usage:
 * ```typescript
 * const generator = new AuditReportGenerator(auditLogger);
 * const report = await generator.generateReport(runId);
 * const markdown = await generator.generateMarkdownReport(runId);
 * ```
 */
export class AuditReportGenerator {
  constructor(private readonly auditLogger: AuditLoggerPort) {}

  /**
   * Generate a structured audit report.
   *
   * @param runId - Audit run ID
   * @returns Complete AuditReport with pipeline summary, step details, and metrics
   */
  async generateReport(runId: string): Promise<AuditReport> {
    const run = await this.auditLogger.getRun(runId);
    if (!run) {
      throw new Error(`Audit run not found: ${runId}`);
    }

    const steps = await this.auditLogger.getSteps(runId);
    const events = await this.auditLogger.getEvents(runId);

    // Build pipeline summary
    const pipelineSummary = this.buildPipelineSummary(steps);

    // Build step details
    const stepDetails = this.buildStepDetails(steps);

    // Extract key metrics from step outputs
    const keyMetrics = this.extractKeyMetrics(steps);

    // Build safety verification
    const safetyVerification = this.buildSafetyVerification(run, steps, events);

    return {
      runId: run.id,
      shopId: run.shopId,
      merchantId: run.merchantId,
      startedAt: run.startedAt,
      completedAt: run.completedAt ?? new Date().toISOString(),
      status: run.status === "COMPLETED" ? "COMPLETED" : "FAILED",
      pipelineSummary,
      steps: stepDetails,
      keyMetrics,
      safetyVerification,
    };
  }

  /**
   * Generate a Markdown-formatted audit report.
   *
   * @param runId - Audit run ID
   * @returns Formatted Markdown string
   */
  async generateMarkdownReport(runId: string): Promise<string> {
    const report = await this.generateReport(runId);
    const lines: string[] = [];

    // Header
    lines.push(`# SHADOW Pipeline Audit Report`);
    lines.push(``);
    lines.push(`**Run ID:** ${report.runId}`);
    lines.push(`**Shop ID:** ${report.shopId}`);
    lines.push(`**Merchant ID:** ${report.merchantId}`);
    lines.push(`**Status:** ${report.status}`);
    lines.push(`**Started:** ${report.startedAt}`);
    lines.push(`**Completed:** ${report.completedAt}`);
    lines.push(``);

    // Pipeline Summary
    lines.push(`## Pipeline Summary`);
    lines.push(``);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Steps | ${report.pipelineSummary.totalSteps} |`);
    lines.push(`| Successful | ${report.pipelineSummary.successfulSteps} |`);
    lines.push(`| Failed | ${report.pipelineSummary.failedSteps} |`);
    lines.push(`| Skipped | ${report.pipelineSummary.skippedSteps} |`);
    lines.push(`| Total Duration | ${report.pipelineSummary.totalDurationMs}ms |`);
    lines.push(``);

    // Key Metrics
    lines.push(`## Key Metrics`);
    lines.push(``);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Transport Send Calls | ${report.keyMetrics.transportSendCalls} |`);
    lines.push(`| Transport Verified | ${report.keyMetrics.transportVerified ? "✅ YES" : "❌ NO"} |`);
    lines.push(`| Scene Detected | ${report.keyMetrics.sceneDetected ?? "NONE"} |`);
    lines.push(`| Knowledge Retrieved | ${report.keyMetrics.knowledgeRetrieved} |`);
    lines.push(`| ReplyPlan Generated | ${report.keyMetrics.replyPlanGenerated ? "✅ YES" : "❌ NO"} |`);
    lines.push(`| Policy Decision | ${report.keyMetrics.policyDecision ?? "NONE"} |`);
    lines.push(``);

    // Safety Verification
    lines.push(`## Safety Verification`);
    lines.push(``);
    lines.push(`| Check | Value | Status |`);
    lines.push(`|-------|-------|--------|`);
    lines.push(`| Transport Calls | ${report.safetyVerification.transportCalls} | ${report.safetyVerification.transportCalls === 0 ? "✅ PASS" : "❌ FAIL"} |`);
    lines.push(`| Platform API Calls | ${report.safetyVerification.platformApiCalls} | ${report.safetyVerification.platformApiCalls === 0 ? "✅ PASS" : "❌ FAIL"} |`);
    lines.push(`| Messages Sent | ${report.safetyVerification.messagesSent} | ${report.safetyVerification.messagesSent === 0 ? "✅ PASS" : "❌ FAIL"} |`);
    lines.push(`| **All Zero** | ${report.safetyVerification.allZero ? "✅ YES" : "❌ NO"} | ${report.safetyVerification.allZero ? "✅ SAFE" : "❌ UNSAFE"} |`);
    lines.push(``);

    // Step Details
    lines.push(`## Step Details`);
    lines.push(``);
    for (const step of report.steps) {
      const statusIcon = step.status === "SUCCESS" ? "✅" : step.status === "FAILED" ? "❌" : "⏭️";
      lines.push(`### Step ${step.stepOrder}: ${step.stepName} ${statusIcon}`);
      lines.push(``);
      lines.push(`- **Status:** ${step.status}`);
      if (step.durationMs !== undefined) {
        lines.push(`- **Duration:** ${step.durationMs}ms`);
      }
      if (step.inputSummary) {
        lines.push(`- **Input:**`);
        lines.push(`  \`\`\`json`);
        lines.push(`  ${JSON.stringify(step.inputSummary, null, 2)}`);
        lines.push(`  \`\`\``);
      }
      if (step.outputSummary) {
        lines.push(`- **Output:**`);
        lines.push(`  \`\`\`json`);
        lines.push(`  ${JSON.stringify(step.outputSummary, null, 2)}`);
        lines.push(`  \`\`\``);
      }
      if (step.errorDetail) {
        lines.push(`- **Error:**`);
        lines.push(`  \`\`\`json`);
        lines.push(`  ${JSON.stringify(step.errorDetail, null, 2)}`);
        lines.push(`  \`\`\``);
      }
      lines.push(``);
    }

    // Footer
    lines.push(`---`);
    lines.push(`*Generated by AuditReportGenerator (SHEEP-309)*`);

    return lines.join("\n");
  }

  /**
   * Build pipeline summary from steps.
   */
  private buildPipelineSummary(steps: readonly AuditStep[]): PipelineSummary {
    let successfulSteps = 0;
    let failedSteps = 0;
    let skippedSteps = 0;
    let totalDurationMs = 0;

    for (const step of steps) {
      if (step.status === "SUCCESS") successfulSteps++;
      else if (step.status === "FAILED") failedSteps++;
      else if (step.status === "SKIPPED") skippedSteps++;

      if (step.durationMs !== undefined) {
        totalDurationMs += step.durationMs;
      }
    }

    return {
      totalSteps: steps.length,
      successfulSteps,
      failedSteps,
      skippedSteps,
      totalDurationMs,
    };
  }

  /**
   * Build step details from audit steps.
   */
  private buildStepDetails(steps: readonly AuditStep[]): ReportStepDetail[] {
    return steps.map((step) => ({
      stepOrder: step.stepOrder,
      stepName: step.stepName,
      status: step.status,
      durationMs: step.durationMs,
      inputSummary: step.inputSummary,
      outputSummary: step.outputSummary,
      errorDetail: step.errorDetail,
    }));
  }

  /**
   * Extract key metrics from step outputs.
   */
  private extractKeyMetrics(steps: readonly AuditStep[]): KeyMetrics {
    let transportSendCalls = 0;
    let transportVerified = false;
    let sceneDetected: string | null = null;
    let knowledgeRetrieved = 0;
    let replyPlanGenerated = false;
    let policyDecision: string | null = null;

    for (const step of steps) {
      const output = step.outputSummary;
      if (!output) continue;

      // Step 4: SCENE_CLASSIFY
      if (step.stepName === "SCENE_CLASSIFY" && output["scene"]) {
        sceneDetected = output["scene"] as string;
      }

      // Step 5: KNOWLEDGE_RETRIEVAL
      if (step.stepName === "KNOWLEDGE_RETRIEVAL" && output["entry_count"] !== undefined) {
        knowledgeRetrieved = output["entry_count"] as number;
      }

      // Step 7: REPLY_PLAN
      if (step.stepName === "REPLY_PLAN" && output["plan_id"]) {
        replyPlanGenerated = true;
      }

      // Step 8: POLICY_EVAL
      if (step.stepName === "POLICY_EVAL" && output["rollout_mode"]) {
        policyDecision = output["rollout_mode"] as string;
      }

      // Step 10: TRANSPORT_VERIFY
      if (step.stepName === "TRANSPORT_VERIFY") {
        transportSendCalls = (output["successfulSends"] as number) ?? 0;
        transportVerified = (output["allowed"] as boolean) ?? false;
      }
    }

    return {
      transportSendCalls,
      transportVerified,
      sceneDetected,
      knowledgeRetrieved,
      replyPlanGenerated,
      policyDecision,
    };
  }

  /**
   * Build safety verification from run, steps, and events.
   */
  private buildSafetyVerification(
    run: AuditRun,
    steps: readonly AuditStep[],
    events: readonly AuditEvent[]
  ): SafetyVerification {
    // Transport calls: from run record
    const transportCalls = run.transportSendCalls;

    // Platform API calls: count events with eventType containing "platform" or "api"
    const platformApiCalls = events.filter(
      (e) =>
        e.eventType.toLowerCase().includes("platform") ||
        e.eventType.toLowerCase().includes("api")
    ).length;

    // Messages sent: count events with eventType containing "send" or "message"
    const messagesSent = events.filter(
      (e) =>
        e.eventType.toLowerCase().includes("send") ||
        e.eventType.toLowerCase().includes("message")
    ).length;

    const allZero = transportCalls === 0 && platformApiCalls === 0 && messagesSent === 0;

    return {
      transportCalls,
      platformApiCalls,
      messagesSent,
      allZero,
    };
  }
}
