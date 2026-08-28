// M6 renderer action surface (clean-room).
// UI events map ONLY to typed IPC commands via the store; the renderer never
// calls PlatformAdapter or decides business outcomes.
export interface WorkbenchActions {
  onSelectShop(shopId: string): void;
  onSetMode(mode: "human_review" | "full_auto"): void;
  onManualSend(): void;
  onNoSaveSend(): void;
  onCancel(): void;
  onPlatformBoundsChange(bounds: { x: number; y: number; width: number; height: number; visible: boolean }): void;
  onReloadPlatform(): void;
  /** SHEEP-064 Composer: manual draft input, explicit submit intent, explicit AI-suggestion apply. */
  onComposerDraftChange(text: string): void;
  onComposerSubmit(): void;
  onApplySuggestion(): void;
}

