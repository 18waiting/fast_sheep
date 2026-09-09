// Minimum PDD auth reauthentication detector. It consumes only approved,
// non-sensitive page semantics and never inspects browser auth material.
import type { DomDocument, DomElement } from "../dom/dom-types.js";

export const AUTH_REAUTH_TITLE = "登录过期";
export const AUTH_REAUTH_MESSAGE = "登录已过期，请重新登录";
export const AUTH_REAUTH_ORIGIN = "https://mms.pinduoduo.com";
export const AUTH_REAUTH_PATHNAME = "/login/";

const AUTH_DIALOG_SELECTORS = [
  "[data-fw-pdd-auth-reauth-dialog]",
  "[role=dialog]",
  ".el-message-box",
] as const;

const TITLE_SELECTORS = [
  "[data-fw-pdd-auth-title]",
  ".el-message-box__title",
] as const;

const MESSAGE_SELECTORS = [
  "[data-fw-pdd-auth-message]",
  ".el-message-box__message",
] as const;

function exactText(element: DomElement | null, expected: string): boolean {
  return element?.textContent === expected;
}

function firstMatching(root: DomElement, selectors: readonly string[]): DomElement | null {
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    if (element) return element;
  }
  return null;
}

/** Signal A: exact title and message within the same modal surface. */
export function hasAuthReauthModal(doc: DomDocument): boolean {
  for (const selector of AUTH_DIALOG_SELECTORS) {
    for (const dialog of doc.querySelectorAll(selector)) {
      const title = firstMatching(dialog, TITLE_SELECTORS);
      const message = firstMatching(dialog, MESSAGE_SELECTORS);
      if (exactText(title, AUTH_REAUTH_TITLE) && exactText(message, AUTH_REAUTH_MESSAGE)) return true;
    }
  }
  return false;
}

/** Signal B: exact approved location projection only. */
export function hasAuthReauthLocation(doc: DomDocument): boolean {
  return doc.location?.origin === AUTH_REAUTH_ORIGIN && doc.location.pathname === AUTH_REAUTH_PATHNAME;
}

export function hasAuthReauthEvidence(doc: DomDocument): boolean {
  return hasAuthReauthModal(doc) || hasAuthReauthLocation(doc);
}
