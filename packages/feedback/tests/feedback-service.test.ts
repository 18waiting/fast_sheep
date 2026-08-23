import { test } from "node:test";
import assert from "node:assert/strict";
import { FeedbackService, effectForIntent, isNoSave } from "../dist/index.js";

class FakeRepo {
  rows = [];
  add(r) { this.rows.push({ ...r, effect_status: r.effect_status ?? "PENDING", attempts: r.attempts ?? 0 }); }
  list(limit = 10000) { return this.rows.slice(0, limit); }
  updateEffectStatus(id, status, extra) { const r = this.rows.find((x) => x.record_id === id); if (r) { r.effect_status = status; if (extra?.attempts !== undefined) r.attempts = extra.attempts; if (extra?.lastError !== undefined) r.last_error = extra.lastError; if (extra?.appliedAt !== undefined) r.applied_at = extra.appliedAt; } }
}

class FakeClient {
  calls = 0;
  fail = false;
  async apply(req) { this.calls += 1; if (this.fail) return { record_id: req.record_id, ok: false, knowledge_op: "none", index_refresh: "none", applied: false, error: "boom" }; return { record_id: req.record_id, ok: true, knowledge_op: "append", entry_id: "e1", index_refresh: "none", applied: true }; }
}

function make() {
  const repo = new FakeRepo();
  const client = new FakeClient();
  const clock = { now: () => 1000 };
  const service = new FeedbackService({ repository: repo, knowledgeClient: client, clock, recordIdFactory: () => "fr-1" });
  return { repo, client, service };
}

test("MANUAL feedback records + applies knowledge effect", async () => {
  const { repo, client, service } = make();
  const status = await service.handle({ class: "MANUAL", trust: "HUMAN_CONFIRMED", conversationId: "c1" });
  assert.equal(status.effect_status, "APPLIED");
  assert.equal(repo.rows.length, 1);
  assert.equal(client.calls, 1);
  assert.equal(repo.rows[0].trust_level, "HUMAN_CONFIRMED");
});
