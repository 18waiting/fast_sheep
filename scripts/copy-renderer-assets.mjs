// Clean-room helper (M6): copies static renderer assets next to compiled JS.
// tsc does not copy .html/.css; Electron loads dist/renderer/index.html.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "apps", "desktop", "src", "renderer");
const DIST = join(HERE, "..", "apps", "desktop", "dist", "renderer");

mkdirSync(DIST, { recursive: true });
for (const name of ["index.html", "styles.css"]) {
  copyFileSync(join(SRC, name), join(DIST, name));
  console.log("copied " + name);
}
