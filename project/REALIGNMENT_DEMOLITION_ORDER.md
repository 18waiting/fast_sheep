 # 重对齐拆除顺序表（REALIGNMENT DEMOLITION ORDER）

 日期：2026-10-12
 依据：REA 批次 1 取证仓库 `fastwork-rea-batch1`（FastWork / 言店长 6.1008.4，Electron 30.5.1）
 授权：Owner 四项拍板（见下）+ “不计代价、接受功能倒退与删除、分批对齐”

 ---

 ## 0. Owner 已拍板的范围决策（2026-10-12）

 | # | 决策 | 内容 |
 |---|---|---|
 | D1 | 平台范围 | MVP 只做拼多多，打通后再加其他平台 |
 | D2 | 授权/计费/试用 | 整条线跳过（FastWork 的卡密/积分/试用心跳依赖其云端，不复刻） |
 | D3 | 额外业务线与桌面自动化 | BOSS 直聘获客、CSDN 发文、远程控制（向日葵）、桌面 UI 自动化（千牛/小红书客户端操控）先砍掉，后续按需再加 |
 | D4 | 商业目标 | 当前自用；长时间自用稳定后再考虑商用扩展 |

 沿用既有对齐决策：
 - FastWork 是产品目标；原 47 条锁定决策与旧治理文档全部失效（归档，不删除）。
 - 对齐等级：L1（行为）+ L2（结构）强制，L3（实现风格）自由。
 - B 线（SHEEP-300+ 自研概念体系）拆除：REA I-delta 已证 IdentityLock / ContextEnvelope / ReplyPlan / pre-send guard / SHADOW-HUMAN_CONFIRM-AUTO 在 FastWork 中全部 NOT_FOUND，拆除无需保留兼容层。

 ---

 ## 1. 批次表

 | 批次 | 名称 | 范围 | 验收标准 |
 |---|---|---|---|
 | B0 | 治理重铸 | 旧治理文档归档至 `project/history/pre-realignment-2026-10-12/`；新宪法 `project/FAST_SHEEP_MASTER_PROMPT.md` 生效；`AGENTS.md` 更新；`PROJECT_STATE.json` 重置为重对齐账本 | 新宪法存在且唯一；`project/` 根目录只含现行文件；AGENTS.md 引用与新宪法一致 |
 | B1 | 拆除五件套（TS 侧） | 删除 shadow 流水线 / ContextEnvelope / ReplyPlan 校验 / IdentityLock 校验 / pre-send guard / human-confirm controller 及其测试；`worker-runtime.ts` 去除 `initializeShadowMode`；orchestrator 收敛为“收件→建议→协同确认/全托管→发送→失败分类”主回路 | `pnpm run typecheck` 全绿；`rg "IdentityLock\|ContextEnvelope\|ReplyPlan\|preSendGuard\|SHADOW"` 在 src 中仅允许命中 `InboundEnvelope.identityLock` 字段（Phase 2 改名）；被删模块无残留 import |
 | B2 | 计费/授权线跳过 | 删除 `packages/domain` 的 entitlement / membership / authorization 三件套；Python tools 的 entitlement 闸门参数剥离；渲染层结构测试同步清理 | typecheck 全绿；`rg -i "entitlement\|membership" packages apps services` 无业务命中；Python `compileall` 通过 |
 | B3 | 平台收缩到拼多多 | 删除 `packages/platform-{doudian,jd,kuaishou,qianniu,xianyu}` 与 `platform-web-common`；删除 `apps/desktop/src/main/platforms/{doudian,jd,kuaishou,qianniu,xianyu}`；bootstrap / 能力注册表 / 会话协调器 / test-mode / IPC 类型 / 渲染层入口收敛为 PDD-only | typecheck 全绿；workspace 只剩 `platform-pdd`；启动路径只注册 PDD |
 | B4 | secret-store 移除 | 删除 `packages/secret-store`；`pdd-credential-reference-service` 改造（凭据引用逻辑随 Phase 2 session-partition 方案重做）；bootstrap 的 stub 接线移除 | typecheck 全绿；`rg "fastwork/secret-store"` 零命中 |
 | B5 | 产物与脚本清理 | `git rm resources/worker`（132MB 构建产物）并加入 `.gitignore`；根 `package.json` 脚本修剪（移除指向已删套件的 ci/test 命令）；孤儿测试套件删除 | `resources/worker` 不再被 git 跟踪；`pnpm run typecheck` 全绿；保留脚本均可执行 |

