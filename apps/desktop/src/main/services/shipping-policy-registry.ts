// SHEEP-305 Lane B — offline shipping policy registration registry (in-memory, no activation).
//
// Authority: Roadmap V1.1 SHEEP-305 (allowed scope: rule contract, fact-provider boundary, focused
// tests) + the Owner-authorized Lane B offline registration + the Lane B registration design recorded
// in reports/SHEEP-305-policy-first-v1-product-decision.json (lane_b_registration_design).
//
// Boundaries (all asserted by tests):
//   - IN MEMORY ONLY: nothing is persisted; a rebuilt instance is empty (no durability claim).
//   - NO ACTIVATION: this registry has no promote/verify/activate/force API. ACTIVE is unreachable
//     through it, identity declarations stay OWNER_DECLARED / UNVERIFIED forever here, and the
//     pure transition rule is exported only so the allowed/forbidden transitions can be unit tested.
//   - NO REAL BINDING WRITE: it never writes stores/platform_accounts/shops rows, never touches the
//     canonical schema and is not wired into bootstrap.
//   - Scope isolation: records are keyed by an explicit scope; reads, revokes and replacements from
//     another scope are refused, and no record is shared between scopes. The scope key is an
//     unambiguous structured encoding (see scopeKey), so no identifier content can blur a boundary.
//   - Replacement history: a source is linked to at most one target. Re-linking the same target is
//     idempotent; pointing at a different target is refused (REPLACEMENT_TARGET_ALREADY_SET), so an
//     existing relation is never silently rewritten. Moving a link needs a future revision mechanism.
//   - Snapshot isolation: inputs are deep-copied and frozen on the way in; query results are deep
//     copies on the way out, so callers can never mutate internal state through a shared object.
//
// Caller premise (explicit): the caller is a trusted Main-side component. Scope equality is an
// ISOLATION check only - it is NOT ownership proof and NOT platform identity verification. Passing a
// non-empty id proves nothing about who owns that store/account. This registry is IN-MEMORY: a
// rebuilt instance is empty and nothing here is a durable registration.

export type RegistrationScope = {
  readonly merchantId: string | null;
  readonly storeId: string | null;
  readonly platformAccountId: string | null;
};

export type RegistrationKind = "OWNER_IDENTITY_DECLARATION" | "POLICY_VERSION";

/** Lifecycle vocabulary is identical to the Lane A contract (one vocabulary, no parallel states). */
export type RegistrationLifecycle = "DRAFT" | "NOT_EFFECTIVE" | "ACTIVE" | "SUPERSEDED" | "REVOKED";

export type RegistrationRejectionReason =
  | "SCOPE_UNBOUND"
  | "SCOPE_MISMATCH"
  | "IDENTIFIER_MISSING"
  | "PLATFORM_MISSING"
  | "POLICY_ID_MISSING"
  | "POLICY_VERSION_MISSING"
  | "QUOTED_TEXT_MISSING"
  | "STRUCTURED_ITEMS_INVALID"
  | "EXCEPTIONS_NOT_APPROVED"
  | "NOT_FOUND"
  | "CONTENT_CONFLICT"
  | "DECLARATION_CONFLICT"
  | "ALREADY_REVOKED"
  | "REVOKE_NOT_ALLOWED_FOR_LIFECYCLE"
  | "REPLACEMENT_SELF_REFERENCE"
  | "REPLACEMENT_CYCLE"
  | "REPLACEMENT_TARGET_NOT_FOUND"
  | "REPLACEMENT_SCOPE_MISMATCH"
  | "REPLACEMENT_SOURCE_REVOKED"
  | "REPLACEMENT_TARGET_REVOKED"
  | "REPLACEMENT_POLICY_MISMATCH"
  | "REPLACEMENT_TARGET_ALREADY_SET"
  | "EFFECTIVE_WINDOW_NOT_ALLOWED"
  | "ACTIVATION_NOT_AUTHORIZED"
  | "RUNTIME_PROMOTION_NOT_AVAILABLE";

