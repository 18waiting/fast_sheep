# @fastwork/platform-pdd

Clean-room M7 (TASK-022) PDD platform vertical slice. Pure platform semantics:
PddPlatformAdapter (M5 PlatformAdapter implementation), message normalization,
bounded dedup, versioned SelectorProfile, session state, DOM command/event types,
and a browser-safe page runtime. No Electron lifecycle is owned here (that lives in
apps/desktop/src/main/platforms/pdd).

Deterministic tests run against clean-room synthetic DOM fixtures (tests/fixtures/*.html)
via jsdom. No real PDD network/login; no CAPTCHA/anti-bot code; no cookie/token access.
