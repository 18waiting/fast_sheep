// Shared test helper: load synthetic DOM fixtures via jsdom (offline, no resources).
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { DomDocument } from "../dist/dom/dom-types.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

export function loadFixture(name: string): DomDocument {
  const html = readFileSync(join(FIXTURES, name), "utf-8");
  const dom = new JSDOM(html);
  return dom.window.document as unknown as DomDocument;
}

export function fixturePath(name: string): string {
  return join(FIXTURES, name);
}
