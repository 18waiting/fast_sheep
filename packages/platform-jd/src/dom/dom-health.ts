// M8 JD DOM health (clean-room).
import { domHealth, type DomHealthResult } from "@fastwork/platform-web-common";
import type { DomDocument } from "@fastwork/platform-web-common";
import { JD_SELECTOR_PROFILE } from "./selector-registry.js";

export function jdDomHealth(doc: DomDocument): DomHealthResult {
  return domHealth(doc, JD_SELECTOR_PROFILE);
}
