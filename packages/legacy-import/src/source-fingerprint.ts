// M11 source fingerprint (clean-room). sha256 + size + mtime for change detection.
import { createHash } from "node:crypto";
import { createReadStream, statSync } from "node:fs";
import type { SourceFingerprint } from "./types.js";

export async function fingerprintFile(path: string): Promise<SourceFingerprint> {
  const st = statSync(path);
  const hash = createHash("sha256");
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk as Buffer));
    stream.on("end", () => resolvePromise());
    stream.on("error", rejectPromise);
  });
  return { sha256: hash.digest("hex"), size: st.size, mtime_ms: st.mtimeMs };
}

export function fingerprintString(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}
