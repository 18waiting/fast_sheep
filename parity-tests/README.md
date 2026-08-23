# Parity Tests (Golden Fixture Suite)

> TASK-014 deliverable (2026-08-15). Clean-room behavioral-parity oracles + golden fixtures. Spec reports live in `spec/parity/`; machine-readable contract in `static/rebuild/contracts/parity-suite.json`.

## Layout
```
parity-tests/
├── contracts/            golden-fixture.schema.json, expected-trace.schema.json
├── manifests/            p0-golden-manifest.json, all-behaviors.json
├── fixtures/             GF-*.json per domain (222 cases, 174 P0)
│   └── legacy/           synthetic legacy import packages (9 packages)
└── README.md
```

## How to use
1. Read `spec/parity/behavioral-parity-strategy.md` (classes, levels, gates) and `spec/parity/comparison-rules.md`.
2. Implement the test seams from `spec/parity/test-harness-design.md` (FakeClock, MockGenerationProvider, MockEmbeddingProvider, FakePlatformAdapter, InMemoryRepositories, CapturedEventBus, recorders).
3. Load fixtures from `fixtures/`, validate against `contracts/golden-fixture.schema.json`, drive the harness, compare per `comparison` mode.
4. Produce a run report per `spec/parity/parity-run-report-template.md`.

## Gates
- P0 PARITY GREEN: 100% P0 passed; 0 unexpected external calls; 0 schema violations; 0 frozen-fixture mutations; 0 security-regression failures.
- P1: all failures triaged; ≥95% green target at release candidate.
- Milestone gates mapped in `static/rebuild/contracts/parity-suite.json` and `spec/rebuild/implementation-roadmap.md`.

## Provenance & immutability
- All current fixtures are SPEC_DERIVED (provenance.status). Future black-box observations flow through `spec/parity/reference-evidence-protocol.md` and require a fixture revision.
- FROZEN fixtures change only via evidence update → parity review → revision → change log → traceability update (`parity-tests/evidence-ledger.md`).

## Boundaries
- No live network: zero provider/platform/sync/auth calls (everything mocked).
- No real customer data, shop credentials, API keys, or card values — synthetic only.
- Legacy fixtures are synthetic copies; import never touches original FastWork directories.