每批次独立 commit，任何批次结束时仓库必须 typecheck 全绿。

### B1 完成记录（2026-10-12）

- 已删除：shadow 流水线全家（bootstrap/orchestrator/report-generator/transport-blocker）、
  context-envelope-builder 及集成、reply-plan-verifier 及集成与孤儿 port、identity-lock-verifier、
  policy-engine、scene 分类/适配、rollout-mode-resolver、fact-freshness-verifier、unknown-identifier、
  audit-logger（shadow 专用，含孤儿 port 与测试）、pre-send-guard、human-confirm-controller、
  orchestrator 五件套接线与 8 个相关测试文件。
- 顺带修复（非拆除项）：`send-failure-classifier.ts` 两处预存 bug ——
  `refused` 关键词把 ECONNREFUSED 误判为平台拒绝；safe-pre-attempt 检查晚于 side-effect
  导致 "timeout before send" 被 "timeout during send" 子串抢先命中。
- 验证：`pnpm run typecheck` 全绿；orchestrator 92/92；apps/desktop 570/570（Node 22，`node:sqlite` 需要）。
- 残留（按验收标准允许，Phase 2 处理）：`packages/domain` 的 B 线类型
  （context-envelope/reply-plan/policy-decision/identity-inbound/confirmation-binding 等）与其
  contracts schema、Python worker 内部命名（reply_plan_builder 等）——它们被暂保留的 SQLite
  持久化层引用，随 P2-1/P2-3/P2-7 一并清除；`InboundEnvelope.identityLock` 字段为验收标准明示例外。

### B2 完成记录（2026-10-12）

- 已删除（Owner D2：整条计费/授权/试用线跳过）：
  - `packages/domain`：`entitlement.ts`、`membership-domain.ts`、`authorization-domain.ts`
    及 3 个对应测试；`index.ts` 导出同步移除。`MemberId` 改为在
    `conversation-ownership.ts` 本地定义（branded string），`ownership-execution.ts` 从其导入。
  - `packages/persistence`：Member/Membership/Seat 的 record、仓储接口与 SQLite 实现全部移除；
    migration `0005_identity_domain.sql`（含 `resources/persistence/migrations/` 副本，两处同步）
    改为 DROP members/memberships/seats 三表并留注释说明。
  - Python：`tool_executor.py` 的 `entitlement` 闸门参数与 `_disabled()` 移除（disabled 路径
    改由 definition `enabled=false` 表达）；`agent_loop.py` 停止读取 entitlement；
    `test_tool_executor.py` 相关用例删除；`m4_helpers.py`/`test_tool_golden_fixtures.py` 参数清理。
  - parity 金样 `GF-TOOL-008`：按宪法 §5 先在 `parity-tests/evidence-ledger.md` 记账，再将
    entitlement-mock 重定向为 definition `enabled=false`（期望结果不变：tool.disabled / NO_CALL）。
  - 渲染层结构测试：3 个负向断言文件的 "entitlement" token 换为 "billing"，语义保留。
- 测试修复：`workspace-identity.test.ts` / `identity-persistence.test.ts` 的
  "COUNT(*)=0" 断言改为 sqlite_master 表不存在断言（表已 DROP）。
- 验证：`pnpm run typecheck` 全绿；persistence 88/88、orchestrator 92/92、
  apps/desktop 570/570（Node 22）；domain 86/86；Python 472/472 + `compileall` 通过；
  GF-TOOL-008 金样 runner OK。
