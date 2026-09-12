// GENERATED TYPE MIRRORS — keep in sync with rebuild/packages/contracts/schemas/platform/*.schema.json.
// Clean-room implementation. JSON Schema (Draft 2020-12) is the single source of truth;
// these TS types mirror the M7 PDD page/session/capability schemas for static typing only.
// Do not add business logic here.

export type PddSessionStatusValue =
  | "STOPPED"
  | "CREATING"
  | "LOADING"
  | "LOGIN_REQUIRED"
  | "READY"
  | "DOM_UNSUPPORTED"
  | "AUTH_REAUTH_REQUIRED"
  | "ERROR"
  | "DISPOSED";

export interface PddSessionStatus {
  status: PddSessionStatusValue;
  session_id?: string;
  shop_id?: string;
  last_error?: string;
}

export interface PddPageEventBase {
  event: Exclude<
    | "page_ready"
    | "login_required"
    | "dom_unsupported"
    | "auth_reauth_required"
    | "conversation_changed"
    | "message_received"
    | "human_reply_detected"
    | "send_ack"
    | "transfer_ack"
    | "selected_customer_observed",
    "selected_customer_observed"
  >;
  session_id: string;
  document_generation?: number;
  shop_id?: string;
  conversation_id?: string;
  buyer_id?: string;
  buyer?: string;
  platform_message_id?: string;
  message_type?: string;
  direction?: "inbound" | "outbound";
  content?: string;
  timestamp?: string;
  command_id?: string;
  ok?: boolean;
  reason?: string;
  status?: string;
  customer_uid?: string;
  error?: string;
}

export type PddSelectedCustomerObservedEvent =
  | {
      event: "selected_customer_observed";
      session_id: string;
      document_generation?: number;
      shop_id: string;
      status: "SELECTED";
      customer_uid: string;
    }
  | {
      event: "selected_customer_observed";
      session_id: string;
      document_generation?: number;
      shop_id: string;
      status: "NONE" | "UNKNOWN";
    };

export type PddPageCommandType =
  | "scan"
  | "send_text"
  | "send_image"
  | "transfer"
  | "focus_conversation"
  | "health";

export interface PddPageCommand {
  type: PddPageCommandType;
  command_id: string;
  session_id: string;
  shop_id?: string;
  conversation_id?: string;
  text?: string;
  asset_ref?: string;
  target?: string;
}

export interface PddPageCommandResult {
  command_id: string;
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string;
}

export interface PddCapabilities {
  receive_text: boolean;
  send_text: boolean;
  send_image: boolean;
  manual_takeover_detection: boolean;
  conversation_selection: boolean;
  transfer: boolean;
  product_context?: boolean;
  order_context?: boolean;
  desktop_helper?: boolean;
}
