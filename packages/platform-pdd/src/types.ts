// M7 PDD platform types (clean-room). Domain types for the PDD vertical slice.
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

export type MessageDirection = "inbound" | "outbound";

/** Normalized inbound buyer message (no raw DOM HTML, no secrets). */
export interface NormalizedInboundMessage {
  platform: "pdd";
  shop_id: string;
  conversation_id: string;
  buyer_id?: string;
  buyer?: string;
  platform_message_id?: string;
  message_type: string;
  direction: MessageDirection;
  content: string;
  timestamp?: string;
  product_context?: Record<string, unknown>;
  order_context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/** Raw DOM scan result before normalization (minimal fields only). */
export interface RawDomMessage {
  unread: boolean;
  direction?: MessageDirection;
  buyer?: string;
  content: string;
  platform_message_id?: string;
  timestamp?: string;
  product_context?: Record<string, unknown>;
  order_context?: Record<string, unknown>;
}

export interface RawDomScan {
  conversation_id: string;
  buyer_id?: string;
  login_required: boolean;
  dom_supported: boolean;
  messages: RawDomMessage[];
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

export type PageEventType =
  | "page_ready"
  | "login_required"
  | "dom_unsupported"
  | "auth_reauth_required"
  | "conversation_changed"
  | "message_received"
  | "human_reply_detected"
  | "send_ack"
  | "transfer_ack";

export interface PddPageEvent {
  event: PageEventType;
  session_id: string;
  shop_id?: string;
  conversation_id?: string;
  buyer_id?: string;
  buyer?: string;
  platform_message_id?: string;
  message_type?: string;
  direction?: MessageDirection;
  content?: string;
  timestamp?: string;
  command_id?: string;
  ok?: boolean;
  reason?: string;
  status?: string;
  error?: string;
}

export type PddPageCommandType = "scan" | "send_text" | "send_image" | "transfer" | "focus_conversation" | "health";

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

export interface SendResult {
  ok: boolean;
  message_id?: string;
  uncertain?: boolean;
  error?: string;
}

export interface TransferExecutionResult {
  ok: boolean;
  executed: boolean;
  fallback_message?: string;
  error?: string;
}

/** Bounded recent automated-send acknowledgement (takeover misclassification guard). */
export interface AutomatedSendAck {
  message_id: string;
  at_ms: number;
}
