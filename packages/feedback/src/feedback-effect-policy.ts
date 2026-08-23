// M9 feedback effect policy (clean-room). Intent class -> knowledge effect + record trust.
import type { FeedbackIntent } from "@fastwork/orchestrator";

export interface IntentEffect {
  /** knowledge op: none | append | insert */
  knowledge_op: "none" | "append" | "insert";
  /** knowledge trust level when mutating */
  knowledge_trust: string;
  /** feedback record trust level */
  record_trust: string;
  /** whether a FeedbackRecord is written by Main */
  record_written: boolean;
  /** index refresh mode */
  index_refresh: "none" | "incremental" | "deferred";
}

const EFFECTS: Record<string, IntentEffect> = {
  AUTO: { knowledge_op: "append", knowledge_trust: "AUTO", record_trust: "AUTO", record_written: true, index_refresh: "none" },
  MANUAL: { knowledge_op: "append", knowledge_trust: "HUMAN_CONFIRMED", record_trust: "HUMAN_CONFIRMED", record_written: true, index_refresh: "none" },
  NO_SAVE: { knowledge_op: "none", knowledge_trust: "", record_trust: "", record_written: false, index_refresh: "none" },
  CORRECTION: { knowledge_op: "insert", knowledge_trust: "HUMAN_CONFIRMED", record_trust: "HUMAN_CONFIRMED", record_written: true, index_refresh: "incremental" },
  AUDIT_APPROVE: { knowledge_op: "insert", knowledge_trust: "HUMAN_CONFIRMED", record_trust: "HUMAN_CONFIRMED", record_written: true, index_refresh: "incremental" },
  RESTORE: { knowledge_op: "append", knowledge_trust: "AUTO", record_trust: "AUTO", record_written: true, index_refresh: "deferred" },
};

export function effectForIntent(intent: FeedbackIntent): IntentEffect {
  return EFFECTS[intent.class] ?? { knowledge_op: "none", knowledge_trust: "", record_trust: intent.trust, record_written: true, index_refresh: "none" };
}

export function isNoSave(intent: FeedbackIntent): boolean {
  return intent.class === "NO_SAVE";
}
