// GENERATED TYPE MIRRORS — keep in sync with rebuild/packages/contracts/schemas/desktop/*platform*.schema.json.
// Clean-room implementation. JSON Schema (Draft 2020-12) is the single source of truth;
// these TS types mirror the M7 desktop platform IPC schemas for static typing only.
// Do not add business logic here.

export interface PlatformStatusView {
  shop_id: string;
  platform: string;
  session_status: string;
  view_visible: boolean;
  last_error?: string;
  capabilities?: Record<string, unknown>;
}

export interface PlatformActivateShopRequest {
  shop_id: string;
}

export interface PlatformSetViewBoundsRequest {
  shop_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

export interface PlatformReloadRequest {
  shop_id: string;
}

export interface PlatformStatusChangedEvent {
  shop_id: string;
  session_status: string;
  revision: number;
  last_error?: string;
}
