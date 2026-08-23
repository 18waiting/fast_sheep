// M11 main-import-writer port (clean-room). Writes ONLY Main-owned aggregates.
import type {
  TargetAggregate, LegacyImportOptions, ImportItemManifest, SourceItemRef,
} from "../types.js";

export interface MainWriteResult { aggregate: TargetAggregate; inserted: number; skipped: number; replaced: number; }

export interface MainImportWriterPort {
  write(item: SourceItemRef, parsed: unknown, manifest: ImportItemManifest, options: LegacyImportOptions): Promise<MainWriteResult>;
  hasIdentity(aggregate: TargetAggregate, identity: string): boolean;
  foreignRefsValid(aggregate: TargetAggregate, refs: string[]): boolean;
}
