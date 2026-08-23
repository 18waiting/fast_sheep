import { test } from "node:test";
import assert from "node:assert/strict";

import { ALL_CHANNELS } from "../dist/index.js";

test("no generic invoke/send/on channel exists", () => {
  for (const c of ALL_CHANNELS) {
    assert.ok(!c.includes("invoke"), c);
    assert.ok(!c.includes("generic"), c);
    assert.ok(!c.includes("raw"), c);
    assert.ok(c.split(".").length === 2, "channel should be namespace.name: " + c);
  }
});
