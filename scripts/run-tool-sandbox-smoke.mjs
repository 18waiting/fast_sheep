// M4 tool sandbox smoke (TASK-019): run a synthetic harmless tool script through the
// sandbox; assert structured args in, structured result out, timeout enforcement,
// network-denied path, no secret env inherited, subprocess exit captured.
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const REBUILD = join(HERE, "..");
const WORKER_SRC = join(REBUILD, "services", "ai-worker", "src");

const workdir = mkdtempSync(join(tmpdir(), "fw-m4-sandbox-"));
let failed = 0;
const check = (name, cond) => { console.log((cond ? "PASS " : "FAIL ") + name); if (!cond) failed += 1; };

try {
  const script = "import json, sys, os\nargs = json.loads(sys.argv[1])\nprint(json.dumps({'echo': args, 'secret_in_env': os.environ.get('FASTWORK_SECRET_TEST', '')}, ensure_ascii=False))\n";
  const scriptPath = join(workdir, "tool.py");
  writeFileSync(scriptPath, script, "utf-8");

  const code = [
    "import sys, json, os, tempfile",
    "sys.path.insert(0, " + JSON.stringify(WORKER_SRC) + ")",
    "from fastwork_ai_worker.tools.sandbox.environment import build_whitelist_env",
    "from fastwork_ai_worker.tools.sandbox.process_runner import run_process",
    "from fastwork_ai_worker.tools.sandbox.policy import SandboxPolicy",
    "workdir = " + JSON.stringify(workdir) + "",
    "script = os.path.join(workdir, 'tool.py')",
    "args = json.dumps({'region': '上海'})",
    "env = build_whitelist_env(base=dict(os.environ), allowed_keys=('PATH','SYSTEMROOT'))",
    "r = run_process([sys.executable, script, args], timeout_ms=5000, env_whitelist=env, workdir=workdir)",
    "print(json.dumps({'ok': r.ok, 'returncode': r.returncode, 'stdout': r.stdout[:200], 'stderr': r.stderr[:200], 'timed_out': r.timed_out, 'killed': r.killed, 'secret_in_env': 'FASTWORK_SECRET_TEST' in str(env)}, ensure_ascii=False))",
    "policy = SandboxPolicy(network=False, data_read_only=True)",
    "print(json.dumps({'network': policy.check_network(), 'write': policy.check_data_write('data/data.csv')}))",
    "# timeout enforcement",
    "rt = run_process([sys.executable, '-c', 'import time; time.sleep(30)'], timeout_ms=200, env_whitelist=env, workdir=workdir)",
    "print(json.dumps({'timeout_timed_out': rt.timed_out, 'timeout_killed': rt.killed}))",
  ].join("\n");

  const out = execFileSync("py", ["-3.12", "-c", code], { encoding: "utf-8", cwd: REBUILD, env: { ...process.env, PYTHONPATH: WORKER_SRC, FASTWORK_SECRET_TEST: "fake-super-secret-value", PYTHONIOENCODING: "utf-8" } });
  const lines = out.trim().split(/\r?\n/);
  const r1 = JSON.parse(lines[lines.length - 3]);
  const r2 = JSON.parse(lines[lines.length - 2]);
  const r3 = JSON.parse(lines[lines.length - 1]);
  check("structured args in + result out", r1.ok === true && r1.returncode === 0 && r1.stdout.includes("上海"));
  check("no secret env inherited", r1.secret_in_env === false);
  check("network denied by policy", r2.network.blocked === true && r2.network.reason === "network_disabled");
  check("data write denied read-only", r2.write.blocked === true && r2.write.reason === "read_only");
  check("timeout enforced (killed)", r3.timeout_timed_out === true && r3.timeout_killed === true);
} finally {
  rmSync(workdir, { recursive: true, force: true });
}
if (failed > 0) { console.error("TOOL SANDBOX SMOKE FAILED"); process.exit(1); }
console.log("TOOL SANDBOX SMOKE PASS");
