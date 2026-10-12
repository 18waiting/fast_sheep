import { test } from "node:test";
import assert from "node:assert/strict";

import { IPC, QUERY_CHANNELS, COMMAND_CHANNELS, EVENT_CHANNELS, ALL_CHANNELS, isAllowedChannel } from "../dist/index.js";

// Incidental repair recorded under realignment B3: the registry grew by the five
// SHEEP-305 store_knowledge channels (12 query + 24 command + 11 event = 47) but
// this constant was never updated, so the suite was red before B3 started.
test("channel registry has 47 canonical channels (M6/M7/M10 + M11 8 + SHEEP-060/063 conversations + SHEEP-305 store_knowledge)", () => {
  assert.equal(ALL_CHANNELS.length, 47);
  assert.equal(QUERY_CHANNELS.length, 12);
  assert.equal(COMMAND_CHANNELS.length, 24);
  assert.equal(EVENT_CHANNELS.length, 11);
  assert.equal(new Set(ALL_CHANNELS).size, ALL_CHANNELS.length, "no channel appears in two classes");
  assert.equal(IPC.bootstrap, "desktop.bootstrap");
  assert.equal(IPC.manualSend, "orchestrator.manual_send");
  assert.equal(IPC.orchestratorEvent, "orchestrator.event");
  assert.equal(IPC.platformStatus, "platform.status");
  assert.equal(IPC.platformActivateShop, "platform.activate_shop");
  assert.equal(IPC.platformSetViewBounds, "platform.set_view_bounds");
  assert.equal(IPC.platformReload, "platform.reload");
  assert.equal(IPC.platformStatusChanged, "platform.status_changed");
  assert.equal(IPC.jobsList, "jobs.list");
  assert.equal(IPC.jobsGet, "jobs.get");
  assert.equal(IPC.jobsCancel, "jobs.cancel");
  assert.equal(IPC.learningStart, "learning.start");
  assert.equal(IPC.reviewPropose, "review.propose");
  assert.equal(IPC.reviewApply, "review.apply");
  assert.equal(IPC.reviewRestore, "review.restore");
  assert.equal(IPC.auditDecide, "audit.decide");
  assert.equal(IPC.optimizationPropose, "optimization.propose");
  assert.equal(IPC.optimizationApply, "optimization.apply");
  assert.equal(IPC.jobsChanged, "jobs.changed");
  assert.equal(IPC.learningChanged, "learning.changed");
  assert.equal(IPC.reviewChanged, "review.changed");
  assert.equal(IPC.auditChanged, "audit.changed");
  assert.equal(IPC.optimizationChanged, "optimization.changed");
  assert.equal(IPC.legacyImportSelect, "legacy_import.select");
  assert.equal(IPC.legacyImportApply, "legacy_import.apply");
  assert.equal(IPC.legacyImportChanged, "legacy_import.changed");
  assert.equal(IPC.conversationsListMessages, "conversations.listMessages");
  assert.equal(IPC.storeKnowledgeUpsert, "store_knowledge.upsert");
  assert.equal(IPC.storeKnowledgeQuery, "store_knowledge.query");
  assert.equal(IPC.storeKnowledgeList, "store_knowledge.list");
  assert.equal(IPC.storeKnowledgeDelete, "store_knowledge.delete");
  assert.equal(IPC.storeKnowledgeChanged, "store_knowledge.changed");
});

test("isAllowedChannel rejects arbitrary channels", () => {
  assert.ok(isAllowedChannel("desktop.bootstrap"));
  assert.ok(isAllowedChannel("jobs.list"));
  assert.ok(isAllowedChannel("audit.decide"));
  assert.ok(isAllowedChannel("legacy_import.plan"));
  assert.ok(!isAllowedChannel("generic.anything"));
  assert.ok(!isAllowedChannel("ipcRenderer.invoke"));
});

