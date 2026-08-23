// M9 feedback types (clean-room).
import type { FeedbackIntent } from "@fastwork/orchestrator";

export type FeedbackClass = FeedbackIntent["class"] | "CORRECTION" | "AUDIT_APPROVE" | "RESTORE";

export interface FeedbackRecordInput {
  record_id: string;
  conversation_id: string;
  class: string;
  trust_level: string;
  target_ref?: string | null;
  message_ref?: string | null;
  created_at: string;
  question?: string;
  answer?: string;
  product_id?: string;
  entry?: Record<string, unknown>;
}

export type EffectStatus = "PENDING" | "APPLIED" | "FAILED_RETRYABLE" | "FAILED_FINAL";

export interface KnowledgeEffectRequest {
  record_id: string;
  conversation_id: string;
  class: string;
  trust_level: string;
  question: string;
  answer: string;
  product_id: string;
  entry: Record<string, unknown>;
  created_at: string;
  retry: boolean;
}

export interface KnowledgeEffectResult {
  record_id: string;
  ok: boolean;
  knowledge_op: "none" | "append" | "insert";
  entry_id?: string;
  index_refresh: "none" | "incremental" | "deferred";
  applied: boolean;
  error?: string;
}

export interface FeedbackEffectStatusView {
  record_id: string;
  effect_status: EffectStatus;
  attempts: number;
  last_error?: string | null;
  applied_at?: string | null;
}
