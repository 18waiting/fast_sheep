 # FAST SHEEP 宪法（重对齐版 V2.0，2026-10-12）

 本文件是 fast_sheep 项目唯一的产品与工程宪法。
 旧宪法、47 条锁定决策（DECISIONS.md）、V1.x Roadmap/Task Template、
 AU-01~AU-04 交接文档等全部治理文件已失效，归档于
 `project/history/pre-realignment-2026-10-12/`，仅作历史参考，不再具有任何约束力。

 ---

 ## 1. 产品目标（唯一标尺）

 **FastWork（言店长）6.1008.4 是产品目标。** 本项目是对它的 clean-room 复刻。
 一切产品范围、行为语义、结构划分以 FastWork 实况为准，不以本项目历史文档为准。

 对标证据基线：
 - REA 批次 1 取证仓库：`~/Documents/ChatGPT/fastwork-rea-batch1/`（只读）
 - 证据分级沿用 REA 标准：CONFIRMED / INFERRED / NOT_FOUND；不得把 INFERRED 当 CONFIRMED 使用
 - 对 FastWork 行为的任何断言必须能落到证据文件；无证据的“我记得 FastWork 是这样”不成立

 ## 2. 对齐等级

 - **L1（行为）强制**：用户可观察行为与 FastWork 一致
 - **L2（结构）强制**：进程拓扑、存储形态、IPC/RPC 面、平台接入方式与 FastWork 同构
 - **L3（实现风格）自由**：语言内部写法、模块粒度、命名风格可自主

 ## 3. MVP 范围（Owner 拍板 2026-10-12）

 | 决策 | 内容 |
 |---|---|
 | 平台 | 只做拼多多，打通后再扩展 |
 | 授权/计费/试用 | 整条线跳过 |
 | 额外业务线 | BOSS 获客、CSDN 发文、远程控制、桌面 UI 自动化不做 |
 | 商业目标 | 自用优先；长期稳定后再考虑商用 |

 ## 4. 执行原则

 1. 清理第一，对标第一。接受功能倒退与删除，不计代价。
 2. 分批对齐，不追求一次到位。批次定义见 `project/REALIGNMENT_DEMOLITION_ORDER.md`。
 3. 每批次结束时仓库必须 `pnpm run typecheck` 全绿，独立 commit。
 4. FastWork 中 NOT_FOUND 的自研概念（IdentityLock / ContextEnvelope / ReplyPlan /
    pre-send guard / SHADOW-HUMAN_CONFIRM-AUTO 三档灰度）不得复活、不得新建同义变体。
    运行档位语义以 FastWork 的「协同 / 全托管 / 不入协同」为准。
 5. 需要 FastWork 更多信息时，走 REA 取证批次（提示词放仓库根，证据进证据仓库），
    不得凭想象补齐。

 ## 5. parity-tests 规则（单条款）

 `parity-tests/` 夹具与清单默认只读；因对标证据变化而必须修改时，
 需在 `parity-tests/evidence-ledger.md` 追加一条记录（引用 REA 证据文件与结论），
 然后方可修改。

 ## 6. 环境

 - 开发机：macOS，项目路径 `/Users/wb02605050/Documents/ChatGPT/fast_sheep`
 - Node：默认 v20；`.ts` 测试经 `--import tsx` 运行
 - 开发阶段最高验证标准：`pnpm run typecheck` + Python `compileall`
 - 真实平台操作（登录拼多多、收发消息）需要 Owner 逐次明确授权，默认禁止

 ## 7. 现行文件清单

 | 文件 | 职责 |
 |---|---|
 | `project/FAST_SHEEP_MASTER_PROMPT.md`（本文件） | 宪法 |
 | `project/REALIGNMENT_DEMOLITION_ORDER.md` | 批次、范围、验收标准、Phase 2 延迟项 |
 | `project/PROJECT_STATE.json` | 执行账本（当前批次、授权状态） |
 | `~/Documents/ChatGPT/fastwork-rea-batch1/` | 对标证据（只读） |
