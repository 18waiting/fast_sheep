import { createHash, randomUUID } from "node:crypto";
import type { WebContents } from "electron";
import type { PddInboundDocumentBinding } from "./pdd-session-host.js";

export type PddCanonicalIngressMode = "DISABLED" | "CANONICAL_CONTROLLED" | "LEGACY";

export interface PddConnectionEvidence {
  readonly webContents: WebContents;
  readonly observerId: string;
  readonly observerLifecycleId: number;
  readonly sessionId: string;
  readonly shopId: string;
  readonly documentGeneration: number;
  readonly cdpSessionId: string;
  readonly requestId: string;
  readonly url: string;
}

export interface PddMainAdmissionRequest {
  readonly webContents: WebContents;
  readonly connection: PddConnectionEvidence;
  readonly binding: PddInboundDocumentBinding;
}

export type PddMainAdmissionDecision =
  | { readonly granted: true; readonly admissionId: string }
  | { readonly granted: false; readonly reason: string };

export interface PddMainAdmissionProvider {
  evaluate(request: PddMainAdmissionRequest): PddMainAdmissionDecision;
}

export const DENY_ALL_MAIN_ADMISSION_PROVIDER: PddMainAdmissionProvider = Object.freeze({
  evaluate(): PddMainAdmissionDecision {
    return Object.freeze({ granted: false, reason: "MAIN_ADMISSION_DENIED_DEFAULT" });
  },
});

export function connectionEvidenceHash(connection: PddConnectionEvidence): string {
  return createHash("sha256").update([
    connection.observerId,
    String(connection.observerLifecycleId),
    connection.sessionId,
    connection.shopId,
    String(connection.documentGeneration),
    connection.cdpSessionId,
    connection.requestId,
    connection.url,
  ].join("|"), "utf8").digest("hex");
}

function sameBinding(left: PddInboundDocumentBinding, right: PddInboundDocumentBinding): boolean {
  return left.sessionId === right.sessionId
    && left.shopId === right.shopId
    && left.documentGeneration === right.documentGeneration;
}

function sameConnection(left: PddConnectionEvidence, right: PddConnectionEvidence): boolean {
  return left.webContents === right.webContents
    && left.observerId === right.observerId
    && left.observerLifecycleId === right.observerLifecycleId
    && left.sessionId === right.sessionId
    && left.shopId === right.shopId
    && left.documentGeneration === right.documentGeneration
    && left.cdpSessionId === right.cdpSessionId
    && left.requestId === right.requestId
    && left.url === right.url;
}

interface AdmissionRecord {
  readonly request: PddMainAdmissionRequest;
  revoked: boolean;
}

export class PddMainAdmissionRegistry {
  private readonly records = new Map<string, AdmissionRecord>();

  constructor(private readonly provider: PddMainAdmissionProvider = DENY_ALL_MAIN_ADMISSION_PROVIDER) {}

  evaluate(request: PddMainAdmissionRequest): PddMainAdmissionDecision {
    let decision: PddMainAdmissionDecision;
    try {
      decision = this.provider.evaluate(request);
    } catch {
      return Object.freeze({ granted: false, reason: "MAIN_ADMISSION_PROVIDER_THREW" });
    }
    if (!decision.granted) return Object.freeze({ granted: false, reason: decision.reason });
    const admissionId = randomUUID();
    this.records.set(admissionId, { request, revoked: false });
    return Object.freeze({ granted: true, admissionId });
  }

  validate(admissionId: string, request: PddMainAdmissionRequest): boolean {
    const record = this.records.get(admissionId);
    if (!record || record.revoked) return false;
    return record.request.webContents === request.webContents
      && sameConnection(record.request.connection, request.connection)
      && sameBinding(record.request.binding, request.binding);
  }

  revoke(admissionId: string): void {
    const record = this.records.get(admissionId);
    if (record) record.revoked = true;
  }

  revokeForWebContents(webContents: object): void {
    for (const record of this.records.values()) {
      if (record.request.webContents === webContents) record.revoked = true;
    }
  }

  clear(): void {
    for (const record of this.records.values()) record.revoked = true;
    this.records.clear();
  }
}
