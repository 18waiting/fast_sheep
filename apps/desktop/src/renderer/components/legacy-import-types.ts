// M11 legacy import renderer view-model + actions (clean-room).
// Projection/control only: the renderer never touches the filesystem, never
// sees plaintext secrets, and never calls raw IPC.
export interface LegacyImportPanelViewModel {
  selection_token: string | null;
  item_count: number;
  plan_sha256: string | null;
  session: { session_id: string; state: string; phases: string[]; error?: string | null } | null;
  plan?: { plan_sha256: string; items: Array<{ display_name: string; record_count: number; target_aggregate: string; warnings: Array<{ message: string }>; conflicts: Array<{ identity: string; reason: string; policy: string }> }>; secret_fields_detected: string[] } | null;
}

export interface LegacyImportActions {
  onSelect(): void;
  onScan(): void;
  onPlan(): void;
  onDryRun(): void;
  onApply(): void;
  onCancel(): void;
  onRefreshStatus(): void;
}

export const EMPTY_LEGACY_IMPORT_VIEW_MODEL: LegacyImportPanelViewModel = {
  selection_token: null,
  item_count: 0,
  plan_sha256: null,
  session: null,
  plan: null,
};
