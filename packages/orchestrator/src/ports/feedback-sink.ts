// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

export type FeedbackClass = "MANUAL" | "AUTO" | "NO_SAVE";

export interface FeedbackIntent {
  class: FeedbackClass;
  trust: string;
  conversationId?: string;
  shopId?: string;
  mode?: "human_review" | "full_auto";
  key?: string;
  reply?: string;
  [key: string]: unknown;
}

export interface FeedbackSink {
  record(intent: FeedbackIntent): void;
}