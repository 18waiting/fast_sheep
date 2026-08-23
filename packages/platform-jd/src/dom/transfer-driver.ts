// M8 JD transfer driver (clean-room). Executes explicit target only.
import { domExecuteTransfer, type TransferExecutionResult } from "@fastwork/platform-web-common";
import type { DomDocument } from "@fastwork/platform-web-common";
import { JD_SELECTOR_PROFILE } from "./selector-registry.js";

export function jdExecuteTransfer(doc: DomDocument, target: string): TransferExecutionResult {
  return domExecuteTransfer(doc, JD_SELECTOR_PROFILE, target);
}
