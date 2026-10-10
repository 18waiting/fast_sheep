/**
 * AU-04: Pure PreSendGuard.
 *
 * This module is deliberately not wired into ConversationOrchestrator or
 * PlatformAdapter. It evaluates an immutable ExecutionIntent against
 * AdapterIdentityEvidence using deterministic comparison only.
 */

import {
  type AdapterIdentityEvidence,
  type ContractIdentityLock,
  type ExecutionIntent,
  type ExecutionIntentConfirmationRef,
  type ExecutionIntentPlanRef,
  type ExecutionIntentPolicyRef,
  validateAdapterIdentityEvidence,
  validateExecutionIntent,
  verifyExecutionIntentHash,
} from "@fastwork/domain";
import { BindingValidator } from "./binding-validator.js";
import { WrongTargetValidator } from "./wrong-target-validator.js";

export type PreSendGuardDenyReason =
  | "INTENT_INVALID"
  | "INTENT_HASH_INVALID"
  | "INTENT_EXPIRED"
  | "INTENT_STATE_INVALID"
  | "INTENT_ALREADY_CONSUMED"
  | "ADAPTER_EVIDENCE_PARTIAL"
  | "ADAPTER_EVIDENCE_UNAVAILABLE"
  | "EXPECTED_IDENTITY_MISSING"
  | "ACTUAL_IDENTITY_MISSING"
  | "IDENTITY_MISMATCH"
  | "PLAN_MISMATCH"
  | "POLICY_MISMATCH"
  | "CONFIRMATION_MISSING"
  | "CONFIRMATION_EXPIRED"
  | "CONFIRMATION_REPLAYED"
  | "SESSION_GENERATION_MISMATCH"
  | "DOCUMENT_GENERATION_MISMATCH"
  | "WRONG_TARGET_VALIDATION_FAILED"
  | "BINDING_VALIDATION_FAILED";

export interface PreSendGuardBindingEvidence {
  readonly plan_ref: ExecutionIntentPlanRef;
  readonly policy_ref: ExecutionIntentPolicyRef;
  readonly confirmation_ref?: ExecutionIntentConfirmationRef;
}

export interface PreSendGuardRequest {
  readonly intent: ExecutionIntent;
  readonly identity_evidence: AdapterIdentityEvidence;
  readonly binding_evidence: PreSendGuardBindingEvidence;
  readonly evaluated_at: string;
}

export interface PreSendGuardFailure {
  readonly reason: PreSendGuardDenyReason;
  readonly field?: string;
  readonly expected?: string;
  readonly actual?: string;
  readonly detail?: string;
}

export interface PreSendGuardAuditRecord {
  readonly intent_id: string;
  readonly intent_hash: string;
  readonly plan_id: string;
  readonly policy_version: string;
  readonly evidence_id: string;
  readonly observed_at: string;
  readonly evaluated_at: string;
  readonly allowed: boolean;
  readonly reason_codes: readonly PreSendGuardDenyReason[];
}

export interface PreSendGuardResult {
  readonly allowed: boolean;
  readonly failures: readonly PreSendGuardFailure[];
  readonly audit: PreSendGuardAuditRecord;
}

export interface PreSendGuardPort {
  evaluate(request: PreSendGuardRequest): Promise<PreSendGuardResult>;
}

function isIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function isTerminalOrClaimed(state: ExecutionIntent["state"]): boolean {
  return state === "CLAIMED"
    || state === "ATTEMPTED"
    || state === "ACKNOWLEDGED"
    || state === "REJECTED"
    || state === "UNKNOWN"
    || state === "EXPIRED"
    || state === "CANCELLED";
}

function requiredIdentityFailure(
  field: string,
  actual: string | undefined,
  failures: PreSendGuardFailure[],
): void {
  if (!actual || actual.trim() === "") {
    failures.push({ reason: "ACTUAL_IDENTITY_MISSING", field });
  }
}

export class PreSendGuard implements PreSendGuardPort {
  private readonly wrongTargetValidator: WrongTargetValidator;
  private readonly bindingValidator: BindingValidator;

  constructor(
    wrongTargetValidator?: WrongTargetValidator,
    bindingValidator?: BindingValidator,
  ) {
    this.wrongTargetValidator = wrongTargetValidator ?? new WrongTargetValidator();
    this.bindingValidator = bindingValidator ?? new BindingValidator();
  }

