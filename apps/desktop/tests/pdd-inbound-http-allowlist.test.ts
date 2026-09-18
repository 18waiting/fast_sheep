import { test } from "node:test";
import assert from "node:assert/strict";
import { createPddInboundHttpAllowlist } from "../dist/main/platforms/pdd/pdd-inbound-transport.js";

const ORIGIN = "https://mms.pinduoduo.com";
const PATH = "/plateau/chat/latest_conversations";
const allow = createPddInboundHttpAllowlist(ORIGIN, PATH);

test("allowlist accepts exact origin+path with or without query string", () => {
  assert.equal(allow("POST", ORIGIN + PATH), true);
  assert.equal(allow("POST", ORIGIN + PATH + "?t=1&page=1"), true, "query string must not defeat the match");
});

test("allowlist rejects wrong method, origin, path and malformed urls", () => {
  assert.equal(allow("GET", ORIGIN + PATH), false);
  assert.equal(allow("POST", "https://evil.invalid" + PATH), false);
  assert.equal(allow("POST", "https://mms.pinduoduo.com.evil.invalid" + PATH), false);
  assert.equal(allow("POST", "https://sub.mms.pinduoduo.com" + PATH), false);
  assert.equal(allow("POST", ORIGIN + "/plateau/chat/other"), false);
  assert.equal(allow("POST", ORIGIN + PATH + "/extra"), false);
  assert.equal(allow("POST", ORIGIN + "/plateau/chat/latest_conversationsX"), false);
  assert.equal(allow("POST", "not a url"), false);
  assert.equal(allow("POST", ""), false);
});