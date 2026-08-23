// M11 skills parser (clean-room). Scans SKILL.md metadata only; NEVER executes
// query.py/shell/batch/exe/dll. Imported skills are disabled + untrusted.
import { readFileSync, readdirSync } from "node:fs";
import { dirname } from "node:path";
import type { SourceItemRef } from "../types.js";
import { rejectTraversal } from "../path-safety.js";

export interface SkillImportRow {
  skill_id: string;
  name: string;
  enabled: boolean;
  asset_path: string;
  signature: string | null;
  metadata: Record<string, unknown>;
}

export function parseSkillMd(item: SourceItemRef): SkillImportRow {
  const content = readFileSync(item.path, "utf-8");
  const name = extractFrontmatter(content, "name") || dirname(item.path).split(/[\\/]/).pop() || "imported-skill";
  const metadata: Record<string, unknown> = {
    provenance: "legacy_import",
    untrusted: true,
    description: extractFrontmatter(content, "description") ?? "",
    disabled_reason: "imported query/executable skill disabled by default",
  };
  // Scripts are scanned (counted) but never executed; flagged in metadata.
  const scriptFiles = listScripts(dirname(item.path));
  metadata.script_files = scriptFiles.length;
  return {
    skill_id: "sk-" + sanitize(name),
    name,
    enabled: false,
    asset_path: dirname(item.path),
    signature: null,
    metadata,
  };
}

function listScripts(dir: string): string[] {
  const out: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const lower = entry.toLowerCase();
      if (/(\.py|\.sh|\.bat|\.cmd|\.ps1|\.exe|\.dll)$/.test(lower)) {
        rejectTraversal(entry);
        out.push(entry);
      }
    }
  } catch {
    /* dir may be missing */
  }
  return out;
}

function extractFrontmatter(content: string, key: string): string | null {
  const m = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!m) return null;
  const line = m[1].split(/\r?\n/).find((l) => l.startsWith(key + ":"));
  if (!line) return null;
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
}

function sanitize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "skill";
}
