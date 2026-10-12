 # AGENTS.md — Fast Sheep Project Navigation（重对齐版，2026-10-12）

 项目根：`/Users/wb02605050/Documents/ChatGPT/fast_sheep`（macOS 开发机）
 产品：快羊客服 / fast_sheep —— FastWork（言店长）6.1008.4 的 clean-room 复刻

 **2026-10-12 起项目进入重对齐清理阶段：FastWork 是唯一产品标尺，
 旧宪法、47 条锁定决策、V1.x Roadmap/Template、AU 交接文档全部失效，
 已归档至 `project/history/pre-realignment-2026-10-12/`（只读历史，不具约束力）。**

 ---

 ## 1. Required Read Order

 任何任务开始前按序阅读：

 1. `project/FAST_SHEEP_MASTER_PROMPT.md` — 现行宪法（V2.0 重对齐版）
 2. `project/REALIGNMENT_DEMOLITION_ORDER.md` — 批次、范围决策、验收标准、Phase 2 延迟项
 3. `project/FOUNDATION_ALIGNMENT_ASSESSMENT.md` — B5 之后的地基对齐评估
    （砸 6 / 改 7 / 留 7 + 待 Owner 拍板问题 + 建议批次 B6–B9）
 4. `project/PROJECT_STATE.json` — 执行账本（当前批次与授权状态）
 5. REA 取证仓库 `~/Documents/ChatGPT/fastwork-rea-batch1/` — 对标证据基线
    （先读 `_INDEX.md` 与 `_EVIDENCE_LOG.md`，再按需读分册）

 架构类旧文档（`docs/architecture/*`）在 Phase 2 重写前仅作背景参考；
 与 REA 证据冲突处一律以 REA 证据为准。

 ---

 ## 2. 对标纪律（取代旧 Product Alignment Guard）

 实质性实现前必须能回答：

 ```text
 FASTWORK_EVIDENCE:      # 对应 REA 证据文件与结论；没有证据就写 NONE 并说明
 ALIGNMENT_LEVEL:        # L1 行为 / L2 结构 / L3 风格
 MVP_RELEVANCE:          # 与“拼多多单平台自用 MVP”的关系
 DECISION:               # PROCEED / NEED_REA_EVIDENCE / OUT_OF_SCOPE
 ```

 - FastWork 中 NOT_FOUND 的自研概念（IdentityLock / ContextEnvelope / ReplyPlan /
   pre-send guard / SHADOW-HUMAN_CONFIRM-AUTO）不得复活或新建同义变体。
 - 无证据支撑的 FastWork 行为断言不得写入代码或文档；需要信息就排 REA 批次。
 - `DECISION: NEED_REA_EVIDENCE` 时记录到 Phase 2 延迟项，不要猜着实现。

 ---

 ## 3. 范围红线（Owner 拍板 2026-10-12）

 - 平台只做拼多多；其他平台适配已删除，未经 Owner 决定不得重建
 - 授权/计费/试用/会员/积分整条线跳过
 - BOSS 获客、CSDN 发文、远程控制、桌面 UI 自动化不做
 - 真实平台操作（登录、收发真实消息）默认禁止，需 Owner 逐次授权

 ---

 ## 4. Write Boundary

 所有项目写入限于仓库根 `/Users/wb02605050/Documents/ChatGPT/fast_sheep`。
 临时文件放 `.tmp/`。以下只读：

 - `~/Documents/ChatGPT/fastwork-rea-batch1/`（REA 证据）
 - `project/history/`（归档治理）
 - `reports/`（历史任务报告）
 - `parity-tests/` 夹具与清单（修改须先在 `parity-tests/evidence-ledger.md`
   登记证据条目，见宪法第 5 条）

 不得采集或写入任何真实店铺凭据、cookie、token、客户数据。

 ---

 ## 5. 验证标准（macOS 开发机）

 B5 之后根 `package.json` 只有 11 条命令，**不存在其它入口**；不要新增一次性脚本：

 | 命令 | 作用 |
 |---|---|
 | `pnpm run verify` | 唯一诚实闸门，串起下面全部（typecheck → build → test → contracts → python → compileall → secrets → boundary → platform）|
 | `pnpm run typecheck` | 13 个项目 `tsc --noEmit` |
 | `pnpm run build` | 全包构建 + renderer 资源 + PDD preload 打包 |
 | `pnpm run test` | `pnpm -r run test`，各包 `node --import tsx --test "tests/*.test.ts"`（`.mjs` 包除外）|
 | `pnpm run test:contracts` | 根 `tests/contracts/contract-schemas.test.mjs` |
 | `pnpm run test:python` | `services/ai-worker/tests`（解释器经 `scripts/run-python.mjs` 解析）|
 | `pnpm run compileall` | Python 字节码编译检查 |
 | `pnpm run scan:secrets` | 密钥护栏（reviewed 台账 = `scripts/reviewed-secret-scan-findings.json`）|
 | `pnpm run check:boundary` | clean-room 边界护栏 |
 | `pnpm run verify:platform` | Electron 实跑多店视图隔离验证 |
 | `pnpm run start` | 启动桌面端 |

 1. 每批次结束：`pnpm run verify` 全绿（最低限度 typecheck + compileall），独立 commit
 2. 该机默认 Node v20 不支持 `--experimental-strip-types`；`.ts` 测试一律经 `--import tsx` 运行
 3. `packages/persistence` 依赖 `node:sqlite`（需 Node ≥ 22.5），本机用
    `/opt/homebrew/opt/node@22/bin` 前置到 PATH 后运行；**不得为跑测试升级系统 Node**，
    也**不得声称未运行的测试已运行**（跑不了就如实标 DEFERRED）
 4. 删除代码时同步删除其孤儿测试；护栏脚本报红时先判断是真实命中还是范围误报，
    **只能收窄扫描范围或登记 reviewed 台账，不得放宽检测规则本身**

 ---

 ## 6. 环境与主机判定

 每次任务开始实际执行 `uname -s`、`pwd`、`node --version` 判定环境，
 不得沿用历史文档中的“当前环境”标签。
 本机为 macOS 开发环境（Darwin + `/Users/...`）时，可声称的最高验证为
 typecheck + `.mjs`/tsx 测试；完整 Windows 测试环境（`E:\fast_sheep`，Node 24）
 目前不在本线程范围内。
