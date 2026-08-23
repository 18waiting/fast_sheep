import { test } from "node:test";
import assert from "node:assert/strict";
import { FeedbackService } from "../dist/index.js";

class Repo {
  rows = [];
  add(r) { this.rows.push({ ...r }); }
  list() { return this.rows; }
  updateEffectStatus() {}
}
class Client {
  calls = 0;
  async apply() { this.calls += 1; return { record_id: "x", ok: true, knowledge_op: "append", applied: true }; }
}

test("NO_SAVE performs zero worker knowledge calls and zero record writes", async () => {
  const repo = new Repo();
  const client = new Client();
  const service = new FeedbackService({ repository: repo, knowledgeClient: client, recordIdFactory: () => "fr-x" });
  const status = await service.handle({ class: "NO_SAVE", trust: "" });
  assert.equal(status.effect_status, "APPLIED");
  assert.equal(client.calls, 0);
  assert.equal(repo.rows.length, 0);
});
