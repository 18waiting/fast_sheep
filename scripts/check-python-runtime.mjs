// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// M1 (TASK-016): report the Python interpreter used by rebuild CI (must be >=3.11).
// Resolution order: FASTWORK_PYTHON env > `py -3.12` > `python`. Exits 1 if <3.11.
import { execFileSync } from "node:child_process";

const MIN = [3, 11];

function candidates() {
  if (process.env.FASTWORK_PYTHON) return [[process.env.FASTWORK_PYTHON]];
  return [["py", "-3.12"], ["python"]];
}

let result = { executable: null, version: null, meets_requirement: false, used_for: ["worker tests", "cross-language validation", "cross-process sqlite", "CI"] };
for (const cmd of candidates()) {
  try {
    const out = execFileSync(cmd[0], [...cmd.slice(1), "--version"], { encoding: "utf-8" }).trim();
    const m = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(out);
    if (m) {
      result.executable = (cmd.join(" ") + " -> " + out).trim();
      result.version = out;
      const [ma, mi] = [parseInt(m[1], 10), parseInt(m[2], 10)];
      result.meets_requirement = ma > MIN[0] || (ma === MIN[0] && mi >= MIN[1]);
      break;
    }
  } catch { /* try next */ }
}
console.log(JSON.stringify(result, null, 2));
if (!result.meets_requirement) { console.error("FAIL: Python >=3.11 required for M1"); process.exit(1); }
