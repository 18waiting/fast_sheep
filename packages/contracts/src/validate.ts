// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv/dist/2020.js";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { SCHEMAS_ROOT } from "./registry.js";

export interface CompileReport {
  schemas: { id: string; path: string; ok: boolean; error?: string }[];
  duplicateIds: string[];
  unresolvedRefs: string[];
}

function walk(dir: string, out: string[]): void {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith(".schema.json")) out.push(p);
  }
}

function collectRefs(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const x of node) collectRefs(x, out);
  } else if (node !== null && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o.$ref === "string") out.push(o.$ref as string);
    for (const k of Object.keys(o)) collectRefs(o[k], out);
  }
  return out;
}

/** Load + compile every schema in SCHEMAS_ROOT (Draft 2020-12). */
export function compileAllSchemas(): { ajv: Ajv2020; report: CompileReport } {
  const ajv = new Ajv2020({ strict: false, allErrors: true, formats: { "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/ } });
  const files: string[] = [];
  walk(SCHEMAS_ROOT, files);
  const report: CompileReport = { schemas: [], duplicateIds: [], unresolvedRefs: [] };
  const seen = new Map<string, string>();
  for (const f of files) {
    const raw = JSON.parse(readFileSync(f, "utf-8")) as { $id?: string };
    const id = raw.$id ?? "?";
    const rel = relative(SCHEMAS_ROOT, f).replace(/\\/g, "/");
    if (seen.has(id)) report.duplicateIds.push(id);
    seen.set(id, f);
    try {
      ajv.addSchema(raw);
      report.schemas.push({ id, path: rel, ok: true });
    } catch (e) {
      report.schemas.push({ id, path: rel, ok: false, error: String(e) });
    }
  }
  const ids = new Set(report.schemas.map((s) => s.id));
  for (const s of report.schemas) {
    const raw = JSON.parse(readFileSync(join(SCHEMAS_ROOT, s.path), "utf-8")) as Record<string, unknown>;
    for (const ref of collectRefs(raw)) {
      if (ref.startsWith("fastwork:") && !ids.has(ref)) report.unresolvedRefs.push(`${s.id} -> ${ref}`);
    }
    try {
      ajv.getSchema(s.id);
    } catch (e) {
      report.unresolvedRefs.push(`${s.id}: ${String(e)}`);
    }
  }
  return { ajv, report };
}

export function validatorFor(id: string): ValidateFunction {
  const { ajv } = compileAllSchemas();
  const v = ajv.getSchema(id);
  if (!v) throw new Error(`schema not compiled: ${id}`);
  return v;
}


