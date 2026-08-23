// M8 Qianniu DOM health (clean-room).
import { domHealth, type DomHealthResult } from "@fastwork/platform-web-common";
import type { DomDocument } from "@fastwork/platform-web-common";
import { QIANNIU_SELECTOR_PROFILE } from "./selector-registry.js";

export function qianniuDomHealth(doc: DomDocument): DomHealthResult {
  return domHealth(doc, QIANNIU_SELECTOR_PROFILE);
}
