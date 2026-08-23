import { test } from "node:test";
import assert from "node:assert/strict";
import { PersistenceFeedbackRepository } from "../dist/index.js";

test("persistence repository adapter delegates effect status updates", () => {
  let updated = null;
  const repo = new PersistenceFeedbackRepository({
    add: () => {},
    list: () => [],
    updateEffectStatus: (id, status, extra) => { updated = { id, status, extra }; },
  });
  repo.updateEffectStatus("r1", "APPLIED", { attempts: 1 });
  assert.deepEqual(updated, { id: "r1", status: "APPLIED", extra: { attempts: 1 } });
});
