// GENERATED TYPE MIRRORS — keep in sync with rebuild/packages/contracts/schemas/platform/*.schema.json (M8).
export interface M8PlatformCapabilities {
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
export interface M8PlatformSessionStatus {
  status: "STOPPED" | "CREATING" | "LOADING" | "LOGIN_REQUIRED" | "READY" | "DOM_UNSUPPORTED" | "ERROR" | "DISPOSED";
  session_id?: string;
  shop_id?: string;
  last_error?: string;
}
export interface M8PageEventBase {
  event: string;
  session_id: string;
  shop_id?: string;
  conversation_id?: string;
  direction?: "inbound" | "outbound";
  content?: string;
  command_id?: string;
  ok?: boolean;
  error?: string;
}
export interface M8PageCommandBase {
  type: string;
  command_id: string;
  session_id: string;
  shop_id?: string;
  conversation_id?: string;
  text?: string;
  asset_ref?: string;
  target?: string;
}
export interface M8PageCommandResultBase {
  command_id: string;
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string;
}
