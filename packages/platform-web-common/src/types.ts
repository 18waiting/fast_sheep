// M8 platform-web-common types (clean-room). Platform-neutral only.
export type PlatformSessionStatusValue =
  | "STOPPED"
  | "CREATING"
  | "LOADING"
  | "LOGIN_REQUIRED"
  | "READY"
  | "DOM_UNSUPPORTED"
  | "ERROR"
  | "DISPOSED";

export type MessageDirection = "inbound" | "outbound";

/** Canonical normalized inbound message (no raw DOM HTML, no secrets). */
export interface NormalizedInboundMessage {
  platform: string;
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

/** Generic capability matrix; each platform supplies concrete values. */
export interface PlatformCapabilities {
  receive_text: boolean;
  send_text: boolean;
  send_image: boolean;
  manual_takeover_detection: boolean;
  conversation_selection: boolean;
  transfer: boolean;
  product_context?: boolean;
  order_context?: boolean;
  desktop_helper?: boolean;
  [key: string]: boolean | undefined;
}

export type PlatformPageEventType =
  | "page_ready"
  | "login_required"
  | "dom_unsupported"
  | "conversation_changed"
  | "message_received"
  | "human_reply_detected"
  | "send_ack"
  | "transfer_ack";

export interface PlatformPageEvent {
  event: PlatformPageEventType;
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

export interface PlatformPageCommand {
  type: string;
  command_id: string;
  session_id: string;
  shop_id?: string;
  conversation_id?: string;
  text?: string;
  asset_ref?: string;
  target?: string;
}

export interface PlatformPageCommandResult {
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

export interface AutomatedSendAck {
  message_id: string;
  at_ms: number;
}

/** Minimal DOM surface (structurally satisfied by jsdom and the real browser). */
export interface DomElement {
  querySelector(sel: string): DomElement | null;
  querySelectorAll(sel: string): DomElement[];
  textContent: string | null;
  getAttribute(name: string): string | null;
  setAttribute?(name: string, value: string): void;
  click?(): void;
  dispatchEvent?(event: unknown): boolean;
}

export interface DomDocument {
  querySelector(sel: string): DomElement | null;
  querySelectorAll(sel: string): DomElement[];
  body: DomElement;
}

export interface ConversationRead {
  conversation_id: string | null;
  buyer_id?: string;
  buyer?: string;
}

export interface ComposerState {
  found: boolean;
  disabled: boolean;
}
