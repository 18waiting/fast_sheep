// DERIVED / REDACTED archival copy. Do not execute: it would write historical output.
throw new Error('ARCHIVED_DERIVATIVE_NOT_EXECUTABLE');
// Diagnostic-only harness. No platform/network/runtime wiring and no dependency install.
// Runs unchanged existing assertions against type-transformed copies of current source.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const temp = join(root, '.tmp/pdd-inbound-analysis-2026-09-20');
const dist = join(temp, 'dist');
const tests = join(temp, 'tests');
mkdirSync(dist, { recursive: true });
mkdirSync(tests, { recursive: true });
writeFileSync(join(temp, 'package.json'), '{"type":"module"}\n');
const sourceHashes = {};
const hash = text => createHash('sha256').update(text).digest('hex');
for (const name of ['inbound-normalizer', 'message-normalizer', 'message-deduplicator']) {
  const sourcePath = `packages/platform-pdd/src/${name}.ts`;
  const code = readFileSync(join(root, sourcePath), 'utf8');
  sourceHashes[sourcePath] = hash(code);
  writeFileSync(join(dist, `${name}.js`), stripTypeScriptTypes(code, { mode: 'transform' }));
  const testPath = `packages/platform-pdd/tests/${name}.test.ts`;
  const testCode = readFileSync(join(root, testPath), 'utf8');
  sourceHashes[testPath] = hash(testCode);
  writeFileSync(join(tests, `${name}.test.js`), stripTypeScriptTypes(testCode, { mode: 'transform' }));
}
writeFileSync(join(tests, 'diagnostic-counterexamples.test.js'), `
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePddInbound } from '../dist/inbound-normalizer.js';
import { normalizeMessage } from '../dist/message-normalizer.js';
import { MessageDeduplicator } from '../dist/message-deduplicator.js';
const ids = ['synthetic-m1', 'synthetic-m2', 'synthetic-m3'];
const payload = (id, extra = {}) => ({
  content: 'synthetic test message', from: { role: 'user', uid: '10001' },
  to: { role: 'mall_cs', uid: 'synthetic-agent' }, msg_id: id, ...extra
});

test('COUNTEREXAMPLE: one latest snapshot loses two of three messages', () => {
  const observed = [ids.at(-1)];
  assert.deepEqual(ids.filter(id => !observed.includes(id)), ['synthetic-m1', 'synthetic-m2']);
});

test('COUNTEREXAMPLE: even three perfect triggers cannot recover a latest-only burst', () => {
  // All reads complete after all three messages arrive. This is a possible schedule,
  // not a claim about PDD scheduling or notification counts.
  const latestResponses = ids.map(() => ids.at(-1));
  assert.deepEqual([...new Set(latestResponses)], ['synthetic-m3']);
});

test('COUNTEREXAMPLE: faster latest-only polling still has a finite blind interval', () => {
  const messages = ids.map((id, i) => ({ id, t: 10 + i }));
  const observations = [0, 20, 40].flatMap(t => messages.filter(m => m.t <= t).slice(-1));
  assert.deepEqual([...new Set(observations.map(m => m.id))], ['synthetic-m3']);
});

test('MODEL ONLY: a complete replay source with overlap can recover all three IDs', () => {
  // Hypothetical source contract; does NOT claim a PDD history API exists.
  const completePages = [[ids[0], ids[1]], [ids[1], ids[2]]];
  assert.deepEqual([...new Set(completePages.flat())], ids);
});

test('NO PROTOCOL INFERENCE: pre_msg_id remains opaque and cannot reconstruct content', () => {
  const result = normalizePddInbound(payload(ids[2], { pre_msg_id: ids[1] }));
  assert.equal(result.status, 'NORMALIZED');
  assert.equal(result.candidate.opaquePlatformFields.preMsgId, ids[1]);
  assert.equal(Object.hasOwn(result.candidate, 'history'), false);
});

test('NO PROTOCOL INFERENCE: heartbeat or ACK labels are not accepted buyer messages', () => {
  for (const method of ['titan.sync', 'titan.notifyDataLite.ack']) {
    assert.equal(normalizePddInbound({ method }).status, 'REJECTED');
  }
});

test('SCOPE: candidate does not invent store, conversation, or canonical envelope', () => {
  const result = normalizePddInbound(payload(ids[0]));
  assert.equal(result.status, 'NORMALIZED');
  for (const field of ['storeId', 'conversation_id', 'identityLock', 'sourceOccurredAt']) {
    assert.equal(Object.hasOwn(result.candidate, field), false);
  }
});

test('COUNTEREXAMPLE: legacy content fingerprint merges distinct identical-text messages', () => {
  const input = { shop_id: 'synthetic-shop', conversation_id: 'synthetic-conversation',
    raw: { unread: true, content: 'synthetic repeated content' } };
  const first = normalizeMessage(input);
  const second = normalizeMessage(input);
  const dedup = new MessageDeduplicator(8);
  assert.equal(first.platform_message_id, second.platform_message_id);
  assert.equal(dedup.observe(first.platform_message_id), true);
  assert.equal(dedup.observe(second.platform_message_id), false);
});

test('COUNTEREXAMPLE: bounded in-memory dedup is not a durable replay checkpoint', () => {
  const beforeRestart = new MessageDeduplicator(8);
  const afterRestart = new MessageDeduplicator(8);
  assert.equal(beforeRestart.observe(ids[0]), true);
  assert.equal(afterRestart.observe(ids[0]), true);
});

test('PROTOCOL ENCODING ONLY: opcode-2 CDP payload is base64, not raw UTF-8 JSON', () => {
  const bytes = Buffer.from([0, 255, 128, 1, 123, 125]);
  const cdpPayloadData = bytes.toString('base64');
  assert.deepEqual(Buffer.from(cdpPayloadData, 'base64'), bytes);
  assert.notDeepEqual(Buffer.from(cdpPayloadData, 'utf8'), bytes);
  // No protobuf, encryption, compression, or Titan business schema is assumed.
});
`);
const execution = spawnSync(process.execPath, ['--test', '--test-reporter=tap',
  ...['inbound-normalizer', 'message-normalizer', 'message-deduplicator', 'diagnostic-counterexamples']
    .map(name => join(tests, `${name}.test.js`))], { cwd: root, encoding: 'utf8' });
const stdout = execution.stdout ?? '';
const stderr = execution.stderr ?? '';
writeFileSync(join(here, 'offline-tests.tap'), stdout);
const changed = Object.keys(sourceHashes).filter(path => hash(readFileSync(join(root, path), 'utf8')) !== sourceHashes[path]);
const summary = {
  result: execution.status === 0 && changed.length === 0 ? 'PASS' : 'FAIL',
  runtime: process.version,
  existing_assertions: 13,
  diagnostic_counterexamples_and_models: 10,
  expected_total: 23,
  exit_code: execution.status,
  source_files_changed: changed,
  source_hashes: sourceHashes,
  network_in_test_code: false,
  platform_runtime_started: false,
  production_fix_claimed: false,
  typecheck_performed: false,
  full_package_suite_performed: false,
  method: 'Node stripTypeScriptTypes transforms copies only; existing assertion bodies unchanged; no full compiler/typecheck/DOM/Electron smoke',
  stderr,
};
writeFileSync(join(here, 'offline-validation.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(stdout);
console.log(JSON.stringify(summary, null, 2));
if (summary.result !== 'PASS') process.exitCode = 1;
