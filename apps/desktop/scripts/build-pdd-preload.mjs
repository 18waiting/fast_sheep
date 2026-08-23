// M7/M8 platform preload bundler (clean-room). Bundles each sandboxed page
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

  // M8 platform preloads (dist/platform-preloads/<platform>.js).
  for (const platform of ["doudian", "jd", "kuaishou", "qianniu", "xianyu"]) {
    await build({
      entryPoints: [join(APP, "src", "platform-preloads", platform + ".ts")],
      outfile: join(APP, "dist", "platform-preloads", platform + ".js"),
      bundle: true,
      format: "cjs",
      platform: "node",
      target: "node20",
      external: ["electron"],
      sourcemap: false,
      logLevel: "silent",
    });
    console.log(platform + " preload bundled");
  }
}

await main();
