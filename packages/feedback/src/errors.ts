// M9 feedback errors (clean-room).
export const FEEDBACK_ERROR_CODES = {
  INVALID_INTENT: "feedback.invalid_intent",
  NOT_FOUND: "feedback.not_found",
  WORKER_UNAVAILABLE: "feedback.worker_unavailable",
  RETRY_EXHAUSTED: "feedback.retry_exhausted",
} as const;

export type FeedbackErrorCode = (typeof FEEDBACK_ERROR_CODES)[keyof typeof FEEDBACK_ERROR_CODES];

export class FeedbackError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "FeedbackError";
    this.code = code;
  }
}
