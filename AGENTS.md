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
 3. `project/PROJECT_STATE.json` — 执行账本（当前批次与授权状态）
 4. REA 取证仓库 `~/Documents/ChatGPT/fastwork-rea-batch1/` — 对标证据基线
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

 1. 每批次结束：`pnpm run typecheck` 全绿 + Python `compileall` 通过，独立 commit
 2. 该机 Node v20 不支持 `--experimental-strip-types`；`.ts` 测试经 `--import tsx`
    运行（需先 `pnpm -r run build`），跑不了就如实标 DEFERRED，不得声称已运行
 3. 不得为跑测试擅自升级 Node
 4. 删除代码时同步删除其孤儿测试与根 `package.json` 中失效脚本

 ---

 ## 6. 环境与主机判定

 每次任务开始实际执行 `uname -s`、`pwd`、`node --version` 判定环境，
 不得沿用历史文档中的“当前环境”标签。
 本机为 macOS 开发环境（Darwin + `/Users/...`）时，可声称的最高验证为
 typecheck + `.mjs`/tsx 测试；完整 Windows 测试环境（`E:\fast_sheep`，Node 24）
 目前不在本线程范围内。
