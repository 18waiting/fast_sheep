// M11 legacy import selection service (clean-room). The Electron Main dialog is
// the ONLY filesystem authority; the renderer gets an opaque selection_token.
import { randomUUID } from "node:crypto";
import { createSelection, type LegacySourceSelection } from "@fastwork/legacy-import";
import type { ImportDialogPort } from "../import/legacy-import-dialog.js";

export class LegacyImportSelectionService {
  private readonly selections = new Map<string, LegacySourceSelection>();

  constructor(private readonly dialog: ImportDialogPort) {}

  /** Open the dialog and store the explicit selection under a fresh token. */
  async select(): Promise<{ selection_token: string; item_count: number }> {
    const result = await this.dialog.showOpenDialog({});
    if (result.canceled || result.filePaths.length === 0) {
      return { selection_token: "", item_count: 0 };
    }
    // The dialog returns absolute paths from an explicit user action; no auto
    // discovery of legacy installation directories ever happens here.
    const root = rootOf(result.filePaths[0]);
    const selection = createSelection(root, result.filePaths);
    const token = "seltok-" + randomUUID().slice(0, 12);
    this.selections.set(token, selection);
    return { selection_token: token, item_count: selection.items.length };
  }

  /** Resolve a token to its selection; the token is consumed on use. */
  take(token: string): LegacySourceSelection {
    const selection = this.selections.get(token);
    if (!selection) throw new Error("unknown or expired selection token");
    this.selections.delete(token);
    return selection;
  }

  peek(token: string): LegacySourceSelection | null {
    return this.selections.get(token) ?? null;
  }

  clear(token: string): void { this.selections.delete(token); }
}

function rootOf(file: string): string {
  const idx = file.replace(/\\/g, "/").lastIndexOf("/");
  return idx > 0 ? file.slice(0, idx) : file;
}
