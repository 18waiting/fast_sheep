import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { basename, resolve, sep } from "node:path";
import { proofRootForRepo, validateProofRoot } from "./path-policy.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..", "..");
const EXPECTED = proofRootForRepo(REPO_ROOT);

test("project .tmp subdirectory is accepted before any write", () => {
  const result = validateProofRoot(REPO_ROOT, EXPECTED);
  assert.equal(result.ok, true);
  assert.equal(result.reason, "OK");
  assert.equal(result.resolvedCandidate, EXPECTED);
});

test("sibling fast_sheep.tmp path is rejected", () => {
  const rejected = resolve(REPO_ROOT, "..", `${basename(REPO_ROOT)}.tmp`, "sheep-301-local-electron-websocket-boundary-proof");
  const before = existsSync(rejected);
  const result = validateProofRoot(REPO_ROOT, rejected);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "PATH_OUTSIDE_REPO");
  assert.equal(existsSync(rejected), before, "validation must not create the rejected path");
});

test("parent traversal is rejected", () => {
  const rejected = resolve(REPO_ROOT, ".tmp", "..", "escape");
  const before = existsSync(rejected);
  const result = validateProofRoot(REPO_ROOT, rejected);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "NOT_EXACT_PROOF_ROOT");
  assert.equal(existsSync(rejected), before, "validation must not create the rejected path");
});

test("repo-relative containment is checked without self-equality shortcut", () => {
  const result = validateProofRoot(REPO_ROOT, EXPECTED);
  assert.equal(result.relativeToRepo, [".tmp", "sheep-301-local-electron-websocket-boundary-proof"].join(sep));
  assert.notEqual(result.relativeToRepo, "");
});
