# @fastwork/platform-doudian

Clean-room M8 (TASK-023) Doudian (抖店) web-platform adapter. Implements the M5
PlatformAdapter boundary with a versioned synthetic DOM contract
(doudian-dom-1.0.0, PARTIAL/DESIGN provenance). No real seller network/login in
automated tests; no CAPTCHA/anti-bot; no cookie/token access. Reuses
@fastwork/platform-web-common generic infrastructure.