export interface RegistrationResult {
  readonly status: "REGISTERED" | "IDEMPOTENT" | "REVOKED" | "REJECTED";
  readonly reason: RegistrationRejectionReason | null;
  readonly registration_id: string | null;
  /**
   * Current lifecycle of the referenced record. A replay of an already revoked registration stays
   * IDEMPOTENT (no resurrection, no second record) but reports REVOKED here so it cannot be read as an
   * active draft. null on REJECTED results.
   */
  readonly lifecycle: RegistrationLifecycle | null;
}

export interface OwnerIdentityDeclarationRecord {
  readonly registration_id: string;
  readonly kind: "OWNER_IDENTITY_DECLARATION";
  readonly scope: RegistrationScope;
  readonly platform: string;
  readonly owner_declared_identifier: string;
  readonly identifier_source: "OWNER_DECLARED";
  readonly platform_binding: "UNVERIFIED";
  readonly basis_ref: string;
  readonly declared_at: string | null;
  readonly lifecycle: RegistrationLifecycle;
  readonly revoked_reason: string | null;
}

export interface PolicyVersionRegistrationRecord {
  readonly registration_id: string;
  readonly kind: "POLICY_VERSION";
  readonly scope: RegistrationScope;
  readonly policy_id: string;
  readonly policy_version: string;
  readonly lifecycle: RegistrationLifecycle;
  readonly confirmation_state: "OWNER_CONFIRMED_CONTENT";
  /** Owner chat text is content-approval evidence only; no approver name or date is invented. */
  readonly content_approval: { readonly kind: "OWNER_CHAT_TEXT"; readonly basis_ref: string; readonly quoted_text: string };
  readonly structured_items: readonly { readonly item: string; readonly value: string }[];
  /** Points at the older registration this one would replace; it never changes the older record. */
  readonly replaces_registration_id: string | null;
  readonly effective: { readonly from: null; readonly to: null };
  readonly registered_at: string | null;
  readonly revoked_reason: string | null;
}

export type RegistrationRecord = OwnerIdentityDeclarationRecord | PolicyVersionRegistrationRecord;

/**
 * Read view: the stored record plus the CURRENT validity of its replacement relation. The stored
 * pointer is historical audit data; validity is derived on read, so revoking an endpoint immediately
 * makes the relation non-effective without rewriting history or resurrecting anything.
 */
export type RegistrationRecordView = RegistrationRecord & {
  readonly replaces_relation: {
    readonly target_registration_id: string;
    readonly target_policy_id: string | null;
    readonly valid: boolean;
    readonly invalid_reason: "ENDPOINT_REVOKED" | "ENDPOINT_NOT_IN_OFFLINE_LIFECYCLE" | "TARGET_MISSING" | null;
  } | null;
};

export interface RegisterIdentityDeclarationInput {
  readonly scope: RegistrationScope;
  readonly platform: string;
  readonly ownerDeclaredIdentifier: string;
  readonly basisRef: string;
  readonly declaredAt?: string | null;
}

export interface RegisterPolicyVersionInput {
  readonly scope: RegistrationScope;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly quotedText: string;
  readonly structuredItems: readonly { readonly item: string; readonly value: string }[];
  readonly basisRef: string;
  readonly registeredAt?: string | null;
}

export interface ShippingPolicyRegistry {
  registerOwnerIdentityDeclaration(input: RegisterIdentityDeclarationInput): RegistrationResult;
  registerPolicyVersion(input: RegisterPolicyVersionInput): RegistrationResult;
  get(registrationId: string, scope: RegistrationScope): { readonly ok: true; readonly record: RegistrationRecordView } | { readonly ok: false; readonly reason: RegistrationRejectionReason };
  list(scope: RegistrationScope): readonly RegistrationRecordView[];
  revoke(registrationId: string, scope: RegistrationScope, reason: string): RegistrationResult;
  linkReplacement(input: { readonly newRegistrationId: string; readonly oldRegistrationId: string; readonly scope: RegistrationScope }): RegistrationResult;
  diagnostics(): {
    readonly records: number;
    readonly declarations: number;
    readonly policyVersions: number;
    readonly registrations: number;
    readonly idempotent: number;
    readonly revocations: number;
    readonly rejections: number;
    readonly aiCalls: 0;
    readonly sendCalls: 0;
    readonly persistenceWrites: 0;
    readonly providerCalls: 0;
    readonly networkCalls: 0;
    readonly sideEffectGuarantee: "STRUCTURAL_INVARIANT_NOT_A_RUNTIME_MEASUREMENT";
  };
}

