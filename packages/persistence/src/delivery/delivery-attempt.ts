// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// SHEEP-066-PR1: durable Text Delivery Attempt journal — platform-independent Send
// Attempt truth model / typed outcome / durable recovery contract.
//
// Decisions consumed:
//   DP-119 SEND_PIPELINE_CONSUMES_COMPOSER_SUBMIT_INTENT (input = {conversationId, draft})
//   DP-120 SEND_AUTHORIZATION_PRECEDES_DELIVERY_AND_MESSAGE_PERSISTENCE
//   DP-122/125 SEND_OUTCOME_IS_EXPLICIT_AND_TYPED_NOT_BOOLEAN (ACKNOWLEDGED|REJECTED|UNKNOWN)
//   DP-124 MANUAL_AGENT_SEND_AUTHORITY_IS_DISTINCT_FROM_AI_AUTOMATION_LEVEL
//   DP-126 DELIVERED_MESSAGE_FACT_REQUIRES_AUTHORITATIVE_DELIVERY_OUTCOME
//   DP-127 DELIVERY_ATTEMPT_JOURNAL_IS_DISTINCT_FROM_DELIVERED_MESSAGE_FACT_AND_SYNC_OUTBOX
//   DP-128 UNRESOLVED_IN_FLIGHT_ATTEMPTS_RECOVER_AS_UNKNOWN_NOT_FAILED
//   DP-129 PRODUCTION_SEND_REMAINS_DISABLED_UNTIL_A_REAL_PLATFORM_DELIVERY_ADAPTER_SATISFIES_ACK_CONTRACT
//   DP-130 ACKNOWLEDGED_ATTEMPT_FINALIZATION_AND_DELIVERED_MESSAGE_FACT_PERSISTENCE_ARE_ATOMIC_OR_RECOVERABLY_IDEMPOTENT
//   I-33/I-35/I-36/I-37/I-38/I-39/I-40/I-41
//
// The journal stores an IMMUTABLE text payload snapshot + captured target identity
// (I-34/I-37). Terminal states are immutable; retry creates a NEW attempt (I-38).
// IN_FLIGHT is durable BEFORE any external delivery side effect (I-39); unresolved
// IN_FLIGHT after crash/reopen recovers as UNKNOWN (DP-128). Only ACKNOWLEDGED may
// create a delivered outbound message fact, atomically with the attempt finalization
// (DP-130) and idempotently per attempt (I-40). Attempt text is customer business
// data and must NEVER be emitted to logs/telemetry/error strings by default (I-41).
import { randomUUID } from "node:crypto";
import type { SqliteConnection } from "../db/sqlite-driver.js";
import { PersistenceError, ERROR_CODES } from "../db/errors.js";
import { SqliteMessageRepository, SqliteNormalizedConversationRepository } from "../sqlite/sqlite-conversation-repositories.js";
import type { MessageRecord } from "../repositories/conversation-repositories.js";

export type DeliveryAttemptStatus = "PENDING" | "IN_FLIGHT" | "ACKNOWLEDGED" | "REJECTED" | "UNKNOWN";
export type DeliveryOutcome = "ACKNOWLEDGED" | "REJECTED" | "UNKNOWN";
export type DeliveryAttemptAuthorizeResult = "ALLOWED" | "DENIED" | "UNAVAILABLE";

export class DeliveryAttemptError extends PersistenceError {
  constructor(message: string) { super(ERROR_CODES.DELIVERY_ATTEMPT, message); }
}

/** Durable delivery attempt truth record (immutable text payload + captured target). */
export interface DeliveryAttemptRecord {
  id: string;
  conversationId: string;
  storeId: string;
  platformAccountId: string;
  textPayload: string;
  status: DeliveryAttemptStatus;
  createdAt: string;
  dispatchedAt: string | null;
  resolvedAt: string | null;
  deliveredMessageId: string | null;
  ackSourceRef: string | null;
  ackOccurredAt: string | null;
}

/** Platform-independent delivery port (never bound to a fake adapter in production; DP-129). */
export interface TextDeliveryPort {
  deliver(attempt: DeliveryAttemptRecord): Promise<DeliveryResult>;
}

/** Typed delivery result: outcome + typed source facts only (no raw response JSON). */
export interface DeliveryResult {
  outcome: DeliveryOutcome;
  /** Typed driver source reference (may be absent). */
  sourceRef?: string;
  /** Typed driver source occurrence time (may be absent/unknown -> Message.occurred_at = NULL). */
  occurredAt?: string | null;
}