- 残留（均为允许项）：迁移文件与源码中的历史注释/移除说明；domain 测试中的负向断言 token；
  `fastwork-ai-worker.spec` 的 codesign `entitlements_file` 参数（macOS 签名概念，与计费无关）。
  `rg -i "entitlement|membership" packages apps services` 无任何业务代码命中。

### B3 完成记录（2026-10-12）

- 已删除（Owner D1：MVP 只做拼多多），共 364 个文件：
  - `packages/platform-{doudian,jd,kuaishou,qianniu,xianyu}`（258 个文件，含 dom fixtures、
    transfer-driver、平台测试）与 `packages/platform-web-common`（23 个文件）。
  - `apps/desktop/src/main/platforms/{doudian,jd,kuaishou,qianniu,xianyu,shared}`（57 个文件）
    与 `apps/desktop/src/platform-preloads/{doudian,jd,kuaishou,qianniu,xianyu}.ts`（5 个文件）。
  - `apps/desktop/src/main/smoke-probe-m8.ts`（五平台探针，由 PDD 探针取代）与
    `apps/desktop/tests/m8-{platform-preload-isolation,platform-permissions,platform-navigation,platform-ipc-sender-guard,multi-platform-isolation}.test.ts`（5 个文件）。
  - `packages/contracts/schemas/` 15 个非 PDD 平台 schema；注册表用
    `node scripts/generate-schema-registry.mjs` 重新生成为 172 条，`schema-catalog.md` 同步；
    `behavior-contract-map.json` 经查无被删 schema 引用。
- 收敛改造（启动路径只注册 PDD）：
  - `platform-host-registry.ts`：`PLATFORM_IDS = ["pdd"]`、`PlatformHostService = PddPlatformService`、
    `PlatformHostKind` 恒为 `"pdd"`，`isPlatformId` 作为唯一守卫。
  - `platform-capability-registry.ts`：能力表只含 PDD；未知平台一律返回全 false 的
    `FAIL_CLOSED_CAPABILITIES`（能力名沿用 `@fastwork/contracts` 的 `M8PlatformCapabilities`）。
  - `platform-session-coordinator.ts`：`isTrustedWebContents` 委托
    `PddPlatformService.isTrustedPddWebContents`。
  - `bootstrap.ts` / `index.ts`：删除五平台工厂与服务、M8 探针环境分支、`registerPageIpcFor` 扇出；
    启动只剩 `coordinator.register("pdd", platform)`。
  - `ipc/query-handlers.ts`：`CANONICAL_PLATFORMS = ["pdd"]`，并新增 `isPlatformId(req.platform)`
    校验 —— 非 PDD 过滤条件直接 `INVALID_REQUEST "unknown platform"`，避免历史数据靠裸字符串
    匹配穿透收缩后的队列过滤（fail closed）。
  - `smoke-probe-pdd.ts`：原抖店跨平台段改为 PDD 三店 a/b/c，字段
    `cross_platform_view_isolation` → `superseded_view_isolation`，`shops_tested: 3`；
    `scripts/verify-platform-native-view-isolation.mjs` 断言同步更新。
  - `test-mode.ts`（2 家 PDD 店）、`packages/desktop-ipc` 的 `QueuePlatformFilter = "pdd"`、
    `apps/desktop/package.json`（移除 6 个已删包依赖）、`scripts/build-pdd-preload.mjs`
    （去掉平台循环）、`scripts/audit-electron-unpacked.mjs`（5 个 preload 硬校验改为反向校验：
    打包产物中不得再出现 `dist/platform-preloads/`）。
  - workspace 由 20 个项目收缩为 14 个（13 packages + apps/desktop）；`pnpm-lock.yaml` 已刷新。
    〔2026-10-12 更正：本条与 B3 commit message 原写 “15”，实为 14；commit 已推送不改写历史，以本条为准。〕
- 顺带修复（非拆除项）：`packages/desktop-ipc/tests/channel-registry.test.ts` 在 HEAD 即为红
  （SHEEP-305 新增 `store_knowledge` 后实际 47 条通道 vs 陈旧期望 42），更新为 47/12/24/11
  并补 `store_knowledge` 断言。
