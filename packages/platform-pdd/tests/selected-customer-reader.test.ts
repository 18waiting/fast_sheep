import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readSelectedCustomer } from "../dist/dom/selected-customer-reader.js";
import { toDomDocument } from "../dist/dom/dom-types.js";

function observe(body: string) {
  const dom = new JSDOM(body);
  return readSelectedCustomer(toDomDocument(dom.window.document));
}

test("one active live row returns its customerUid only", () => {
  const result = observe('<div class="chat-item-box active" data-random="10101-0-all"></div>');
  assert.deepEqual(result, { status: "SELECTED", customerUid: "10101" });
  assert.deepEqual(Object.keys(result), ["status", "customerUid"]);
});

test("the active row can move from buyer A to B and back to A", () => {
  assert.deepEqual(
    observe('<div class="chat-item-box active" data-random="10101-0-all"></div><div class="chat-item-box" data-random="20202-1-all"></div>'),
    { status: "SELECTED", customerUid: "10101" },
  );
  assert.deepEqual(
    observe('<div class="chat-item-box" data-random="10101-0-all"></div><div class="chat-item-box active" data-random="20202-1-all"></div>'),
    { status: "SELECTED", customerUid: "20202" },
  );
  assert.deepEqual(
    observe('<div class="chat-item-box active" data-random="10101-0-all"></div><div class="chat-item-box" data-random="20202-1-all"></div>'),
    { status: "SELECTED", customerUid: "10101" },
  );
});

test("class token order and unrelated classes do not affect selection", () => {
  const result = observe('<div class="extra active chat-item-box transition" data-random="10101-0-all"></div>');
  assert.deepEqual(result, { status: "SELECTED", customerUid: "10101" });
});

test("an active unrelated element is ignored", () => {
  assert.deepEqual(
    observe('<div class="active"></div><div class="chat-item-box" data-random="10101-0-all"></div>'),
    { status: "NONE" },
  );
});

test("zero active live rows returns NONE", () => {
  assert.deepEqual(
    observe('<div class="chat-item-box" data-random="10101-0-all"></div><div class="chat-item-box" data-random="20202-1-all"></div>'),
    { status: "NONE" },
  );
});

test("multiple active live rows return UNKNOWN instead of choosing one", () => {
  assert.deepEqual(
    observe('<div class="chat-item-box active" data-random="10101-0-all"></div><div class="chat-item-box active" data-random="20202-1-all"></div>'),
    { status: "UNKNOWN" },
  );
});

test("malformed or missing customerUid returns UNKNOWN", () => {
  assert.deepEqual(observe('<div class="chat-item-box active" data-random="buyer-0-all"></div>'), { status: "UNKNOWN" });
  assert.deepEqual(observe('<div class="chat-item-box active" data-random="-all"></div>'), { status: "UNKNOWN" });
});

test("rows without the live structure are not candidates", () => {
  assert.deepEqual(observe('<div class="active" data-random="10101-0-all"></div>'), { status: "NONE" });
  assert.deepEqual(observe('<div class="chat-item-box active" data-random="10101-0"></div>'), { status: "NONE" });
});

test("customerUid is not synthesized from a synthetic conversation id", () => {
  const result = observe('<div class="chat-item-box active" data-conversation-id="synthetic-conversation"></div>');
  assert.deepEqual(result, { status: "NONE" });
});
