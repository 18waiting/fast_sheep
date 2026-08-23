// M8 Doudian DOM health (clean-room).
import { domHealth, type DomHealthResult } from "@fastwork/platform-web-common";
import type { DomDocument } from "@fastwork/platform-web-common";
import { DOUDIAN_SELECTOR_PROFILE } from "./selector-registry.js";

export function doudianDomHealth(doc: DomDocument): DomHealthResult {
  return domHealth(doc, DOUDIAN_SELECTOR_PROFILE);
}
