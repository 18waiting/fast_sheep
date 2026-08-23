// M8 Xianyu transfer driver (clean-room). Xianyu has NO automatic transfer
// (Python excludes 闲鱼 from 转接判断). The driver exists but always reports
// capability.unsupported — no fake support.
import { PLATFORM_ERROR_CODES } from "@fastwork/platform-web-common";
import type { DomDocument, TransferExecutionResult } from "@fastwork/platform-web-common";

export function xianyuExecuteTransfer(_doc: DomDocument, _target: string): TransferExecutionResult {
  return { ok: false, executed: false, error: PLATFORM_ERROR_CODES.UNSUPPORTED_CAPABILITY };
}
