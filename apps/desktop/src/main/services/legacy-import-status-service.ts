// M11 legacy import status service (clean-room). Projects opaque session status
// to the renderer: no filesystem paths, no plaintext secrets.
import type { ImportSession } from "@fastwork/legacy-import";
import type { LegacyImportStatusView } from "@fastwork/desktop-ipc";

export class LegacyImportStatusService {
  project(session: ImportSession | null): LegacyImportStatusView | null {
    if (!session) return null;
    return {
      session_id: session.session_id,
      state: session.state,
      phases: session.phases,
      backup_id: session.backup_id ?? null,
      error: session.error ? session.error.slice(0, 200) : null,
    };
  }
}
