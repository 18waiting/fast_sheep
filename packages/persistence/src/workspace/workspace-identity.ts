// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// SHEEP-063-PR2-PR1: local workspace merchant identity bootstrap (Option B).
//
// Decisions consumed:
//   DP-99  LOCAL_WORKSPACE_MERCHANT_IDENTITY_IS_STABLE_GENERATED_IDENTITY_NOT_MAGIC_DEFAULT
//   DP-100 APP_META_STORES_WORKSPACE_IDENTITY_POINTER_NOT_MERCHANT_DOMAIN_DATA
//   DP-101 WORKSPACE_IDENTITY_ESTABLISHMENT_IS_ATOMIC
//   DP-103 MERCHANT_IDENTITY_DOES_NOT_REQUIRE_KNOWN_DISPLAY_NAME (name = NULL = unknown)
//   I-20   WORKSPACE_IDENTITY_BOOTSTRAP_CREATES_ONLY_ON_UNINITIALIZED_DATA_ROOT
//   I-21   EXISTING_IDENTITY_DATA_WITHOUT_WORKSPACE_POINTER_IS_AMBIGUOUS_NOT_BOOTSTRAPPABLE
//   I-23   PRESENTATION_FALLBACK_LABELS_MUST_NOT_BE_PERSISTED_AS_UNKNOWN_DOMAIN_FACTS
//   I-24   UNKNOWN_OPTIONAL_IDENTITY_FACTS_USE_NULL_NOT_MAGIC_OR_EMPTY_VALUES
//
// The bootstrap establishes the SINGLE local workspace merchant on a truly
// uninitialized data root: one merchants row (name = NULL, i.e. no trusted
// business/display-name fact) + one app_meta.workspace_merchant_id pointer, in a
// single atomic transaction. It NEVER infers identity from ambient data
// (selected shop / queue scope / active conversation / first row / count == 1).
// It never fabricates a merchant name, member, membership, or auth fact.
import { randomUUID } from "node:crypto";
import type { SqliteConnection } from "../db/sqlite-driver.js";
import { PersistenceError, ERROR_CODES } from "../db/errors.js";

/** app_meta key holding the workspace merchant identity POINTER (DP-100). */
export const WORKSPACE_MERCHANT_ID_META_KEY = "workspace_merchant_id";

/** Workspace identity bootstrap failures (dangling pointer / ambiguous legacy). */
export class WorkspaceIdentityError extends PersistenceError {
  constructor(message: string) {
    super(ERROR_CODES.WORKSPACE_IDENTITY, message);
  }
}

/**
 * Minimal accessors needed to resolve-or-bootstrap the local workspace merchant
 * identity. Kept thin: this is an authorization anchor's identity source, not a
 * session/user/subscription/permission framework (DP-97).
 */
export interface WorkspaceIdentityBootstrap {
  /** Read the app_meta workspace merchant pointer (null = not bootstrapped). */
  resolveWorkspaceMerchantId(): string | null;
  /** Whether a merchants row with the given id exists (pointer integrity). */
  merchantExists(id: string): boolean;
  /** Whether ANY merchants row exists (ambiguous existing identity, I-21). */
  hasMerchantRows(): boolean;
  /**
   * ATOMICALLY create the single local workspace merchant (name = NULL, unknown)
   * and its app_meta pointer (DP-101). Must not be called when identity data
   * already exists without a pointer (I-21).
   */
  bootstrapWorkspaceMerchantId(generateId: () => string): string;
}

export class SqliteWorkspaceIdentityBootstrap implements WorkspaceIdentityBootstrap {
  constructor(private readonly conn: SqliteConnection) {}

  resolveWorkspaceMerchantId(): string | null {
    const row = this.conn.get<{ value: string } | undefined>(
      "SELECT value FROM app_meta WHERE key = ?",
      WORKSPACE_MERCHANT_ID_META_KEY
    );
    return row?.value ?? null;
  }

  merchantExists(id: string): boolean {
    return this.conn.get<{ one: number } | undefined>("SELECT 1 AS one FROM merchants WHERE id = ?", id) !== undefined;
  }

  hasMerchantRows(): boolean {
    return (this.conn.get<{ c: number } | undefined>("SELECT COUNT(*) AS c FROM merchants")?.c ?? 0) > 0;
  }

  bootstrapWorkspaceMerchantId(generateId: () => string): string {
    const id = generateId();
    this.conn.transaction(() => {
      // name = NULL: no trusted business/display-name fact (DP-103/I-24). Never
      // persist a presentation fallback or magic label into the domain (I-23).
      this.conn.run("INSERT INTO merchants (id, name) VALUES (?, NULL)", id);
      this.conn.run(
        "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)",
        WORKSPACE_MERCHANT_ID_META_KEY,
        id
      );
    });
    return id;
  }
}

/**
 * Stable generated internal MerchantId (DP-99), reusing the project's existing
 * id convention: meaningful prefix + randomUUID. Not a magic "default".
 */
export function generateWorkspaceMerchantId(): string {
  return "merchant-" + randomUUID();
}

/**
 * Resolve-or-bootstrap the local workspace merchant identity (I-20/I-21):
 *  - pointer exists -> validate merchants row exists -> return (fail closed on
 *    dangling pointer; NO silent replacement);
 *  - no pointer + any merchants row -> AMBIGUOUS (fail closed; no first-row /
 *    count==1 inference);
 *  - truly uninitialized -> atomic bootstrap (merchant name=NULL + pointer).
 */
export function resolveOrBootstrapWorkspaceMerchantId(
  bootstrap: WorkspaceIdentityBootstrap,
  generateId: () => string = generateWorkspaceMerchantId
): string {
  const existing = bootstrap.resolveWorkspaceMerchantId();
  if (existing !== null) {
    if (!bootstrap.merchantExists(existing)) {
      throw new WorkspaceIdentityError(
        `workspace merchant pointer ${existing} is dangling (merchants row missing); fail closed, no silent replacement`
      );
    }
    return existing;
  }
  if (bootstrap.hasMerchantRows()) {
    throw new WorkspaceIdentityError(
      "existing merchant identity data without a workspace pointer is ambiguous; fail closed (no first-row/count==1 inference)"
    );
  }
  return bootstrap.bootstrapWorkspaceMerchantId(generateId);
}