/** Thin authorization-before-attempt contract (DP-120); production not ready -> Send unavailable. */
export interface DeliveryAttemptAuthorizerPort {
  authorize(conversationId: string): DeliveryAttemptAuthorizeResult;
}

export interface DeliveryAttemptRepository {
  create(a: DeliveryAttemptRecord): void;
  findById(id: string): DeliveryAttemptRecord | null;
  markInFlight(id: string, dispatchedAt: string): DeliveryAttemptRecord | null;
  resolve(id: string, status: "REJECTED" | "UNKNOWN", resolvedAt: string): DeliveryAttemptRecord | null;
  listInFlight(): DeliveryAttemptRecord[];
  recoverInFlight(resolvedAt: string): number;
  updateAcknowledged(id: string, f: { resolvedAt: string; deliveredMessageId: string; ackSourceRef: string | null; ackOccurredAt: string | null }): DeliveryAttemptRecord | null;
}

interface AttemptRow { id: string; conversation_id: string; store_id: string; platform_account_id: string; text_payload: string; status: string; created_at: string; dispatched_at: string | null; resolved_at: string | null; delivered_message_id: string | null; ack_source_ref: string | null; ack_occurred_at: string | null; }
const COLS = "id, conversation_id, store_id, platform_account_id, text_payload, status, created_at, dispatched_at, resolved_at, delivered_message_id, ack_source_ref, ack_occurred_at";

function mapRow(r: AttemptRow): DeliveryAttemptRecord {
  const status: DeliveryAttemptStatus = ["PENDING","IN_FLIGHT","ACKNOWLEDGED","REJECTED","UNKNOWN"].includes(r.status) ? r.status as DeliveryAttemptStatus : "UNKNOWN";
  return {
    id: r.id, conversationId: r.conversation_id, storeId: r.store_id, platformAccountId: r.platform_account_id,
    textPayload: r.text_payload, status, createdAt: r.created_at, dispatchedAt: r.dispatched_at,
    resolvedAt: r.resolved_at, deliveredMessageId: r.delivered_message_id, ackSourceRef: r.ack_source_ref, ackOccurredAt: r.ack_occurred_at,
  };
}

export class SqliteDeliveryAttemptRepository implements DeliveryAttemptRepository {
  constructor(private readonly conn: SqliteConnection) {}
  create(a: DeliveryAttemptRecord): void {
    if (a.status !== "PENDING") throw new DeliveryAttemptError("delivery attempt must be created as PENDING");
    this.conn.run(
      "INSERT INTO delivery_attempts (id, conversation_id, store_id, platform_account_id, text_payload, status, created_at, dispatched_at, resolved_at, delivered_message_id, ack_source_ref, ack_occurred_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      a.id, a.conversationId, a.storeId, a.platformAccountId, a.textPayload, a.status, a.createdAt, a.dispatchedAt, a.resolvedAt, a.deliveredMessageId, a.ackSourceRef, a.ackOccurredAt
    );
  }
  findById(id: string): DeliveryAttemptRecord | null {
    const r = this.conn.get<AttemptRow | undefined>(`SELECT ${COLS} FROM delivery_attempts WHERE id = ?`, id);
    return r ? mapRow(r) : null;
  }
  markInFlight(id: string, dispatchedAt: string): DeliveryAttemptRecord | null {
    // I-39: IN_FLIGHT transition is durable before any external delivery side effect.
    this.conn.run("UPDATE delivery_attempts SET status = 'IN_FLIGHT', dispatched_at = ? WHERE id = ? AND status = 'PENDING'", dispatchedAt, id);
    return this.findById(id);
  }
  resolve(id: string, status: "REJECTED" | "UNKNOWN", resolvedAt: string): DeliveryAttemptRecord | null {
    // I-38: terminal states are immutable; only PENDING/IN_FLIGHT may resolve to terminal.
    this.conn.run("UPDATE delivery_attempts SET status = ?, resolved_at = ? WHERE id = ? AND status IN ('PENDING','IN_FLIGHT')", status, resolvedAt, id);
    return this.findById(id);
  }
  listInFlight(): DeliveryAttemptRecord[] {
    return this.conn.all<AttemptRow>(`SELECT ${COLS} FROM delivery_attempts WHERE status = 'IN_FLIGHT' ORDER BY created_at`).map(mapRow);
  }
  recoverInFlight(resolvedAt: string): number {
    // DP-128: unresolved in-flight attempts recover as UNKNOWN (not FAILED).
    const inFlight = this.listInFlight();
    if (inFlight.length === 0) return 0;
    this.conn.run("UPDATE delivery_attempts SET status = 'UNKNOWN', resolved_at = ? WHERE status = 'IN_FLIGHT'", resolvedAt);
    return inFlight.length;
  }
  updateAcknowledged(id: string, f: { resolvedAt: string; deliveredMessageId: string; ackSourceRef: string | null; ackOccurredAt: string | null }): DeliveryAttemptRecord | null {
    this.conn.run("UPDATE delivery_attempts SET status = 'ACKNOWLEDGED', resolved_at = ?, delivered_message_id = ?, ack_source_ref = ?, ack_occurred_at = ? WHERE id = ? AND status = 'IN_FLIGHT'", f.resolvedAt, f.deliveredMessageId, f.ackSourceRef, f.ackOccurredAt, id);
    return this.findById(id);
  }
}

