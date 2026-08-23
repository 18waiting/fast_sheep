// M8 Kuaishou DOM health (clean-room).
import { domHealth, type DomHealthResult } from "@fastwork/platform-web-common";
import type { DomDocument } from "@fastwork/platform-web-common";
import { KUAISHOU_SELECTOR_PROFILE } from "./selector-registry.js";

export function kuaishouDomHealth(doc: DomDocument): DomHealthResult {
  return domHealth(doc, KUAISHOU_SELECTOR_PROFILE);
}
