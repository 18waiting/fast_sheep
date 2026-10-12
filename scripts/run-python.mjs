// Portable Python launcher for repo commands.
//
// usage: node scripts/run-python.mjs <python args...>
//   e.g. node scripts/run-python.mjs -m unittest discover -s services/ai-worker/tests -p "test_*.py"
//
// Resolution order (first hit wins):
//   1. <repo>/.venv/bin/python        (macOS / Linux virtualenv)
//   2. <repo>/.venv/Scripts/python.exe (Windows virtualenv)
//   3. python3 / py -3.12 / python     (host interpreter)
//
// Exists so no repo command hardcodes a single host's launcher (`py -3.12` is
// Windows-only; `.venv/bin/python` is POSIX-only). Exits with the child's code.
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IS_WINDOWS = process.platform === "win32";

function resolvePython() {
  const venv = IS_WINDOWS
    ? join(ROOT, ".venv", "Scripts", "python.exe")
    : join(ROOT, ".venv", "bin", "python");
  if (existsSync(venv)) return { command: venv, prefixArgs: [] };
  for (const candidate of IS_WINDOWS ? [["py", ["-3.12"]], ["python", []]] : [["python3", []], ["python", []]]) {
    const probe = spawnSync(candidate[0], [...candidate[1], "--version"], { stdio: "ignore" });
    if (probe.status === 0) return { command: candidate[0], prefixArgs: candidate[1] };
  }
  return null;
}

const python = resolvePython();
if (!python) {
  console.error("run-python: no Python interpreter found (.venv, python3, py -3.12, python all missing)");
  process.exit(1);
}
const result = spawnSync(python.command, [...python.prefixArgs, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: ROOT,
});
if (result.error) {
  console.error("run-python: failed to start " + python.command + " - " + result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