- 测试改写：`m8-platform-{host-registry,capabilities,session-coordinator,shop-switch}`、
  `platform-active-view-isolation`、`conversation-list-query`、`main-composition`（7 店 → 2 店）。
- 验证（macOS 开发机，`.ts` 测试统一走 Node 22 + tsx）：
  - `pnpm run typecheck` 全绿（14 个 workspace 项目）。
  - apps/desktop **567/567**；orchestrator 92/92；persistence 88/88；domain 86/86（官方脚本
    只跑 `tests/*.test.mjs`）；desktop-ipc 9/9；contracts 20/20；platform-pdd 119/119；
    worker-rpc 33/33；background-jobs 13/13；feedback 9/9；product-optimization 17/17；
    secret-store 9/9；Python 472/472（+ `compileall`）。
  - Electron 实跑：`node scripts/verify-platform-native-view-isolation.mjs` **PASS**
    （3 家 PDD 店、`partitions_unique`、`shop_switch`、`superseded_view_isolation`、
    `native_view_bounds_rejected`、`cross_shop_message_leak`、`cross_shop_send_leak`、
    `manual_login_boundary` 全 true，`external_network_calls = 0`）。
  - desktop 三包重建（desktop-ipc → contracts → desktop）成功，`PDD preload bundled`。
- 残留（验收标准允许项 / 移交 B5）：
  - 根 `package.json` 的 `test:m8-platforms`、`test:m9-feedback-ts`、`ci:m8`、`ci:m9` 以及
    `scripts/run-m8-*`、`scripts/verify-m8-*`、`scripts/visual-evidence/capture-*` 仍指向已删套件
    与已删包 —— 属 B5「产物与脚本清理」范围，本批刻意不动，避免一次改动跨越两个批次边界。
  - `scripts/archive/milestone-verification/check-m8-no-network.mjs`、
    `check-m9-handoff-security.mjs` 仍含旧包名（历史归档脚本）→ B5。
  - `packages/domain` 的 `Platform` 联合类型与 `PLATFORM_DOUDIAN` 等常量作为**词表**保留：
    FastWork 本身是多平台产品，MVP 收缩发生在应用层（注册表 / bootstrap / IPC 过滤），
    领域词表保留可避免 Phase 2 加平台时反复改契约。
  - `packages/domain/tests/{audit-correlation,confirmation-binding,desktop-notification,transport-outcome,verification-record}.test.ts`
    未被任何脚本引用（domain 官方 test 脚本只跑 `*.test.mjs`），其中 B1 保留概念的孤儿断言已失效
    → B5 与孤儿测试套件一并处置。
  - `packages/legacy-import/tests/path-safety.test.ts` 2 条断言为 Windows 路径语义
    （`C:\…` / `a\b\c.txt`），在 macOS 失败，与 B3 无关 → `DEFERRED: 需要在个人电脑上运行测试`。
  - **B3 验证期间新发现的治理孤儿（非 B3 引入，移交 B5）**：
    `tests/project-state-consistency.test.mjs` 仍按 B0 之前的账本 schema 断言
    （读取 `state_authority.roadmap_identity_source` / `next_authoritative_roadmap_id`），
    自 B0 重置 `PROJECT_STATE.json` 为 V2.0 起即为红；它未被根 `package.json` 任何脚本引用。
    处置建议：随旧治理机械一并归档或删除（B5）。同类还有 `scripts/validate-project-state.mjs`。
  - 说明：本机 `node --test` 默认 Node v20.20.2 缺 `node:sqlite`，凡涉及 SQLite 的 `.mjs`/`.ts`
    套件必须走 Node 22（`/opt/homebrew/opt/node@22/bin`）；这不是失败，是主机能力差异。
    本轮实测 Node 22 下 `tests/scripts/create-controlled-pdd-shop.test.mjs` 6/6、
    `tests/secret-scan-rules.test.mjs` 5/5、`packages/secret-store` 9/9 全绿。

### B4 完成记录（2026-10-12）

