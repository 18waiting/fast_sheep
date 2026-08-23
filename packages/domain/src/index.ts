// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// Pure domain types mirroring packages/contracts/schemas. No business workflows.

export type Platform = "pdd" | "doudian" | "jd" | "kuaishou" | "qianniu" | "xianyu";
export type TrustLevel = "AUTO" | "GENERATED" | "PENDING" | "HUMAN_CONFIRMED" | "PROTECTED";
export type JobState = "QUEUED" | "RUNNING" | "CANCELLING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type ConversationRole = "buyer" | "ai" | "human";
export type SendState = "queued" | "sending" | "sent" | "failed" | "cancelled" | "superseded";

// Opaque/branded identifiers (DESIGN): runtime strings, branded for type safety.
export type ShopId = string & { __shop: true };
export type ConversationId = string & { __conversation: true };
export type MessageId = string & { __message: true };
export type RequestId = string & { __request: true };
export type CorrelationId = string & { __correlation: true };

export interface Shop { id: ShopId; type: Platform; name: string; created_time?: string; enabled: boolean; order?: number; }
export interface TransferDecision { requested: boolean; target?: string; reason?: string; buyer_message?: string; }
export interface Suggestion {
  suggestion_id: string; conversation_id: ConversationId; generation: number; reply: string;
  referenced_knowledge?: { question: string; answer: string; similarity: number; source: string }[];
  decision?: TransferDecision; mode: "human_review" | "full_auto"; usage?: Record<string, unknown>; created_at: string;
}
export interface SendSegment { type: "text" | "image" | "video"; content: string; delay_ms?: number; }
export interface SendCommand {
  send_id: string; conversation_id: ConversationId; shop_id: ShopId; platform: Platform;
  segments: SendSegment[]; transfer?: TransferDecision; idempotency_key?: string;
}
export interface SendResult {
  send_id: string; ok: boolean; platform_message_ids?: string[]; error?: unknown | null;
  state: SendState; at: string;
}
export interface KnowledgeEntry {
  id: string; question: string; answer: string; product_id: string; tags?: string[];
  source?: string; trust_level: TrustLevel; created_at: string; updated_at: string;
}
export interface KnowledgeCandidate {
  candidate_id: string; source?: string; question: string; answer: string; product_id: string;
  tags?: string[]; origin: "LEARNED" | "GENERATED" | "CORRECTION" | "AUTO_INGEST" | "REVIEW" | "RESTORE";
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "PENDING_REAUDIT" | "COMMITTED";
  frequency?: Record<string, unknown>; evidence?: Record<string, unknown>;
}
export interface ToolCall { tool_call_id: string; name: string; arguments: Record<string, unknown>; }
export interface ToolResult { tool_call_id: string; ok: boolean; result?: Record<string, unknown>; text?: string; error?: unknown | null; remark?: string; }
export interface GenerationResult {
  request_id: RequestId; text: string; tool_calls?: ToolCall[];
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "error";
  usage?: Record<string, unknown>; provider?: string; model?: string;
}
export interface RetrievalResult {
  query: string;
  hits: { question: string; answer: string; product_id?: string; source: string; raw_similarity: number; rerank_score?: number; composite: number }[];
  fast_return?: boolean; tier_used?: "product" | "global" | "common"; stats?: Record<string, unknown>;
}
export interface FeedbackRecord {
  record_id: string; conversation_id: ConversationId; class: "AUTO" | "MANUAL" | "NO_SAVE" | "CORRECTION" | "AUDIT_APPROVE" | "RESTORE";
  trust_level: TrustLevel; target_ref?: string; message_ref?: string; created_at?: string;
}
export interface BackgroundJob {
  job_id: string; type: "learning" | "index_rebuild" | "knowledge_review" | "product_optimization" | "cloud_sync";
  state: JobState; progress?: number; message?: string; started_at?: string; finished_at?: string;
  cancellation_token?: string; error?: unknown | null; result?: Record<string, unknown>;
}


// SHEEP-010: Merchant Domain Model (M1.1 Core Identity Domain).
export * from "./merchant-domain.js";


// SHEEP-011: Membership / Seat Domain (M1.1 Core Identity Domain).
export * from "./membership-domain.js";
