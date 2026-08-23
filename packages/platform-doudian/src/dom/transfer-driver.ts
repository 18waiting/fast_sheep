// M8 Doudian transfer driver (clean-room). Executes explicit target only.
import { domExecuteTransfer, type TransferExecutionResult } from "@fastwork/platform-web-common";
import type { DomDocument } from "@fastwork/platform-web-common";
import { DOUDIAN_SELECTOR_PROFILE } from "./selector-registry.js";

export function doudianExecuteTransfer(doc: DomDocument, target: string): TransferExecutionResult {
  return domExecuteTransfer(doc, DOUDIAN_SELECTOR_PROFILE, target);
}