- 依据：REA 批次 1 证据 —— FastWork 无 OS 级密钥库，凭据面 = `persist:shop-<id>` session 分区
  cookie + 云端密钥注入；本机为自用（Owner D4），不需要 keychain/DPAPI 抽象层。
- 已删除：
  - `packages/secret-store` 整包（`secret-store.ts` / `os-backed.ts` / `in-memory.ts` / `index.ts` /
    `tests/secret-store.test.mjs` / `package.json` / `tsconfig.json`，共 7 个跟踪文件 + 本地产物目录）。
    workspace 14 → 13 个项目，`pnpm-lock.yaml` 已刷新。
    **验收标准达成：`rg "fastwork/secret-store"` 全仓零命中**（仅治理文档中的历史叙述）。
  - `apps/desktop/src/main/services/pdd-credential-reference-service.ts`（131 行）与
    `apps/desktop/tests/pdd-credential-reference.test.ts`（11 条用例）。
    侦察结论：**它是孤儿服务** —— 全仓只有自身测试从 `dist` 引用它，bootstrap / index / IPC /
    worker-runtime 均无接线。因此拆除顺序表原文的「改造」在本批落为「删除」：
    凭据引用语义如果 Phase 2 的 REA 证据（session 分区 + 云端注入）确实要求，再按新方案重建，
    不保留自研的 sha256 派生 key 命名空间 `pdd.secret-ref.v1`。
  - `apps/desktop/package.json` 的 `@fastwork/secret-store` 依赖；
    `bootstrap.ts` 中从 `@fastwork/legacy-import` 引入却从未使用的 `SecretStoreAdapter`
    （即拆除顺序表所说的 “bootstrap 的 stub 接线”）。
- 明确保留（自含实现，不依赖被删包）：
  - `packages/legacy-import` 的 `SecretStorePort` + `SecretStoreAdapter`：内存 Map，只存
    `credential_ref`，明文不落盘；对应 FastWork 的 FastQA18 导入路径。
  - `services/ai-worker/.../providers/credential_resolver.py`：`credential_ref` → 值解析 +
    内置 fake store（离线测试用），无外部密钥库依赖。
- 验证（macOS，`.ts` 走 Node 22 + tsx）：
  - `pnpm run typecheck` 全绿（13 个项目）。
  - apps/desktop **556/556**（B3 的 567 减去被删的 11 条凭据引用用例）；platform-pdd 119/119；
    orchestrator 92/92；persistence 88/88；domain 86/86；worker-rpc 33/33；contracts 20/20；
    product-optimization 17/17；background-jobs 13/13；desktop-ipc 9/9；feedback 9/9；
    `tests/scripts/create-controlled-pdd-shop` 6/6；`tests/secret-scan-rules` 5/5。
  - Python 472/472 + `compileall` OK。
  - desktop 三包重建成功（`PDD preload bundled`）；Electron 实跑
    `scripts/verify-platform-native-view-isolation.mjs` **PASS**（3 家 PDD 店，
    `superseded_view_isolation` / `native_view_bounds_rejected` true，`external_network_calls = 0`）。
- 残留：
  - `scripts/run-m11-secret-migration-smoke.mjs` 在本机失败，根因是硬编码 Windows Python 启动器
    `spawn: { executable: "py", args: ["-3.12", ...] }` → worker 起不来 → `startup_timeout`；
    与 B4 无关 → `DEFERRED: 需要在个人电脑上运行测试`。B5 需决定：把所有 `py -3.12` 硬编码
    改成可解析的解释器（`.venv/bin/python` / `python3`），还是随 m11 链一并清理。
  - `packages/legacy-import/tests/path-safety.test.ts` 2 条 Windows 路径断言仍在 macOS 失败（主机相关）。
  - `tests/project-state-consistency.test.mjs` + `scripts/validate-project-state.mjs` 旧账本孤儿 → B5。
  - 凭据面现状（B4 之后）：PDD 登录态只存在于 Electron session 分区，仓库内不再有任何
    OS 密钥库/落盘密钥路径；导入期的明文只在内存中换成 `credential_ref`。

---

