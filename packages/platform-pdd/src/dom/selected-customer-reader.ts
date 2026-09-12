import type { DomDocument, DomElement } from "./dom-types.js";

const LIVE_CHAT_ROW_SELECTOR = 'div.chat-item-box[data-random$="-all"]';
const CUSTOMER_UID_PATTERN = /^(\d+)-\d+-all$/;

export type SelectedCustomerObservationStatus = "SELECTED" | "NONE" | "UNKNOWN";

export type SelectedCustomerObservation =
  | { status: "SELECTED"; customerUid: string }
  | { status: "NONE" }
  | { status: "UNKNOWN" };

function hasClassToken(element: DomElement, token: string): boolean {
  return (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).includes(token);
}

function resolveCustomerUid(dataRandom: string | null): string | null {
  if (!dataRandom) return null;
  return CUSTOMER_UID_PATTERN.exec(dataRandom)?.[1] ?? null;
}

/** Observe the unique selected live PDD buyer row without exposing row identity. */
export function readSelectedCustomer(doc: DomDocument): SelectedCustomerObservation {
  const activeRows = Array.from(doc.querySelectorAll(LIVE_CHAT_ROW_SELECTOR))
    .filter((row) => hasClassToken(row, "active"));

  if (activeRows.length === 0) return { status: "NONE" };
  if (activeRows.length > 1) return { status: "UNKNOWN" };

  const customerUid = resolveCustomerUid(activeRows[0].getAttribute("data-random"));
  return customerUid ? { status: "SELECTED", customerUid } : { status: "UNKNOWN" };
}