/** Pure lifecycle rule (exported for tests only; the registry itself never activates anything). */
export function canTransition(from: RegistrationLifecycle, to: RegistrationLifecycle): boolean {
  const allowed: Record<RegistrationLifecycle, readonly RegistrationLifecycle[]> = {
    DRAFT: ["NOT_EFFECTIVE", "REVOKED"],
    NOT_EFFECTIVE: ["ACTIVE", "REVOKED"],
    ACTIVE: ["SUPERSEDED", "REVOKED"],
    SUPERSEDED: [],
    REVOKED: [],
  };
  return allowed[from].includes(to);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const key of Object.keys(value as Record<string, unknown>)) deepFreeze((value as Record<string, unknown>)[key]);
  return Object.freeze(value);
}

function snapshot<T>(value: T): T {
  return deepFreeze(JSON.parse(JSON.stringify(value)) as T);
}

/**
 * Unambiguous scope key. The three fields are JSON-encoded as an array, so a delimiter, quote or
 * backslash inside an identifier can never blur the field boundary, null (no account bound) stays
 * distinct from the empty string, and no name/hash/normalisation is used in place of identity.
 * Missing or invalid fields are still refused here rather than being encoded away.
 */
function scopeKey(scope: RegistrationScope): string | null {
  if (!isNonEmptyString(scope?.merchantId) || !isNonEmptyString(scope?.storeId)) return null;
  const account = scope.platformAccountId === undefined ? null : scope.platformAccountId;
  if (account !== null && typeof account !== "string") return null;
  return JSON.stringify([scope.merchantId, scope.storeId, account]);
}

const ALLOWED_STRUCTURED_ITEMS = new Set(["nature", "applicability", "clock_start", "time_value", "ship_complete_definition", "weekend_holiday_handling"]);

/**
 * ONE validation rule for structured items, shared by the registry and the Owner-material intake.
 * structured_items is a field SET keyed by the item name: it is unordered for equality purposes, so
 * the canonical form is sorted by item name. Duplicate keys are refused (same or different value) and
 * values are never trimmed, re-cased or rewritten.
 */
export function validateStructuredItems(items: unknown):
  | { readonly ok: true; readonly canonical: readonly { readonly item: string; readonly value: string }[] }
  | { readonly ok: false; readonly reason: RegistrationRejectionReason } {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, reason: "STRUCTURED_ITEMS_INVALID" };
  const seen = new Set<string>();
  const collected: { item: string; value: string }[] = [];
  for (const raw of items) {
    const entry = raw as { readonly item?: unknown; readonly value?: unknown };
    if (!isNonEmptyString(entry?.item) || !isNonEmptyString(entry?.value)) return { ok: false, reason: "STRUCTURED_ITEMS_INVALID" };
    if (seen.has(entry.item)) return { ok: false, reason: "STRUCTURED_ITEMS_INVALID" };
    seen.add(entry.item);
    if (!ALLOWED_STRUCTURED_ITEMS.has(entry.item)) {
      return { ok: false, reason: entry.item === "exceptions" ? "EXCEPTIONS_NOT_APPROVED" : "STRUCTURED_ITEMS_INVALID" };
    }
    collected.push({ item: entry.item, value: entry.value });
  }
  collected.sort((left, right) => (left.item < right.item ? -1 : left.item > right.item ? 1 : 0));
  return { ok: true, canonical: Object.freeze(collected) };
}

/** Field-wise equality of two canonical structured-item sets (array order already removed). */
function sameStructuredItems(
  left: readonly { readonly item: string; readonly value: string }[],
  right: readonly { readonly item: string; readonly value: string }[],
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index].item !== right[index].item || left[index].value !== right[index].value) return false;
  }
  return true;
}

