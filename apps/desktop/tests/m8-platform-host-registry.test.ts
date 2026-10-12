import { test } from "node:test";
import assert from "node:assert/strict";
import { PLATFORM_IDS, platformHostEntryFor, isPlatformId } from "../dist/main/platforms/platform-host-registry.js";

// FastWork realignment B3: the MVP is PDD-only, so the canonical platform set has
// exactly one member and the removed platforms must fail closed.
test("registry declares the single canonical platform id", () => {
  assert.deepEqual([...PLATFORM_IDS], ["pdd"]);
  for (const id of PLATFORM_IDS) assert.equal(isPlatformId(id), true, id);
  assert.equal(isPlatformId("bogus"), false);
});

test("platforms removed by the realignment are not canonical ids", () => {
  for (const removed of ["doudian", "jd", "kuaishou", "qianniu", "xianyu"]) {
    assert.equal(isPlatformId(removed), false, removed + " must not be canonical");
  }
});

test("host entry kind is always pdd", () => {
  const e = platformHostEntryFor("pdd", () => null as never);
  assert.equal(e.kind, "pdd");
  assert.equal(e.platform, "pdd");
});
