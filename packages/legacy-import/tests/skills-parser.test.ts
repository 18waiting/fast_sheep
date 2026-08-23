import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSkillMd } from "../dist/parsers/skills-parser.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

test("skills parser imports disabled + untrusted and never executes scripts", () => {
  const s = parseSkillMd({ item_id: "i", display_name: "SKILL.md", path: join(FIX, "skills-unsigned-query", "技能", "qskill", "SKILL.md"), source_type: "skills" });
  assert.equal(s.enabled, false);
  assert.equal(s.metadata.untrusted, true);
  assert.ok(s.metadata.script_files >= 1);
  assert.equal(s.metadata.provenance, "legacy_import");
});