export function createShippingPolicyRegistry(options: { readonly idPrefix?: string } = {}): ShippingPolicyRegistry {
  const records = new Map<string, RegistrationRecord>();
  const idPrefix = isNonEmptyString(options.idPrefix) ? options.idPrefix : "reg";
  let sequence = 0;
  const counters = { registrations: 0, idempotent: 0, revocations: 0, rejections: 0 };

  const reject = (reason: RegistrationRejectionReason): RegistrationResult => {
    counters.rejections += 1;
    return { status: "REJECTED", reason, registration_id: null, lifecycle: null };
  };
  const mintId = (kind: RegistrationKind): string => {
    sequence += 1;
    return idPrefix + "-" + (kind === "OWNER_IDENTITY_DECLARATION" ? "ident" : "policy") + "-" + String(sequence).padStart(4, "0");
  };
  const sameScope = (left: RegistrationScope, right: RegistrationScope): boolean => scopeKey(left) !== null && scopeKey(left) === scopeKey(right);
  const isOfflineLifecycle = (lifecycle: RegistrationLifecycle): boolean => lifecycle === "DRAFT" || lifecycle === "NOT_EFFECTIVE";
  const view = (record: RegistrationRecord): RegistrationRecordView => {
    const targetId = record.kind === "POLICY_VERSION" ? record.replaces_registration_id : null;
    let relation: RegistrationRecordView["replaces_relation"] = null;
    if (targetId !== null) {
      const target = records.get(targetId);
      if (target === undefined) {
        relation = { target_registration_id: targetId, target_policy_id: null, valid: false, invalid_reason: "TARGET_MISSING" };
      } else {
        const targetPolicyId = target.kind === "POLICY_VERSION" ? target.policy_id : null;
        const endpointsRevoked = record.lifecycle === "REVOKED" || target.lifecycle === "REVOKED";
        const endpointsOffline = isOfflineLifecycle(record.lifecycle) && isOfflineLifecycle(target.lifecycle);
        relation = {
          target_registration_id: targetId,
          target_policy_id: targetPolicyId,
          valid: !endpointsRevoked && endpointsOffline,
          invalid_reason: endpointsRevoked ? "ENDPOINT_REVOKED" : endpointsOffline ? null : "ENDPOINT_NOT_IN_OFFLINE_LIFECYCLE",
        } as RegistrationRecordView["replaces_relation"];
      }
    }
    const combined = { ...(record as unknown as Record<string, unknown>), replaces_relation: relation === null ? null : Object.freeze(relation) };
    return Object.freeze(combined) as unknown as RegistrationRecordView;
  };

  return {
    registerOwnerIdentityDeclaration(input: RegisterIdentityDeclarationInput): RegistrationResult {
      const key = scopeKey(input?.scope ?? ({} as RegistrationScope));
      if (key === null) return reject("SCOPE_UNBOUND");
      if (!isNonEmptyString(input.platform)) return reject("PLATFORM_MISSING");
      if (!isNonEmptyString(input.ownerDeclaredIdentifier)) return reject("IDENTIFIER_MISSING");
      if (!isNonEmptyString(input.basisRef)) return reject("IDENTIFIER_MISSING");
      for (const record of records.values()) {
        if (record.kind !== "OWNER_IDENTITY_DECLARATION") continue;
        if (!sameScope(record.scope, input.scope)) continue;
        if (record.platform !== input.platform || record.owner_declared_identifier !== input.ownerDeclaredIdentifier) continue;
        const identical = record.basis_ref === input.basisRef && (record.declared_at ?? null) === (input.declaredAt ?? null);
        if (identical) { counters.idempotent += 1; return { status: "IDEMPOTENT", reason: null, registration_id: record.registration_id, lifecycle: record.lifecycle }; }
        return reject("DECLARATION_CONFLICT");
      }
      const record: OwnerIdentityDeclarationRecord = snapshot({
        registration_id: mintId("OWNER_IDENTITY_DECLARATION"),
        kind: "OWNER_IDENTITY_DECLARATION",
        scope: { ...input.scope },
        platform: input.platform,
        owner_declared_identifier: input.ownerDeclaredIdentifier,
        identifier_source: "OWNER_DECLARED",
        platform_binding: "UNVERIFIED",
        basis_ref: input.basisRef,
        declared_at: input.declaredAt ?? null,
        lifecycle: "DRAFT",
        revoked_reason: null,
      });
      records.set(record.registration_id, record);
      counters.registrations += 1;
      return { status: "REGISTERED", reason: null, registration_id: record.registration_id, lifecycle: record.lifecycle };
    },

    registerPolicyVersion(input: RegisterPolicyVersionInput): RegistrationResult {
      const key = scopeKey(input?.scope ?? ({} as RegistrationScope));
      if (key === null) return reject("SCOPE_UNBOUND");
      if (!isNonEmptyString(input.policyId)) return reject("POLICY_ID_MISSING");
      if (!isNonEmptyString(input.policyVersion)) return reject("POLICY_VERSION_MISSING");
      if (!isNonEmptyString(input.quotedText)) return reject("QUOTED_TEXT_MISSING");
      if (!isNonEmptyString(input.basisRef)) return reject("QUOTED_TEXT_MISSING");
      const activationAttempt = input as { readonly lifecycle?: unknown; readonly effective?: unknown };
      if (activationAttempt.lifecycle !== undefined || activationAttempt.effective !== undefined) return reject("EFFECTIVE_WINDOW_NOT_ALLOWED");
      const validated = validateStructuredItems(input.structuredItems);
      if (!validated.ok) return reject(validated.reason);
      const items = validated.canonical;
      for (const record of records.values()) {
        if (record.kind !== "POLICY_VERSION") continue;
        if (!sameScope(record.scope, input.scope)) continue;
        if (record.policy_id !== input.policyId || record.policy_version !== input.policyVersion) continue;
        const identical = record.content_approval.quoted_text === input.quotedText
          && record.content_approval.basis_ref === input.basisRef
          && sameStructuredItems(record.structured_items, items);
        if (identical) { counters.idempotent += 1; return { status: "IDEMPOTENT", reason: null, registration_id: record.registration_id, lifecycle: record.lifecycle }; }
        return reject("CONTENT_CONFLICT");
      }
      const record: PolicyVersionRegistrationRecord = snapshot({
        registration_id: mintId("POLICY_VERSION"),
        kind: "POLICY_VERSION",
        scope: { ...input.scope },
        policy_id: input.policyId,
        policy_version: input.policyVersion,
        lifecycle: "DRAFT",
        confirmation_state: "OWNER_CONFIRMED_CONTENT",
        content_approval: { kind: "OWNER_CHAT_TEXT", basis_ref: input.basisRef, quoted_text: input.quotedText },
        structured_items: items.map((item) => ({ item: item.item, value: item.value })),
        replaces_registration_id: null,
        effective: { from: null, to: null },
        registered_at: input.registeredAt ?? null,
        revoked_reason: null,
      });
      records.set(record.registration_id, record);
      counters.registrations += 1;
      return { status: "REGISTERED", reason: null, registration_id: record.registration_id, lifecycle: record.lifecycle };
    },

    get(registrationId: string, scope: RegistrationScope) {
      if (scopeKey(scope) === null) return { ok: false as const, reason: "SCOPE_UNBOUND" as RegistrationRejectionReason };
      const record = records.get(registrationId);
      if (!record) return { ok: false as const, reason: "NOT_FOUND" as RegistrationRejectionReason };
      if (!sameScope(record.scope, scope)) return { ok: false as const, reason: "SCOPE_MISMATCH" as RegistrationRejectionReason };
      return { ok: true as const, record: snapshot<RegistrationRecordView>(view(record)) };
    },

    list(scope: RegistrationScope): readonly RegistrationRecordView[] {
      if (scopeKey(scope) === null) return [];
      return Object.freeze([...records.values()].filter((record) => sameScope(record.scope, scope)).map((record) => snapshot<RegistrationRecordView>(view(record))));
    },

    revoke(registrationId: string, scope: RegistrationScope, reason: string): RegistrationResult {
      if (scopeKey(scope) === null) return reject("SCOPE_UNBOUND");
      const record = records.get(registrationId);
      if (!record) return reject("NOT_FOUND");
      if (!sameScope(record.scope, scope)) return reject("SCOPE_MISMATCH");
      if (record.lifecycle === "REVOKED") return reject("ALREADY_REVOKED");
      if (record.lifecycle !== "DRAFT" && record.lifecycle !== "NOT_EFFECTIVE") return reject("REVOKE_NOT_ALLOWED_FOR_LIFECYCLE");
      const updated = snapshot({ ...record, lifecycle: "REVOKED" as RegistrationLifecycle, revoked_reason: isNonEmptyString(reason) ? reason : "REVOKED_BY_CONTROLLED_REGISTRATION" });
      records.set(registrationId, updated as RegistrationRecord);
      counters.revocations += 1;
      return { status: "REVOKED", reason: null, registration_id: registrationId, lifecycle: "REVOKED" };
    },

    linkReplacement(input: { readonly newRegistrationId: string; readonly oldRegistrationId: string; readonly scope: RegistrationScope }): RegistrationResult {
      if (scopeKey(input?.scope ?? ({} as RegistrationScope)) === null) return reject("SCOPE_UNBOUND");
      if (input.newRegistrationId === input.oldRegistrationId) return reject("REPLACEMENT_SELF_REFERENCE");
      const next = records.get(input.newRegistrationId);
      const previous = records.get(input.oldRegistrationId);
      if (!next || !previous) return reject("REPLACEMENT_TARGET_NOT_FOUND");
      if (!sameScope(next.scope, input.scope)) return reject("SCOPE_MISMATCH");
      if (!sameScope(previous.scope, next.scope)) return reject("REPLACEMENT_SCOPE_MISMATCH");
      if (next.kind !== "POLICY_VERSION" || previous.kind !== "POLICY_VERSION") return reject("REPLACEMENT_TARGET_NOT_FOUND");
      if (next.policy_id !== previous.policy_id) return reject("REPLACEMENT_POLICY_MISMATCH");
      if (next.lifecycle === "REVOKED") return reject("REPLACEMENT_SOURCE_REVOKED");
      if (previous.lifecycle === "REVOKED") return reject("REPLACEMENT_TARGET_REVOKED");
      if (!isOfflineLifecycle(next.lifecycle) || !isOfflineLifecycle(previous.lifecycle)) return reject("RUNTIME_PROMOTION_NOT_AVAILABLE");
      // cycle guard: walking the replaces chain from `next` must never reach `next` again
      let cursor: RegistrationRecord | undefined = previous;
      const seen = new Set<string>([input.newRegistrationId]);
      while (cursor !== undefined) {
        if (seen.has(cursor.registration_id)) return reject("REPLACEMENT_CYCLE");
        seen.add(cursor.registration_id);
        const linkedId: string | null = cursor.kind === "POLICY_VERSION" ? cursor.replaces_registration_id : null;
        cursor = linkedId === null ? undefined : records.get(linkedId);
      }
      // Replacement history is append-once: a source may be linked to a single target. Re-linking the
      // same target is an idempotent replay; pointing at a DIFFERENT target is refused so an existing
      // relation is never silently rewritten. Moving a link would need an explicit revision/audit
      // mechanism, which this offline slice deliberately does not provide.
      if (next.replaces_registration_id === input.oldRegistrationId) {
        counters.idempotent += 1;
        return { status: "IDEMPOTENT", reason: null, registration_id: input.newRegistrationId, lifecycle: next.lifecycle };
      }
      if (next.replaces_registration_id !== null) return reject("REPLACEMENT_TARGET_ALREADY_SET");
      // Linking is a DRAFT-level relation: it never changes the older record's lifecycle.
      records.set(input.newRegistrationId, snapshot({ ...next, replaces_registration_id: input.oldRegistrationId }));
      return { status: "REGISTERED", reason: null, registration_id: input.newRegistrationId, lifecycle: next.lifecycle };
    },

    diagnostics() {
      let declarations = 0;
      let policyVersions = 0;
      for (const record of records.values()) {
        if (record.kind === "OWNER_IDENTITY_DECLARATION") declarations += 1;
        else policyVersions += 1;
      }
      return {
        records: records.size,
        declarations,
        policyVersions,
        registrations: counters.registrations,
        idempotent: counters.idempotent,
        revocations: counters.revocations,
        rejections: counters.rejections,
        aiCalls: 0,
        sendCalls: 0,
        persistenceWrites: 0,
        providerCalls: 0,
        networkCalls: 0,
        sideEffectGuarantee: "STRUCTURAL_INVARIANT_NOT_A_RUNTIME_MEASUREMENT" as const,
      };
    },
  };
}
