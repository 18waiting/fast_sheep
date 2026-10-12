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