export function generateDeliveryAttemptId(): string { return "dla-" + randomUUID(); }
/** Deterministic delivered-message id derived from the attempt (I-40 typed link; idempotent). */
export function generateDeliveryMessageId(attemptId: string): string { return "dlv-" + attemptId; }

/** Authorization-before-attempt contract (DP-120): attempt is created ONLY when ALLOWED. */
export function createAuthorizedDeliveryAttempt(
  conn: SqliteConnection,
  input: { id: string; conversationId: string; textPayload: string; createdAt: string },
  authorizer: DeliveryAttemptAuthorizerPort
): DeliveryAttemptRecord {
  if (authorizer.authorize(input.conversationId) !== "ALLOWED") {
    throw new DeliveryAttemptError("send not authorized (authorization unavailable or denied)");
  }
  const conv = new SqliteNormalizedConversationRepository(conn).findById(input.conversationId);
  if (!conv) throw new DeliveryAttemptError("conversation not found");
  // I-37: target identity captured from the AUTHORIZED conversation (never renderer/queue scope).
  const record: DeliveryAttemptRecord = {
    id: input.id, conversationId: conv.id, storeId: conv.storeId, platformAccountId: conv.platformAccountId,
    textPayload: input.textPayload, status: "PENDING", createdAt: input.createdAt,
    dispatchedAt: null, resolvedAt: null, deliveredMessageId: null, ackSourceRef: null, ackOccurredAt: null,
  };
  new SqliteDeliveryAttemptRepository(conn).create(record);
  return record;
}

/**
 * Run one delivery attempt through the state machine against a TextDeliveryPort:
 * PENDING -> IN_FLIGHT (durable, I-39) -> port.deliver -> ACKNOWLEDGED (atomic finalize,
 * DP-130/I-35/I-40) | REJECTED | UNKNOWN (I-33: no auto-retry, no delivered fact).
 * Never emits textPayload into errors/logs (I-41).
 */
export async function runDeliveryAttempt(conn: SqliteConnection, attempt: DeliveryAttemptRecord, port: TextDeliveryPort): Promise<{ attempt: DeliveryAttemptRecord; outcome: DeliveryOutcome }> {
  const repo = new SqliteDeliveryAttemptRepository(conn);
  const inFlight = repo.markInFlight(attempt.id, new Date().toISOString());
  if (!inFlight || inFlight.status !== "IN_FLIGHT") throw new DeliveryAttemptError("delivery attempt could not enter IN_FLIGHT");
  const result = await port.deliver(inFlight);
  const resolvedAt = new Date().toISOString();
  if (result.outcome === "ACKNOWLEDGED") {
    const message: MessageRecord = {
      id: generateDeliveryMessageId(attempt.id),
      conversationId: inFlight.conversationId,
      actor: "agent",
      contentKind: "text",
      contentText: inFlight.textPayload,
      // DP-87/#10/#8: occurred_at only from a trusted typed source time; unknown -> NULL.
      occurredAt: result.occurredAt ?? null,
    };
    const final = finalizeAcknowledgedDelivery(conn, {
      attemptId: attempt.id, message, resolvedAt,
      sourceRef: result.sourceRef ?? null, occurredAt: result.occurredAt ?? null,
    });
    return { attempt: final, outcome: "ACKNOWLEDGED" };
  }
  const resolved = repo.resolve(attempt.id, result.outcome, resolvedAt);
  if (!resolved) throw new DeliveryAttemptError("delivery attempt could not resolve");
  return { attempt: resolved, outcome: result.outcome };
}

