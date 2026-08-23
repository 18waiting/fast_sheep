// Shared test helper for platform packages.
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { DomDocument } from "@fastwork/platform-web-common";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

export function loadFixture(name: string): DomDocument {
  const html = readFileSync(join(FIXTURES, name), "utf-8");
  return new JSDOM(html).window.document as unknown as DomDocument;
}