  async evaluate(request: PreSendGuardRequest): Promise<PreSendGuardResult> {
    const failures: PreSendGuardFailure[] = [];
    const { intent, identity_evidence: evidence, binding_evidence: binding } = request;

    const intentValidation = validateExecutionIntent(intent);
    if (!intentValidation.valid) {
      for (const failure of intentValidation.failures) {
        failures.push({ reason: "INTENT_INVALID", field: failure.field, detail: failure.reason });
      }
    }

    if (!(await verifyExecutionIntentHash(intent))) {
      failures.push({ reason: "INTENT_HASH_INVALID", field: "intent_hash" });
    }

    if (!isIsoDate(request.evaluated_at)) {
      failures.push({ reason: "INTENT_INVALID", field: "evaluated_at", detail: "evaluated_at must be ISO 8601" });
    } else if (Date.parse(intent.expires_at) <= Date.parse(request.evaluated_at)) {
      failures.push({ reason: "INTENT_EXPIRED", field: "expires_at" });
    }

    if (isTerminalOrClaimed(intent.state)) {
      failures.push({ reason: "INTENT_ALREADY_CONSUMED", field: "state", actual: intent.state });
    } else if (intent.authorization_source === "HUMAN_CONFIRMATION" && intent.state !== "CONFIRMED") {
      failures.push({ reason: "INTENT_STATE_INVALID", field: "state", detail: "HUMAN_CONFIRMATION requires CONFIRMED state" });
    } else if (intent.authorization_source === "POLICY_AUTHORIZATION" && intent.state !== "PLAN_BOUND") {
      failures.push({ reason: "INTENT_STATE_INVALID", field: "state", detail: "POLICY_AUTHORIZATION requires PLAN_BOUND state" });
    }

    const confirmation = intent.confirmation_ref;
    if (intent.authorization_source === "HUMAN_CONFIRMATION") {
      if (!confirmation) {
        failures.push({ reason: "CONFIRMATION_MISSING", field: "confirmation_ref" });
      } else if (confirmation.expires_at && Date.parse(confirmation.expires_at) <= Date.parse(request.evaluated_at)) {
        failures.push({ reason: "CONFIRMATION_EXPIRED", field: "confirmation_ref.expires_at" });
      }
    }

    const evidenceValidation = validateAdapterIdentityEvidence(evidence);
    if (!evidenceValidation.valid) {
      const reason: PreSendGuardDenyReason = evidence.availability === "COMPLETE"
        ? "ADAPTER_EVIDENCE_UNAVAILABLE"
        : "ADAPTER_EVIDENCE_PARTIAL";
      for (const failure of evidenceValidation.failures) {
        failures.push({ reason, field: failure.field, detail: failure.reason });
      }
    }

    this.compareBindingEvidence(intent, binding, failures);

    const expected = intent.identity_lock;
    const actual: ContractIdentityLock | undefined = evidence.identity_lock;
    if (!actual) {
      failures.push({ reason: "ACTUAL_IDENTITY_MISSING", field: "identity_lock" });
    } else {
      this.compareIdentityLock(expected, actual, failures);
    }

    if (expected.merchant_id.trim() === "") failures.push({ reason: "EXPECTED_IDENTITY_MISSING", field: "identity_lock.merchant_id" });
    if (expected.store_id.trim() === "") failures.push({ reason: "EXPECTED_IDENTITY_MISSING", field: "identity_lock.store_id" });
    if (expected.platform_account_id.trim() === "") failures.push({ reason: "EXPECTED_IDENTITY_MISSING", field: "identity_lock.platform_account_id" });
    if (expected.conversation_id.trim() === "") failures.push({ reason: "EXPECTED_IDENTITY_MISSING", field: "identity_lock.conversation_id" });
    if (expected.trigger_message_id.trim() === "") failures.push({ reason: "EXPECTED_IDENTITY_MISSING", field: "identity_lock.trigger_message_id" });
    if (expected.customer_identity.value.trim() === "") failures.push({ reason: "EXPECTED_IDENTITY_MISSING", field: "identity_lock.customer_identity.value" });

    requiredIdentityFailure("identity_lock.store_id", actual?.store_id, failures);
    requiredIdentityFailure("identity_lock.platform_account_id", actual?.platform_account_id, failures);
    requiredIdentityFailure("identity_lock.conversation_id", actual?.conversation_id, failures);
    requiredIdentityFailure("identity_lock.trigger_message_id", actual?.trigger_message_id, failures);
    requiredIdentityFailure("identity_lock.customer_identity.value", actual?.customer_identity.value, failures);
    requiredIdentityFailure("session_id", evidence.session_id, failures);
    requiredIdentityFailure("session_generation", evidence.session_generation, failures);
    requiredIdentityFailure("document_generation", evidence.document_generation, failures);

    if (expected.store_id !== evidence.identity_lock?.store_id) {
      failures.push({ reason: "IDENTITY_MISMATCH", field: "identity_lock.store_id", expected: expected.store_id, actual: evidence.identity_lock?.store_id });
    }

    const targetValidation = this.wrongTargetValidator.validate({
      shopId: actual?.store_id ?? evidence.runtime_shop_id ?? "",
      conversationId: actual?.conversation_id ?? "",
      customerUid: actual?.customer_identity.kind === "customerUid" ? actual.customer_identity.value : undefined,
      platformAccountId: actual?.platform_account_id,
      triggerMessageId: actual?.trigger_message_id,
      sessionId: evidence.session_id,
      documentVersion: evidence.document_generation,
      expectedShopId: expected.store_id,
      expectedCustomerUid: expected.customer_identity.kind === "customerUid"
        ? expected.customer_identity.value
        : undefined,
      expectedDocumentVersion: intent.document_generation,
    });
    if (!targetValidation.valid) {
      for (const failure of targetValidation.failures) {
        failures.push({ reason: "WRONG_TARGET_VALIDATION_FAILED", field: failure.field, expected: failure.expected, actual: failure.actual, detail: failure.reason });
      }
    }

    const bindingValidation = this.bindingValidator.validate({
      shopId: actual?.store_id ?? "",
      platformAccountId: actual?.platform_account_id ?? "",
      conversationId: actual?.conversation_id ?? "",
      triggerMessageId: actual?.trigger_message_id ?? "",
      sessionId: evidence.session_id ?? "",
      documentVersion: evidence.document_generation ?? "",
    });
    if (!bindingValidation.valid) {
      for (const failure of bindingValidation.failures) {
        failures.push({ reason: "BINDING_VALIDATION_FAILED", field: failure.binding, detail: failure.reason });
      }
    }

    if (expected.generation !== undefined && actual?.generation !== expected.generation) {
      failures.push({ reason: "IDENTITY_MISMATCH", field: "identity_lock.generation", expected: String(expected.generation), actual: actual?.generation === undefined ? undefined : String(actual.generation) });
    }

    if (intent.session_generation !== evidence.session_generation) {
      failures.push({ reason: "SESSION_GENERATION_MISMATCH", field: "session_generation", expected: intent.session_generation, actual: evidence.session_generation });
    }
    if (intent.document_generation !== evidence.document_generation) {
      failures.push({ reason: "DOCUMENT_GENERATION_MISMATCH", field: "document_generation", expected: intent.document_generation, actual: evidence.document_generation });
    }

    const reasonCodes = [...new Set(failures.map((failure) => failure.reason))];
    const allowed = failures.length === 0;
    return {
      allowed,
      failures,
      audit: {
        intent_id: intent.intent_id,
        intent_hash: intent.intent_hash,
        plan_id: intent.plan_ref.plan_id,
        policy_version: intent.policy_ref.policy_version,
        evidence_id: evidence.evidence_id,
        observed_at: evidence.observed_at,
        evaluated_at: request.evaluated_at,
        allowed,
        reason_codes: reasonCodes,
      },
    };
  }

