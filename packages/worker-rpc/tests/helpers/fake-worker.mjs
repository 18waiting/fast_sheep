// Fake stdio JSONL worker for @fastwork/worker-rpc tests (TASK-017 M2).
// Mimics the Python worker transport behaviors deterministically; controlled by FAKE_WORKER_MODE.
const mode = process.env.FAKE_WORKER_MODE ?? "normal";
const readyVersion = mode === "bad-version" ? [2] : [1];
const maxFrame = Number(process.env.FAKE_WORKER_MAX_FRAME ?? 1024 * 1024);

function write(obj) {
  const line = JSON.stringify(obj);
  process.stdout.write(line + "\n");
}
function log(msg) { process.stderr.write(msg + "\n"); }

function respond(requestId, ok, result, error) {
  write({ request_id: requestId, ok, result, error, metadata: {} });
}
function okRes(requestId, result) { respond(requestId, true, result, null); }
function errRes(requestId, code, message) { respond(requestId, false, null, { code, category: "internal", message, retryable: false }); }

const hanging = new Map(); // request_id -> true
const delayTarget = mode === "out-of-order" ? "r1" : null;

function handle(req) {
  const { request_id: rid, method, payload = {}, context = {} } = req;
  const delay = (ms, fn) => setTimeout(fn, ms);
  const delayed = (ms, fn) => (rid === delayTarget ? delay(ms, fn) : fn());
  switch (method) {
    case "system.shutdown":
      okRes(rid, { ok: true, exit_code: 0 });
      if (mode !== "ignore-shutdown") setTimeout(() => process.exit(0), 10);
      return;
    case "system.cancel":
      if (hanging.has(payload.target_request_id)) {
        hanging.delete(payload.target_request_id);
        errRes(payload.target_request_id, "cancelled", "request cancelled");
        okRes(rid, { request_id: payload.target_request_id, cancelled: true });
      } else {
        okRes(rid, { request_id: payload.target_request_id, cancelled: false, already_completed: true });
      }
      return;
    case "system.health":
      delayed(5, () => okRes(rid, { status: "ok", worker_version: "0.0.0", protocol_version: 1, pid: process.pid, uptime_ms: 10 }));
      return;
    case "ping":
      delayed(5, () => okRes(rid, { request_id: rid, ok: true }));
      return;
    case "test.echo":
      delayed(5, () => okRes(rid, payload));
      return;
    case "test.delay_echo":
      delay(Number(payload.delay_ms ?? 0), () => okRes(rid, payload));
      return;
    case "test.hang":
      hanging.set(rid, true);
      return;
    case "test.crash":
      process.exit(1);
      return;
    case "test.emit_event":
      write({ event: "test.event", payload: { echo: payload }, correlation_id: context.correlation_id });
      delayed(5, () => okRes(rid, { emitted: true }));
      return;
    case "test.large_response":
      delayed(5, () => okRes(rid, { data: "x".repeat(Number(payload.size ?? 256 * 1024)) }));
      return;
    default:
      errRes(rid, "method.unknown", "unknown method: " + method);
  }
}

if (mode !== "never-ready") {
  write({ event: "worker.ready", payload: { version: 1, worker_version: "0.0.0", protocol_versions: readyVersion, pid: process.pid, python_version: "fake", capabilities: [] } });
}
if (mode === "malformed-first") {
  log("malformed line follows");
  process.stdout.write("{bad json\n");
}
if (mode === "oversize-first") {
  process.stdout.write("x".repeat(maxFrame + 2) + "\n");
}
if (mode === "stderr-noise") {
  log("worker started (diagnostic)");
  log("another diagnostic");
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, idx);
    buf = buf.slice(idx + 1);
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj === "object" && obj.request_id && obj.method) handle(obj);
      else log("non-request frame skipped");
    } catch {
      log("malformed JSON line skipped");
    }
  }
});
process.stdin.resume();
