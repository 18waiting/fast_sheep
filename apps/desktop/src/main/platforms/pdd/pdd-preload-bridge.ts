// M7 PDD preload bridge (clean-room). Implements PddPageBridge for a real
// WebContentsView: sends finite-allowlist commands to the page preload and
// correlates results by command_id. No business decisions.
import type { PddPageBridge, PddPageCommand, PddPageCommandResult } from "@fastwork/platform-pdd";
import type { PddViewHost } from "./pdd-view-host.js";
import { PDD_PAGE_COMMAND_CHANNEL } from "./pdd-page-ipc.js";

export interface PendingCommand {
  resolve(result: PddPageCommandResult): void;
  timer: ReturnType<typeof setTimeout>;
}

export class PddPreloadBridge implements PddPageBridge {
  private readonly pending = new Map<string, PendingCommand>();

  constructor(
    private readonly view: PddViewHost,
    private readonly timeoutMs = 8000,
  ) {}

  execute(command: PddPageCommand): Promise<PddPageCommandResult> {
    return new Promise<PddPageCommandResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(command.command_id);
        resolve({ command_id: command.command_id, ok: false, error: "platform.command_timeout" });
      }, this.timeoutMs);
      this.pending.set(command.command_id, { resolve, timer });
      if (this.view.webContents.isDestroyed()) {
        clearTimeout(timer);
        this.pending.delete(command.command_id);
        resolve({ command_id: command.command_id, ok: false, error: "platform.session_error" });
        return;
      }
      this.view.webContents.send(PDD_PAGE_COMMAND_CHANNEL, command);
    });
  }

  resolveResult(result: PddPageCommandResult): void {
    const pending = this.pending.get(result.command_id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(result.command_id);
    pending.resolve(result);
  }

  pendingCount(): number {
    return this.pending.size;
  }
}
