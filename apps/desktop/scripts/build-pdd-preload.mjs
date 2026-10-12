// M7 platform preload bundler (clean-room). Bundles the sandboxed PDD page
// preload into a single self-contained CJS file (sandboxed preloads cannot use
// ESM imports).
import { build } from "esbuild";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");

async function main() {
  // PDD keeps its M7 output location (dist/platforms/pdd/preload.js).
  await build({
    entryPoints: [join(APP, "src", "platforms", "pdd", "preload.ts")],
    outfile: join(APP, "dist", "platforms", "pdd", "preload.js"),
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node20",
    external: ["electron"],
    sourcemap: false,
    logLevel: "silent",
  });
  console.log("PDD preload bundled");
}

await main();