## 2. Phase 2 延迟项（拆除完成后按序推进，均需 REA 第二批证据配合）

 | # | 项 | 说明 | 依赖 |
 |---|---|---|---|
 | P2-1 | SQLite → JSON store 体系 | FastWork 无应用 SQLite，~36 个 JSON 文件 + 原子写入 + 滚动备份 + 损坏恢复为空列表。重建为 settings-store / shop-store / prompt-store / knowledge-store 等 | REA 批次 2：JSON 文件清单字段级结构 |
 | P2-2 | IPC 面重设计 | 现状 50 条英文点分通道 vs FastWork 216 条中文动词短语 + `window.__API__` | REA 批次 2：`renderer/js/mock-api.js` 全文导出（明文，最高价值） |
 | P2-3 | Python worker API 面对齐 | 现状 `conversation.generate(_v2)`；FastWork 语义为“对话聚合”（180s 超时、积分回写、kb_dirty） | REA 批次 2：动态观测 RPC 方法名与分帧格式 |
 | P2-4 | RPC 生命周期常量对齐 | ready≤60s（现 10s）、聚合 180s（现 30s）、退避 2/4/8s 后 30 分钟慢速重试（现 1/2/4s×3 封顶 30s）、Job Object 孤儿清理 | 无（本轮之后可直接做） |
 | P2-5 | 单侧车 → 五侧车拆分 | ai / auth / sync / qn / xhs；MVP 阶段仅需 ai（+ 视 P2-1 结果决定 sync） | P2-3 |
 | P2-6 | 本地 embedding → faiss 检索 + 云端向量 | FastWork 无 torch/onnx/sentence-transformers | REA 批次 2：向量维度与索引类型 |
 | P2-7 | `InboundEnvelope.identityLock` 等契约字段改名 | 字段语义（平台/商户/店铺/账号/客户身份解析）与 FastWork 兼容，仅命名是自研遗产 | P2-2 |
 | P2-8 | parity-tests 夹具修复 | 拆除后失效的 P0 金样条目按新宪法（证据台账驱动）修复或除名 | B1-B5 完成 |
 | P2-9 | 协同/全托管档位对齐 | 以 FastWork「协同 / 全托管 / 不入协同」三档语义重划现有 review-mode | REA 批次 2：档位切换与并发档位细节 |

 ---

 ## 3. 明确保留（FastWork 中真实存在的对应物）

 - Electron + WebContentsView 多店拓扑、`persist:shop-<id>` session 分区（对齐目标，现状保留）
 - Python worker 技术路线（REA 证实 FastWork = Python 3.10 侧车）
 - worker-rpc 生命周期骨架（stdio + ready 握手 + 心跳 + 退避重启；常量按 P2-4 对齐）
 - 知识库审查/复盘（对应 FastWork 复盘页、知识库审查、收录复盘到知识库）
 - 违禁词过滤（`forbidden-filter/store` 对应 `违禁词.json`）
 - 转接（FastWork 有 transfer 服务与转接页；现有 handoff 子系统保留待 Phase 2 对照）
 - 商品优化 / 每日优化（对应 FastWork 每日自动优化回路）
 - legacy-import（对应 FastWork 的 FastQA18 迁移；其 SecretStoreAdapter 本就是自含内存 stub，不依赖被删包）
 - 监听词、倒计时、发送失败分类、落地验证语义（与 FastWork 发送编排同构）

 ## 4. 明确拆除/跳过（FastWork NOT_FOUND 或 Owner 拍板跳过）

 - 五件套概念体系（B1）
 - 授权/计费/试用/会员/积分线（B2，Owner D2）
 - 非 PDD 平台适配（B3，Owner D1）
 - BOSS 获客 / CSDN 发文 / 远控 / 桌面 UI 自动化（本项目未曾实现，仅确认不进入范围，Owner D3）
 - OS 级密钥库（B4；FastWork 凭据 = session 分区 cookie + 云端密钥注入）
 - SQLite 持久化（Phase 2 P2-1 重建为 JSON store；本轮暂保留以免仓库瘫痪）
