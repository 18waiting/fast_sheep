import { test } from "node:test";
import assert from "node:assert/strict";
import { PLATFORM_IDS, platformHostEntryFor, isPlatformId } from "../dist/main/platforms/platform-host-registry.js";

test("registry covers all six canonical platform ids", () => {
  assert.deepEqual([...PLATFORM_IDS], ["pdd", "doudian", "jd", "kuaishou", "qianniu", "xianyu"]);
  for (const id of PLATFORM_IDS) assert.equal(isPlatformId(id), true, id);
  assert.equal(isPlatformId("bogus"), false);
});

test("host entry kind is pdd for pdd and generic otherwise", () => {
  const e = platformHostEntryFor("pdd", () => null as never);
  assert.equal(e.kind, "pdd");
  assert.equal(platformHostEntryFor("jd", () => null as never).kind, "generic");
});
