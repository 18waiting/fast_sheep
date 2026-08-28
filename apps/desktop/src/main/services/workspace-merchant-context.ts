// SHEEP-063-PR2: Main-owned WorkspaceMerchantContext — minimal authorization anchor.
//
// Decisions consumed:
//   DP-94  WORKSPACE_MERCHANT_CONTEXT_IS_MAIN_OWNED_AND_QUEUE_SCOPE_INDEPENDENT
//   DP-95  LOCAL_DESKTOP_RUNTIME_HAS_ONE_ACTIVE_MERCHANT_WORKSPACE_UNTIL_MULTI_MERCHANT_REQUIREMENT_EXISTS
//   DP-96  WORKSPACE_MERCHANT_IDENTITY_IS_EXPLICITLY_COMPOSED_NOT_INFERRED_FROM_AMBIENT_DATA
//   DP-97  WORKSPACE_MERCHANT_CONTEXT_IS_A_MINIMAL_AUTHORIZATION_ANCHOR_NOT_A_SESSION_FRAMEWORK
//   I-18   CONVERSATION_BOUND_READS_REQUIRE_TRUSTED_WORKSPACE_MERCHANT_CONTAINMENT
//   I-19   WORKSPACE_MERCHANT_CONTEXT_IS_STABLE_FOR_A_MAIN_CONTEXT_LIFETIME
//
// The context is created once by the Main composition from the trusted workspace
// identity bootstrap (SHEEP-063-PR2-PR1) or an explicit synthetic value in test
// mode. It is frozen and never renderer-settable; Store/Platform Queue Scope,
// selected shop, and active conversation are NOT merchant authority (DP-94/I-17).
// It carries only the merchant identity + the minimal containment accessor —
// no session/user/subscription/permission/store/platform/active-conversation
// framework (DP-97). It is stable for a Main context lifetime (I-19); future
// explicit workspace switching requires a separate product/lifecycle decision.
export interface WorkspaceMerchantContext {
  /** Authoritative workspace merchant id (stable, Main-owned). */
  readonly merchantId: string;
  /**
   * I-18 minimal containment: a conversation-bound resource is authorized iff its
   * merchantId equals the workspace merchant id. Minimal capability only; this is
   * not an authorization middleware/framework.
   */
  containsMerchant(merchantId: string | null | undefined): boolean;
}

export function createWorkspaceMerchantContext(merchantId: string): WorkspaceMerchantContext {
  if (!merchantId || merchantId.trim() === "") {
    throw new Error("workspace merchant id must be a non-empty stable identity");
  }
  return Object.freeze({
    merchantId,
    containsMerchant(other: string | null | undefined): boolean {
      return other != null && other === merchantId;
    },
  });
}

