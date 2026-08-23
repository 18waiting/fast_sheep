import { test } from "node:test";
import assert from "node:assert/strict";
import { qianniuDomHealth } from "../dist/index.js";
import { loadFixture } from "./helpers.ts";

test("ready fixture passes DOM health; unsupported fixture fails safe", () => {
  assert.equal(qianniuDomHealth(loadFixture("chat-basic.html")).ready, true);
  const h = qianniuDomHealth(loadFixture("dom-unsupported.html"));
  assert.equal(h.ready, false);
  assert.equal(h.reason, "DOM_UNSUPPORTED");
});
