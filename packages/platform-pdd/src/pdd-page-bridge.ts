// M7 PDD page bridge interface (clean-room). The desktop Electron host and the
// golden harness implement this boundary; the adapter only depends on the interface.
import type { PddPageCommandResult } from "./types.js";

export interface PddPageBridge {
  /** Run a finite-allowlist page command and return its result. */
  execute(command: { type: string; command_id: string; session_id: string; shop_id?: string; conversation_id?: string; text?: string; asset_ref?: string; target?: string }): Promise<PddPageCommandResult>;
}
