// M8 Kuaishou transfer driver (clean-room). Executes explicit target only.
import { domExecuteTransfer, type TransferExecutionResult } from "@fastwork/platform-web-common";
import type { DomDocument } from "@fastwork/platform-web-common";
import { KUAISHOU_SELECTOR_PROFILE } from "./selector-registry.js";

export function kuaishouExecuteTransfer(doc: DomDocument, target: string): TransferExecutionResult {
  return domExecuteTransfer(doc, KUAISHOU_SELECTOR_PROFILE, target);
}
