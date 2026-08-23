// M8 Xianyu DOM health (clean-room).
import { domHealth, type DomHealthResult } from "@fastwork/platform-web-common";
import type { DomDocument } from "@fastwork/platform-web-common";
import { XIANYU_SELECTOR_PROFILE } from "./selector-registry.js";

export function xianyuDomHealth(doc: DomDocument): DomHealthResult {
  return domHealth(doc, XIANYU_SELECTOR_PROFILE);
}
