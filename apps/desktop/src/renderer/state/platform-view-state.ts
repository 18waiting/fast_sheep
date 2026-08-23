// M7 renderer platform view state (clean-room). Presentation-only projection.
// Never holds cookies/URLs/secrets; never accesses PDD DOM.
export interface PlatformViewState {
  activeShopId: string | null;
  platformType: string | null;
  sessionStatus: string | null;
  viewVisible: boolean;
  lastSafeError: string | null;
  /** Package-declared capabilities (presentation only; unsupported controls disabled). */
  capabilities: Record<string, boolean>;
}

export const EMPTY_PLATFORM_VIEW_STATE: PlatformViewState = {
  activeShopId: null,
  platformType: null,
  sessionStatus: null,
  viewVisible: false,
  lastSafeError: null,
  capabilities: {},
};

export function platformIsReady(state: PlatformViewState): boolean {
  return state.sessionStatus === "READY";
}
