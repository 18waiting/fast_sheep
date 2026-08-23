# @fastwork/platform-web-common

Clean-room M8 (TASK-023) platform-neutral web-platform infrastructure. Contains ONLY
generic types/helpers that are parameterized by a SelectorProfile + PlatformCapabilities
injected per platform. It holds NO actual selectors, NO platform-specific capabilities, and
NO platform-specific transfer/message semantics. Each platform package
(@fastwork/platform-doudian|jd|kuaishou|qianniu|xianyu) supplies its own profile and
capability matrix and reuses these generic engines.
