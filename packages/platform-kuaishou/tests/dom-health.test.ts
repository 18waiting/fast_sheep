import { test } from "node:test";
import assert from "node:assert/strict";
import { kuaishouDomHealth } from "../dist/index.js";
import { loadFixture } from "./helpers.ts";

test("ready fixture passes DOM health; unsupported fixture fails safe", () => {
  assert.equal(kuaishouDomHealth(loadFixture("chat-basic.html")).ready, true);
  const h = kuaishouDomHealth(loadFixture("dom-unsupported.html"));
  assert.equal(h.ready, false);
  assert.equal(h.reason, "DOM_UNSUPPORTED");
});
