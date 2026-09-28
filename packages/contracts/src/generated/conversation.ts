// GENERATED TYPE MIRRORS — keep in sync with rebuild/packages/contracts/schemas/conversation/*.schema.json.
// Clean-room implementation. JSON Schema (Draft 2020-12) is the single source of truth;
// these TS types mirror the conversation schemas for static typing only.
// Do not add business logic here.

/**
 * ConversationEngineRequest — the AI input format currently in use (Format A).
 *
 * This is the request shape sent to `conversation.generate` RPC method.
 * Mirrors `fastwork:conversation:conversation-engine-request` schema.
 *
 * **Note:** This is distinct from:
 * - `generation-request` (Format B) — conceptual schema, not actively used
 * - `context-envelope` (Format C) — SHEEP-306 contract definition, no builder/consumer yet
 *
 * @see resources/contracts/schemas/conversation/conversation-engine-request.schema.json
 */
export interface ConversationEngineRequest {
  /** The customer's question (required, non-empty) */
  readonly question: string;
  /** Product identifier for product-related inquiries */
  readonly product_id?: string;
  /** Order state: "未下单" (not ordered) or "已下单" (ordered) */
  readonly order_state?: "未下单" | "已下单";
  /** Recent chat history */
  readonly chat_history?: readonly ConversationMessage[];
  /** Previously completed question (for deduplication) */
  readonly completed_question?: string;
  /** Product information context */
  readonly product_info?: string;
  /** Buyer identifier */
  readonly buyer?: string;
  /** Shop identifier (legacy term, see SHOP_VS_STORE_SEMANTICS.md) */
  readonly shop_id?: string;
  /** Correlation ID for tracing */
  readonly correlation_id?: string;
  /** Additional conversation context */
  readonly context?: ConversationContext;
}

/**
 * Conversation message in chat history.
 * Mirrors `fastwork:domain:conversation-message` schema.
 */
export interface ConversationMessage {
  /** Message sender role */
  readonly role: "customer" | "merchant" | "ai" | "system";
  /** Message content */
  readonly content: string;
  /** Message timestamp (ISO 8601) */
  readonly timestamp?: string;
}

/**
 * Conversation context for additional information.
 * Mirrors `fastwork:domain:conversation-context` schema.
 */
export interface ConversationContext {
  /** Customer's selected product */
  readonly selected_product?: string;
  /** Customer's selected order */
  readonly selected_order?: string;
  /** Additional metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * ConversationEngineResult — the response from `conversation.generate`.
 * Mirrors `fastwork:conversation:conversation-engine-result` schema.
 */
export interface ConversationEngineResult {
  /** Generated reply text */
  readonly reply: string | null;
  /** Execution trace for debugging */
  readonly trace: readonly ConversationTraceEntry[];
  /** Whether this was a fast return (early exit) */
  readonly fast_return: boolean;
  /** Processing mode */
  readonly mode?: string;
  /** Handoff decision if transfer was requested */
  readonly decision?: HandoffDecision;
}

/**
 * Trace entry for debugging conversation execution.
 * Mirrors `fastwork:conversation:conversation-trace-entry` schema.
 */
export interface ConversationTraceEntry {
  /** Component that produced this trace */
  readonly component: string;
  /** Operation performed */
  readonly operation: string;
  /** Decision made (if any) */
  readonly decision?: string;
  /** Additional metadata */
  readonly [key: string]: unknown;
}

/**
 * Handoff decision for transfer to human agent.
 * Mirrors `fastwork:conversation:handoff-port-result` schema.
 */
export interface HandoffDecision {
  /** Whether transfer was requested */
  readonly requested: boolean;
  /** Transfer target (if requested) */
  readonly target?: string;
  /** Reason for transfer */
  readonly reason?: string;
}