/**
 * DP-130 + I-40: atomically persist the delivered outbound message fact (actor=agent,
 * text) AND finalize the attempt to ACKNOWLEDGED with the delivered_message_id link, in
 * ONE SQLite transaction. Repeat finalize on an already-ACKNOWLEDGED attempt is a no-op
 * (no duplicate Timeline message). Refuses REJECTED/UNKNOWN/PENDING attempts.
 * observed_at is generated here (the delivery finalization boundary); textPayload is
 * never included in errors (I-41).
 */
export function finalizeAcknowledgedDelivery(
  conn: SqliteConnection,
  input: { attemptId: string; message: MessageRecord; resolvedAt: string; sourceRef: string | null; occurredAt: string | null }
): DeliveryAttemptRecord {
  const repo = new SqliteDeliveryAttemptRepository(conn);
  const attempt = repo.findById(input.attemptId);
  if (!attempt) throw new DeliveryAttemptError("delivery attempt not found");
  if (attempt.status === "ACKNOWLEDGED") return attempt; // I-40 idempotent
  if (attempt.status !== "IN_FLIGHT") throw new DeliveryAttemptError("only IN_FLIGHT delivery attempts may be acknowledged");
  const message: MessageRecord = {
    ...input.message,
    id: input.message.id ?? generateDeliveryMessageId(input.attemptId),
    conversationId: attempt.conversationId,
    actor: "agent",
    contentKind: "text",
    contentText: attempt.textPayload,
    occurredAt: input.occurredAt ?? null,
    observedAt: new Date().toISOString(),
  };
  conn.transaction(() => {
    new SqliteMessageRepository(conn).save(message);
    repo.updateAcknowledged(input.attemptId, { resolvedAt: input.resolvedAt, deliveredMessageId: message.id, ackSourceRef: input.sourceRef, ackOccurredAt: input.occurredAt });
  });
  const final = repo.findById(input.attemptId);
  if (!final) throw new DeliveryAttemptError("delivery attempt finalization failed");
  return final;
}

/** DP-128 recovery: unresolved IN_FLIGHT attempts become UNKNOWN (not FAILED); no auto-retry (I-33). */
export function recoverInFlightAttempts(conn: SqliteConnection, resolvedAt: string): number {
  return new SqliteDeliveryAttemptRepository(conn).recoverInFlight(resolvedAt);
}
/**
 * SHEEP-074-PR1: merchant-scoped startup recovery (DP-178, I-115..I-119).
 *
 * Recovers ONLY unresolved IN_FLIGHT delivery attempts whose conversation belongs
 * to the given workspace merchant -> UNKNOWN (DP-128/I-33: never REJECTED/ACK,
 * never auto-retry, no delivered fact). Attempts of OTHER merchants and attempts
 * whose conversation owner cannot be determined are left untouched (I-119: recovery
 * scope follows the recovered state owner; never inferred from an unrelated
 * workspace filter). No whole-DB unscoped UPDATE is performed.
 *
 * Idempotent (I-116): resolve() only transitions PENDING/IN_FLIGHT, so repeated
 * startup runs are no-ops. Failures propagate (I-117: fail closed for the affected
 * subsystem; never swallow an error and claim recovery success).
 */
export interface DeliveryAttemptRecoveryResult {
  /** Number of this workspace merchant's unresolved IN_FLIGHT attempts recovered to UNKNOWN. */
  recovered: number;
  /** IN_FLIGHT attempts left untouched (other merchant or unknown conversation owner). */
  untouchedOtherOrUnknownOwner: number;
}

export function recoverWorkspaceInFlightDeliveryAttempts(
  conn: SqliteConnection,
  merchantId: string,
  resolvedAt: string
): DeliveryAttemptRecoveryResult {
  const repo = new SqliteDeliveryAttemptRepository(conn);
  const convRepo = new SqliteNormalizedConversationRepository(conn);
  let recovered = 0;
  let untouched = 0;
  for (const attempt of repo.listInFlight()) {
    const conv = convRepo.findById(attempt.conversationId);
    if (!conv || conv.merchantId !== merchantId) {
      untouched += 1;
      continue;
    }
    if (repo.resolve(attempt.id, "UNKNOWN", resolvedAt)) {
      recovered += 1;
    } else {
      untouched += 1; // concurrent/terminal change -> idempotent no-op
    }
  }
  return { recovered, untouchedOtherOrUnknownOwner: untouched };
}
