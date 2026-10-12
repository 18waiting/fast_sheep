 # 地基对齐评估（FOUNDATION ALIGNMENT ASSESSMENT）

 日期：2026-10-12（B5 产出）
 状态：**待 Owner 签核**。本文只评估与建议，未在仓库里执行任何“砸”的动作。
 依据：REA 批次 1 取证仓库 `~/Documents/ChatGPT/fastwork-rea-batch1/`（FastWork / 言店长
 6.1008.4，Electron 30.5.1 / Chromium 124.0.6367.243，`A-identity.md` CONFIRMED）
 + 本机实测（typecheck / build / 1062 条测试 / 472 条 Python 测试 / Electron 实跑）。

 判定口径沿用现行宪法：**L1 行为 + L2 结构强制对齐，L3 实现风格自由**；
 FastWork 中 NOT_FOUND 的自研概念不得复活。

 ---

 ## 0. 结论摘要

 B0–B5 拆掉的是**上层违建**（概念校验器、计费线、多平台、密钥库、135 条脚本、构建产物）。
 拆完之后剩下的地基里，仍有 **6 处与 FastWork 直接对不上**，其中 3 处是结构级冲突：

 | 档 | 数量 | 含义 |
 |---|---|---|
 | 砸（SMASH） | 6 项 | 与 FastWork 结构/概念冲突，保留即持续背离 |
 | 改（REWORK） | 7 项 | 骨架可用，参数/命名/形态需对齐 |
 | 留（KEEP） | 7 项 | 已有 FastWork 对应物，或属 L3 自由且不冲突 |

 一句话：**承重墙（Electron + WebContentsView 多店 + `persist:shop-<id>` + Python 侧车 +
 stdio JSONL + faiss 检索）是对的，可以直接用**；**但楼里还住着 B 线的 ghosts（概念层没拆干净）、
 地基材料选错了一处（SQLite）、并且同一份契约存在两棵已经分叉的树（打包态读的是旧的那棵）**。

 ---

 ## 1. 砸（SMASH）—— 与 FastWork 对不上的地基建材

 ### S1 SHEEP-311 五件套死代码簇（风险 0，可立刻删）

 - 现状：`packages/domain/src/` 下 `confirmation-binding.ts`、`verification-record.ts`、
   `transport-outcome.ts`、`desktop-notification.ts`、`audit-correlation.ts` 五个模块
   **只互相引用 + 被 `index.ts` 导出**，无任何业务代码消费（实测 rg：外部引用分别为
   2/2/3/2/1 处，且全部落在本簇内部与 `index.ts`）。
 - FastWork 证据：`I-delta.md` I3 —— pre-send guard / HUMAN_CONFIRM 三档 / 发送前守卫
   全部 **NOT_FOUND**；FastWork 只有“发送后遮罩处理”“发送后落地验证”。
 - 动作：删 5 个源文件 + `index.ts` 对应导出块。B5 已删掉它们的孤儿测试，删源后闭环。
 - 风险：**零**。这是纯死代码。

 ### S2 ContextEnvelope / ReplyPlan 概念层（最大手术，需专门批次）

 - 现状：B1 只删了校验器与文档，**概念本体仍在活代码里**：
   - `packages/domain/src/context-envelope.ts`、`reply-plan.ts`（`index.ts` 仍在导出）
   - `services/ai-worker/src/fastwork_ai_worker/conversation/reply_plan_builder.py`（整文件）
   - `services/ai-worker/src/fastwork_ai_worker/conversation/conversation_engine.py`
   - `resources/contracts/schemas/domain/{context-envelope,reply-plan}.schema.json`
   - 实测 rg 命中面：ContextEnvelope 16 个文件、ReplyPlan 6 个（含 apps/desktop/tests 11 处）
 - FastWork 证据：`I-delta.md` I3 —— `ContextEnvelope` / `上下文信封` / `ReplyPlan` /
   `回复计划` 全字符串池 **0 命中**；结论原文：“如果你要拆掉它，不需要为对齐 FastWork
   保留任何兼容层。”
 - 动作：删除概念与其 schema/导出，把其中**真实的行为**（收件→组上下文→出回复→发送）
   直接落在 FastWork 的语义上：对话聚合请求（180s）+ `{成功, 错误}` 返回形态
   （`D-ipc.md` D1/D2 替代证据，CONFIRMED）。
 - 风险：中。会动 Python 对话主链与其 9 个测试文件，需要一次独立批次 + 全量回归。

 ### S3 IdentityLock / ExecutionIntent / AdapterIdentityEvidence（AU-03/AU-04 遗产）

 - 现状：`packages/domain/src/{identity-inbound,execution-intent,adapter-identity-evidence}.ts`、
   `packages/contracts/schemas/domain/{identity-lock,inbound-envelope,execution-intent,adapter-identity-evidence}.schema.json`、
   `resources/persistence/migrations/0009_shadow_audit.sql`（SHADOW 审计表）。
   实测 rg 命中面：IdentityLock 26 文件 / identity_lock 21 / identityLock 23 / ExecutionIntent 10。
 - FastWork 证据：`I-delta.md` I3 —— IdentityLock / 身份锁 **NOT_FOUND**；
   `C-storage.md` C9 给出真实身份链：`shops.json`（店）→ `persist:shop-<id>`（会话）→
   `settings/…`（配置）→ `技能文件夹/<技能名>/`（能力）→ `vector/`（索引）→ `.sync/`（云同步镜像）。
 - 动作：**砸掉概念名，保留其中真实存在的身份解析行为**（平台/商户/店铺/账号/客户），
   收敛到 C9 那条链上；`SHADOW` 审计表随 S6 一并处理。
   （注意：`REALIGNMENT_DEMOLITION_ORDER.md` P2-7 原写“改名保留”，本评估建议升级为“砸名留行为”，
   因为宪法禁止 NOT_FOUND 概念以同义变体复活，改名保留正好踩这条。）
 - 风险：中。契约层与迁移文件都要动，但无真实运行数据需要迁移（自用、可接受倒退）。

 ### S4 重复且已分叉的契约树 `resources/contracts/`（这是当前真实缺陷，不只是冗余）

 - 现状：仓库里有两棵 schema 树，**内容已经不一致**：
   - `resources/contracts/schemas/`（190 文件）：仍含 `domain/context-envelope.schema.json`、
     `domain/reply-plan.schema.json`（S2 要砸的概念），**缺** `identity-lock`、`inbound-envelope`。
   - `packages/contracts/schemas/`（173 文件）：含 `identity-lock`、`inbound-envelope`，
     **无** context-envelope / reply-plan。
 - 谁在读哪棵：
   - 开发态：`services/ai-worker/.../rpc/protocol.py::_schemas_root()` → `packages/contracts/schemas`
   - 打包态：`apps/desktop/electron-builder.yml` extraResources `../../resources/contracts → contracts`，
     `apps/desktop/src/main/worker-runtime.ts::PACKAGED_CONTRACTS_SCHEMAS_REL_DIR = contracts/schemas`
     → **打包后校验用的是那棵过期树**。
 - FastWork 证据：`H-deps.md` H1 —— 生产依赖只有 adm-zip / bytenode / electron-log / koffi；
   asar 内 724 条目里**没有任何 JSON-schema 校验层**。契约树本身是我方 L3 自由基建。
 - 动作：**砸掉 `resources/contracts/` 整棵树**，单一真源 = `packages/contracts/schemas/`；
   同步改 `electron-builder.yml` extraResources 与 `worker-runtime.ts` 的相对路径。
 - 风险：低。两棵树的存活差异已确认；改完打包态与开发态终于读同一份契约。

 ### S5 SQLite 持久化（材料与目标运行时不兼容）

 - 现状：`packages/persistence/src/db/sqlite-driver.ts` 用 `node:sqlite` 的 `DatabaseSync`；
   `resources/persistence/migrations/0001..0009.sql`；`sqlite-*` repository 11 个 + memory-* 11 个。
   实测：本机默认 Node v20.20.2 **没有** `node:sqlite`，跑 persistence 测试必须借
   `/opt/homebrew/opt/node@22`（v22.23.3）——今天 B5 全量验证就是这么跑的。
 - FastWork 证据：
   - `C-storage.md` 开头原文：“**本版本的应用持久化不是数据库，而是「JSON 文件 + 目录约定」**”，
     C1 完整 SQLite schema = **NOT_FOUND**，主进程 = **~36 个 JSON 文件 + userData 目录约定**。
   - 已 CONFIRMED 的存储行为：`dist/services/原子写入.jsc`（原子写）、滚动备份
     （`[数据] 滚动备份失败(不阻断保存)`）、损坏恢复为空列表
     （`[数据] shops.json 损坏且无可用备份,从空列表开始`）、数据目录可配置（`设置数据目录 后,userData=`）。
   - 运行时冲突：`A-identity.md` A3 Electron **30.5.1** CONFIRMED（Node 版本 REA 标 NOT_FOUND；
     按 Electron 30 的公开对应关系为 Node 20.x，此条为 **INFERRED**）。`node:sqlite`
     自 Node 22.5 起才存在 → **装进 FastWork 同版本 Electron 里根本跑不起来**。
 - 动作：砸掉 SQLite 层，按 C6 的文件清单重建 JSON store（settings-store / shop-store /
   prompt-store / knowledge-store …）+ 原子写 + 滚动备份 + 损坏兜底为空列表。
   这就是 `REALIGNMENT_DEMOLITION_ORDER.md` 的 P2-1，本评估把它从“Phase 2 延迟”
   提升为**地基级必做**，理由是上面的运行时不兼容（不是风格问题，是跑不起来的问题）。
 - 风险：高（影响面最大），但已有 11 个 `memory-*` repository 可作为行为参照，
   且 Owner 已明确“接受功能倒退甚至删除、不计代价”。
 - 需要 REA 批次 2：36 个 JSON 文件的**字段级结构**（尤其 `shops.json` / `auth.json` /
   `通用.json` / `高阶设置.json` / `协同.json`）。

 ### S6 SHADOW / HUMAN_CONFIRM / AUTO 三档灰度

 - 现状：实测 rg 命中 HUMAN_CONFIRM 47 个文件、SHADOW 11 个；
   `packages/domain/src/index.ts` 的 `TrustLevel` 仍含 `HUMAN_CONFIRMED`；
   `resources/persistence/migrations/0009_shadow_audit.sql` 是专门的 shadow 审计表。
 - FastWork 证据：`I-delta.md` I3 —— 三个标识符 **0 命中**（唯一 `shadow` 命中是 DOM 的
   `shadowRoot`）。真实存在的近邻概念是**运行模式三档**：协同 / 全托管 / 不入协同
   （CONFIRMED 串：`[调度] 切换协同模式`、`按开关不入协同面板(零出站零AI),需回复请人工在平台页手打`、
   `全托管并发降为免费档`、`启用倒计时自动切全托管`）。
 - 动作：砸掉三档灰度与 shadow 审计表，改为 FastWork 的三档运行模式（= P2-9）。
   注意语义差别：FastWork 那三档是**出站/并发/计费档位**，不是“回复内容风险分级”，
   且**没有人工确认环节**。
 - 风险：中。orchestrator 主回路的模式开关要重写，但 B1 已把 shadow 流水线删了，剩下的是命名与档位语义。

 ---

 ## 2. 改（REWORK）—— 骨架对、参数/命名/形态错

 ### R1 Electron 版本（与 S5 绑定决策）

 - 现状：`apps/desktop/package.json` devDependencies `electron: 43.6.0`，
   而 `apps/desktop/electron-builder.yml` 写 `electronVersion: 43.4.0` —— **两者自己就不一致**。
 - FastWork：30.5.1 / Chromium 124.0.6367.243（CONFIRMED）。
 - 建议：pin 到 30.5.1。理由是它与 S5 是同一个决策的两面：留在 43 就等于默认可以继续用
   `node:sqlite`，也就等于放弃存储对齐。
 - 风险：中。Electron 30 的 API 面（WebContentsView 等）与 43 有差异，需要重跑
   `scripts/verify-platform-native-view-isolation.mjs`（今天 B5 在 43.6.0 下 PASS）。

 ### R2 IPC 面（P2-2）

 - 现状：`packages/desktop-ipc/src/channels.ts` = **50 条英文点分通道**（`shops.list`、
   `orchestrator.set_mode`…）；`apps/desktop/src/preload/index.ts` 暴露
   `contextBridge.exposeInMainWorld("fastworkDesktop", api)`。
 - FastWork（`D-ipc.md`）：通道是**中文动词短语、无命名空间分隔符**（CONFIRMED：对全字符串池
   匹配英文冒号命名空间 → 应用侧 0 命中）；通道表来源单一 `dist/shared/ipc-channels.jsc`，
   被 **24 个**模块 require；preload 暴露 **`window.__API__`**（CONFIRMED）；
   规模 958 原始 → 335 候选 → **216 条跨模块交叉验证**（INFERRED，约 15–20% 条目带尾部粘连噪声）。
 - 建议分两步：
   1. **现在就能做**（CONFIRMED 部分）：暴露名改 `window.__API__`；通道表收敛为单一模块
      （我方 `channels.ts` 已是单一模块，形态对齐）；返回值形态补 `{成功, 错误}` 兼容层。
   2. **等 REA 批次 2**（INFERRED 部分）：按 `renderer/js/mock-api.js` 全文（明文 JS，
      REA 称“重建 API 面最有价值的单一文件”）逐条对齐通道名与入参/返参。
      不要拿 216 条候选里带噪声的条目逐字当本体字段名。

 ### R3 worker RPC 生命周期常量（P2-4，零外部依赖，最快见效）

 | 项 | 我方现状（`packages/worker-rpc/src/protocol/constants.ts`）| FastWork（`B-topology.md` B7 / `E-rpc.md` E6，CONFIRMED）|
 |---|---|---|
 | ready 握手超时 | 10s（打包态 20s）| **60s** |
 | 单请求/聚合超时 | 30s（打包态 60s）| 对话聚合 **180s** |
 | 重启退避 | 1s→2s→4s，封顶 30s，最多 3 次 | **2/4/8s**，耗尽后转**每 30 分钟慢速重试** + 推常驻通知 |
 | 心跳探活 | 无 | **有**（第 N 次探活失败 → 判假死 → kill → 自动重启）|
 | 假死/内存回收 | 无 | `焕新重启:kill AI 子进程…释放 Python 堆`；另有 `memory-reclaimer.jsc` |
 | 代际判定 | 无 | `旧子进程退出事件迟到(code=…,状态已由新进程接管,忽略)` |
 | 孤儿清理 | 无 | Windows **Job Object**（`dist/services/job-object.jsc`），失败则下次启动兜底 |
 | 崩溃隔离声明 | 无 | 子进程故障不阻断其他平台（“AI 回复/其他平台接待不受影响”）|

 - 建议：这一项**不需要等 REA 批次 2**，常量与生命周期语义已全部 CONFIRMED，可以直接做。

 ### R4 关联字段与错误模型

 - 现状：请求关联用 `request_id`（`packages/worker-rpc/src/protocol/types.ts`）；
   错误模型是 `RPC_ERROR_CODES` 枚举 + category（validation/config/credentials/provider/…）。
 - FastWork：关联字段是 **`token`**（CONFIRMED：`回写积分响应失败:子进程不存在(token=`）；
   错误**不走错误码表**，走“日志 + 降级”（CONFIRMED：`本次将自动重启: 是(指数退避 2/4/8s,
   耗尽则只记日志不锁页,AI 是降级功能)`；`config 为空,密钥未注入(AI 将回 403 未登录禁用)`）。
 - 建议：`request_id` → `token`（L2 命名对齐）；错误枚举可作 L3 保留，但必须补上
   “AI 是降级功能、耗尽只记日志不锁页”的降级语义。

 ### R5 Python 运行时与打包

 - 现状：`services/ai-worker/pyproject.toml` `requires-python >= 3.11`，本机 `.venv` 是 3.12；
   依赖 `faiss-cpu` + `numpy`。
 - FastWork：**Python 3.10**（CONFIRMED：`python310.dll` + `*.cp310-win_amd64.pyd`）；
   ai/auth/sync = **Nuitka standalone**，qn/xhs = PyInstaller onefile；
   有 faiss/numpy/pandas，**无 torch / sentence-transformers / transformers / onnxruntime**
   （`B-topology.md` B3/B4、`H-deps.md` H2/H4）。
 - 已对齐的部分（**留**）：faiss + numpy 检索路线、无本地 embedding 权重、无 torch 生态。
 - 建议：把 `requires-python` 收到 3.10 兼容（或明确记为 L3 偏离并写进宪法）；
   打包方式（Nuitka vs PyInstaller）留到 Phase 2 与 `resources/worker` 一起重做。

 ### R6 单侧车 → 多侧车（P2-5）

 - FastWork：按域拆 **5 个独立 worker**（ai / auth / sync / qn / xhs），各自独立生命周期与
   降级语义（CONFIRMED，`E-rpc.md` E5：“这与『一个 worker 多个命名空间』是不同架构”）。
 - 我方：单个 `services/ai-worker`（194 文件 / 10.7k 行），内含 audit/conversation/feedback/
   handoff/learning/legacy_import/optimization/persistence/prompt/providers/rag/review/rpc/tools。
 - 建议：MVP 阶段只需 **ai** 侧车（auth 线已按 Owner D2 砍掉，qn/xhs 按 D3 砍掉）；
   `sync`（坚果云 + `.sync` 镜像，`C-storage.md` C9 CONFIRMED）等 P2-1 落地后再决定。
   即：这一项在 MVP 内**不改结构**，只把边界写清楚，避免以后拆不动。

 ### R7 打包配置残留

 - `apps/desktop/electron-builder.yml` 的 extraResources 仍指向 `../../resources/worker`
   （B5 已本地删除并整目录 ignore）与 `../../resources/contracts`（S4 要砸的树）。
 - 建议：B5 只标记不动（打包在 Phase 2 重做）；S4 落地时同步修 contracts 那条。

 ---

 ## 3. 留（KEEP）—— 已有 FastWork 对应物，或 L3 自由且不冲突

 | # | 保留项 | 依据 |
 |---|---|---|
 | K1 | Electron + **WebContentsView** 多店拓扑（非 BrowserView）| `D-ipc.md` D6 CONFIRMED；我方 `verify-platform-native-view-isolation.mjs` 今天 Electron 实跑 PASS |
 | K2 | **`persist:shop-<id>`** 每店 session 分区 | `C-storage.md` C7 CONFIRMED；我方 `apps/desktop/src/main/platforms/pdd/pdd-session-partition.ts` 命名逐字一致 |
 | K3 | session 加固：openExternal 一律拒绝 + 合法域名白名单 | `D-ipc.md` D6（`dist/services/session-gate.jsc`）CONFIRMED |
 | K4 | Python 侧车技术路线 + **faiss/numpy 检索、无 torch/无本地权重** | `B-topology.md` B3/B4、`H-deps.md` H2/H4 CONFIRMED |
 | K5 | worker 传输 = **stdio + 行分隔 JSON + ready 握手** | `B-topology.md` B6（stdio/ready CONFIRMED，分帧格式 INFERRED 为行分隔 JSON）；我方 `JsonlDecoder` 与之同构 |
 | K6 | monorepo 12 包 + `apps/desktop` 结构 | FastWork 是 `main.jsc` + 164 个 service 模块平铺（`F-modules.md`）；包划分属 L3 自由，不构成冲突。**但**我方 `apps/desktop/src/main/services` 只有 18 个文件 → 这是**覆盖度缺口**，不是结构冲突 |
 | K7 | typed contracts 层本身（**只留一棵树**，见 S4）；自研渲染层 | FastWork 无 schema 校验层（`H-deps.md` H1），属我方 L3 自由基建；渲染层 UI 形态自由，但 FastWork 的四个独立视图（工单操作条 `workorder-bar.html` / 小言助手 `ai-qa.html` / 图库 `gallery.html` / 通知面板 `notice-panel.html`）属 L2 结构，Phase 2 对照 |

 另外沿用 `REALIGNMENT_DEMOLITION_ORDER.md` §3 已确认的保留项（违禁词、转接、知识库审查/复盘、
 每日优化、legacy-import ↔ FastQA18 迁移、倒计时/发送失败分类/落地验证语义），本评估不重复推翻。

 ---

 ## 4. 需要 Owner 拍板的 6 个问题

 | # | 问题 | 我的建议 |
 |---|---|---|
 | Q1 | Electron 是 pin 到 **30.5.1**（真对齐，同时意味着放弃 `node:sqlite`），还是留在 43（行为对齐、运行时自由）？| **pin 30.5.1**。R1 与 S5 是同一决策的两面，留 43 就等于给 SQLite 续命 |
 | Q2 | SQLite → JSON store 是**一次性砸**（B7 直接重建），还是先并行两套再删？| **一次性砸**。并行会留两套真源，正好是 S4 那类分叉缺陷的成因；Owner 已明确接受功能倒退 |
 | Q3 | 是否授权一个专门批次做“概念层彻底清除”（S1+S2+S3+S6）？这是本次最大手术，会动 domain / ai-worker / contracts / migrations，并伴随测试重写 | **授权，且排在最前**（B6）。后面所有对齐都不该再背着这些 ghosts |
 | Q4 | IPC 中文通道名：现在按 REA 的 216 条候选重构（INFERRED，含噪声），还是等批次 2 的 `renderer/js/mock-api.js` 明文？| **等批次 2**。现在只做 CONFIRMED 的三条：暴露名改 `window.__API__`、通道表单一模块、`{成功, 错误}` 返回形态 |
 | Q5 | `parity-tests/`（258 个文件）金样大量基于被砸概念：留 / 砸 / 等 Phase 2？| **等 Phase 2 除名或重写**（= P2-8）。宪法 §5 要求目录保留且改动先登记 evidence-ledger，不宜在 B6 顺手砸 |
 | Q6 | 根目录文档卫生：`PERSONAL_PC_TEST_SUMMARY.md`、`REA_BATCH1_PROMPT.md`、`快羊开发建议书.md` 是否归档进 `project/`？| `REA_BATCH1_PROMPT.md` 与 `PERSONAL_PC_TEST_SUMMARY.md` 归档到 `project/history/pre-realignment-2026-10-12/`（前者已交付、后者描述的是旧 174-P0 时代）；建议书留根目录 |

 ---

 ## 5. 建议批次顺序（签核后执行）

 | 批次 | 内容 | 依赖 | 为什么这个顺序 |
 |---|---|---|---|
 | **B6** | 概念层彻底清除：S1 + S2 + S3 + S6 | 无（REA 批次 1 已足够）| 最大手术先做，之后每一批都不用再绕开 ghosts |
 | **B7** | 存储对齐：S5 + R1（JSON store + 原子写 + 滚动备份 + 损坏兜底 + Electron 30.5.1 pin）| REA 批次 2（JSON 字段级结构）；Q1/Q2 拍板 | 地基材料替换，动完才能谈上层 |
 | **B8** | 契约单源：S4 + R7（删 `resources/contracts`、修 builder/worker-runtime 路径）| B6（先清掉树里的死概念）| 顺手修掉“打包态读旧契约”的真实缺陷 |
 | **B9** | worker 生命周期：R3 + R4（常量、心跳、假死 kill、代际、Job Object、`token`）| 无 | 零外部依赖，可与 B6 并行或插队 |
 | 待批次 2 | R2（IPC 全量）、R5（Python 打包）、R6（多侧车）、P2-6（向量维度）| REA 批次 2 | 证据未到位前不猜 |

 ---

 ## 6. 本次评估的实测基线（B5 收尾时的仓库状态）

 - `pnpm run typecheck`：13 个项目全绿
 - `pnpm run build`：全绿（含 `PDD preload bundled`、renderer assets OK）
 - `pnpm -r run test`：**1062 pass / 0 fail**
   （apps/desktop 556、platform-pdd 119、orchestrator 92、persistence 88、domain 86、
   legacy-import 39、worker-rpc 33、product-optimization 17、background-jobs 13、
   desktop-ipc 9、feedback 9、test-kit 1）
 - `pnpm run test:contracts`：20 pass；`pnpm run test:python`：472 OK；`compileall`：通过
 - `pnpm run scan:secrets`：PASS（7 条 reviewed 精确匹配）；`pnpm run check:boundary`：PASS
 - `pnpm run verify:platform`：Electron 实跑 PASS（6 项断言全过，`external_network_calls = 0`）
 - 运行 `.ts` 测试需 Node 22（本机 `/opt/homebrew/opt/node@22`，v22.23.3），
   因为 persistence 依赖 `node:sqlite`；这一点本身就是 S5 的现场证据。
