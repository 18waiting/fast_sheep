// M8 Qianniu transfer driver (clean-room). Executes explicit target only.
import { domExecuteTransfer, type TransferExecutionResult } from "@fastwork/platform-web-common";
import type { DomDocument } from "@fastwork/platform-web-common";
import { QIANNIU_SELECTOR_PROFILE } from "./selector-registry.js";

export function qianniuExecuteTransfer(doc: DomDocument, target: string): TransferExecutionResult {
  return domExecuteTransfer(doc, QIANNIU_SELECTOR_PROFILE, target);
}