  private compareBindingEvidence(
    intent: ExecutionIntent,
    binding: PreSendGuardBindingEvidence,
    failures: PreSendGuardFailure[],
  ): void {
    if (intent.plan_ref.plan_id !== binding.plan_ref.plan_id || intent.plan_ref.plan_hash !== binding.plan_ref.plan_hash) {
      failures.push({ reason: "PLAN_MISMATCH", field: "plan_ref" });
    }
    if (intent.policy_ref.policy_version !== binding.policy_ref.policy_version) {
      failures.push({ reason: "POLICY_MISMATCH", field: "policy_ref.policy_version" });
    }
    if (intent.authorization_source === "HUMAN_CONFIRMATION") {
      const expectedConfirmation = intent.confirmation_ref;
      const actualConfirmation = binding.confirmation_ref;
      if (!actualConfirmation) {
        failures.push({ reason: "CONFIRMATION_MISSING", field: "binding_evidence.confirmation_ref" });
      } else if (!expectedConfirmation) {
        failures.push({ reason: "CONFIRMATION_MISSING", field: "confirmation_ref" });
      } else if (
        expectedConfirmation.confirmation_id !== actualConfirmation.confirmation_id
        || expectedConfirmation.confirmation_hash !== actualConfirmation.confirmation_hash
        || expectedConfirmation.confirmed_at !== actualConfirmation.confirmed_at
        || expectedConfirmation.expires_at !== actualConfirmation.expires_at
      ) {
        failures.push({ reason: "CONFIRMATION_REPLAYED", field: "binding_evidence.confirmation_ref" });
      }
    } else if (binding.confirmation_ref !== undefined) {
      failures.push({ reason: "CONFIRMATION_REPLAYED", field: "binding_evidence.confirmation_ref", detail: "POLICY_AUTHORIZATION must not carry confirmation evidence" });
    }
  }

  private compareIdentityLock(
    expected: ContractIdentityLock,
    actual: ContractIdentityLock,
    failures: PreSendGuardFailure[],
  ): void {
    const fields: readonly [string, string, string][] = [
      ["merchant_id", expected.merchant_id, actual.merchant_id],
      ["store_id", expected.store_id, actual.store_id],
      ["platform", expected.platform, actual.platform],
      ["platform_account_id", expected.platform_account_id, actual.platform_account_id],
      ["conversation_id", expected.conversation_id, actual.conversation_id],
      ["trigger_message_id", expected.trigger_message_id, actual.trigger_message_id],
      ["customer_identity.kind", expected.customer_identity.kind, actual.customer_identity.kind],
      ["customer_identity.value", expected.customer_identity.value, actual.customer_identity.value],
    ];

    for (const [field, expectedValue, actualValue] of fields) {
      if (expectedValue !== actualValue) {
        failures.push({ reason: "IDENTITY_MISMATCH", field: `identity_lock.${field}`, expected: expectedValue, actual: actualValue });
      }
    }
  }
}
