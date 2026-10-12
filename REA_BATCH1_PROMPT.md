# REA 取证任务 · 第一批（静态结构快照）

> 收件方：rea（逆向 agent，已大致掌握 FastWork 内容）
> 发件方：fast_sheep 开发 agent
> 批次：Batch 1 / 2。本批**只要静态结构**，不做行为深挖（那是第二批）。
> 优先级：B 与 C 最高，其次 D/E，最后 A/F/G/H/I。

---

## 0. 背景（为什么问这些）

我在维护 `fast_sheep`，是 FastWork 的 clean-room 复刻。当前目标已确定为
**对齐 FastWork 的 L1（行为）+ L2（结构），L3（实现风格）自由**。

我手上有一份 2026-08-15 冻结的行为规格：53 条 behavior、222 个 golden fixture，
覆盖 13 个域（CONV / RAG / PROMPT / TOOL / HANDOFF / STORE / FEEDBACK / JOB /
PLATFORM / IPC / SEC / ORCH / PROV）。但是：

1. 它的原始出处文档（spec 树 + ADR）已经丢失，只剩投影下来的 fixture。
2. 它对标的 FastWork 版本已经过时，你现在看到的是更新过的版本。

所以我需要一份**当前版本的结构快照**，用来重刻标尺、并判定我自己代码里哪些部分
是偏离。本批不要求你验证那 53 条行为，只要结构。

### 三个我最急需答案的具体决策

- **B3/B4**：FastWork 的 AI worker 是什么语言写的。我要据此决定自己那套
  Python worker（10.7k 行，PyInstaller 打包）是保留还是迁移。
- **C1**：完整 SQLite schema。我要拿它跟自己 9 个 migration 逐个对表，
  我怀疑自己有一半的表是自行发明的。
- **D/E**：IPC 通道表 + worker RPC 方法表。这是 L2 边界对齐的主战场。

---

## 1. 输出格式要求（很重要，不符合我会退回）

1. **只要结构化产物**：SQL DDL、JSON、YAML、Markdown 表格。
   **不要贴大段反混淆/反编译代码。** 单条引用不超过 15 行，且必须是为了支撑某个结论。
2. **每条结论必须标注证据等级**：
   - `CONFIRMED` — 读到明确证据（给出文件路径 + 行号/偏移，或"binary strings 命中"）
   - `INFERRED` — 由间接证据推断（说明推断链）
   - `NOT_FOUND` — 找过但没有（说明你找了哪些位置、用了什么方法）

   **禁止把 INFERRED 写成 CONFIRMED。** 我不确定的信息我可以自己判断，
   被污染的信息我判断不了。
3. **不要猜测版本号、不要编造字段名。** 字段名必须逐字来自证据。
4. 遇到混淆：优先从**未被混淆的地方**取结构，例如 SQLite DDL、i18n 字符串表、
   IPC channel 字面量、JSON 配置、错误码常量、日志格式串。这些通常完好。

### 交付物形态

一个目录，每节一个文件：

```text
_INDEX.md          交付清单 + 每节完成度 + 整体置信度
_EVIDENCE_LOG.md   结论 → 证据定位 的对照表（可折叠成表格）
A-identity.md
B-topology.md
C-schema.sql       纯 DDL，可直接执行
C-storage.md       非 SQLite 的本地存储与凭据
D-ipc.md
E-rpc.md
F-modules.md
G-platforms.md
H-deps.md
I-delta.md
BLINDSPOTS.md      见第 3 节，单独成文
```

**必须交付：A、B、C、D、E。** F/G/H/I 尽力而为，做不完就在 `_INDEX.md` 里标 `NOT_DONE`。

---

## 2. 取证清单

### A. 身份与构建

- A1 产品名、版本字符串、构建时间/内嵌 commit（如有）
- A2 应用根 `package.json` 全文：`name` `version` `main` `scripts` `dependencies`
  `devDependencies`（含精确版本号）`engines` `packageManager`
- A3 Electron 版本、内置 Node 版本、Chromium 版本
- A4 安装目录顶层树（带文件大小），标出：asar 文件、unpacked 目录、sidecar 可执行文件
- A5 asar 清单：每个 asar 的路径、大小、属于 main 还是 renderer
- A6 代码签名状态：是否签名、签名主体、时间戳
- A7 自动更新机制：electron-updater / Squirrel / 自研？更新源 URL（如可见）

### B. 进程拓扑 ← 最高优先级

- B1 运行时实际存在的所有进程：main、renderer（几个）、GPU、utility，
  以及**它自己 spawn 的所有子进程**
- B2 每个被 spawn 的子进程：可执行文件路径、spawn 方式
  （`child_process.spawn` / `fork` / `exec` / `utilityProcess` / `Worker` thread）、
  启动参数、注入的环境变量、stdio 配置（pipe / ipc / websocket / named pipe）
- B3 **是否存在 AI worker sidecar？它是什么语言/运行时？**
  给出判定依据，例如：
  - `.exe` + `_internal/` + `*.pyd` → PyInstaller 打包的 Python
  - `node_modules` / `.node` 原生模块 / 打包 JS → Node
  - `.dll` + 托管运行时 → .NET
- B4 若为 Python：Python 版本；`_internal` 或 `site-packages` 下的顶层包清单；
  **特别确认是否有 faiss / numpy / torch / sentence-transformers / onnxruntime**
- B5 若为 Node：是独立打包 JS、Electron `utilityProcess`、还是 `worker_thread`
- B6 main ↔ worker 的通信传输：stdio JSON-RPC / WebSocket / localhost HTTP / named pipe？
  **消息分帧格式**（换行分隔？LSP 式 `Content-Length`？长度前缀？）
- B7 worker 生命周期：何时启动（应用启动即拉起 / 首次会话懒加载）、
  健康检查方式、崩溃重启策略、退出清理
- B8 是否还有其他 sidecar：浏览器驱动、OCR、本地 embedding 服务、向量库进程

### C. 数据模型 ← 最高优先级

- C1 **所有 SQLite 数据库文件的完整 schema DDL**：
  每个库的磁盘路径，以及逐字导出的全部 `CREATE TABLE` / `CREATE INDEX` /
  `CREATE TRIGGER` / `CREATE VIEW`。这是本次交付里价值最高的一项。
- C2 一共几个 db 文件，各自职责（主库 / 分店库 / 缓存 / worker 私有）
- C3 每个库由哪个进程读写；是否开 WAL；有无跨进程访问的证据
- C4 迁移机制：有没有 migrations 表、schema version 列、或迁移脚本文件？按顺序列出
- C5 `PRAGMA user_version` 的值
- C6 非 SQLite 本地存储：renderer 用到的 localStorage 键名全表、IndexedDB store、
  磁盘上的 JSON/YAML 配置文件（路径 + 完整结构）
- C7 **凭据与密钥存储**：店铺 cookie / token / 模型 API key 存在哪里？
  系统钥匙串（keytar / Electron `safeStorage`）/ DPAPI / 加密文件 / 明文？
  加密方式与密钥来源（只说机制，**不要输出任何真实密钥值**）
- C8 向量索引存储：如果有 RAG，embedding 落在哪里？faiss index 文件 /
  SQLite blob / 独立目录？向量维度是多少？
- C9 能反映领域模型的文件命名约定（如 `shops.db`、`knowledge/`、`audit/`）

### D. Main ↔ Renderer 边界（IPC）

- D1 所有 `ipcMain.handle(channel, ...)`：channel 名全表，每个的**请求体结构**与
  **响应体结构**（字段名 + 类型，从 handler 实现反推）
- D2 所有 `ipcMain.on(channel, ...)`（单向）：同上
- D3 所有 `webContents.send(channel, ...)`：main → renderer 的事件名 + payload 结构
- D4 preload 脚本：通过 `contextBridge.exposeInMainWorld` 暴露的**完整 API 面**，
  含方法名与签名。这是 renderer 实际能看到的全部能力。
- D5 各 window/webContents 的 `contextIsolation` / `nodeIntegration` / `sandbox` 设置
- D6 窗口与 WebContentsView 拓扑：几个窗口；平台页面是否用 WebContentsView /
  BrowserView 承载；session partition 命名
- D7 channel 命名约定（是否有命名空间模式，如 `shop:list`、`conversation:send`）

### E. Worker RPC 面（若 B3 确认存在 worker）

- E1 完整方法名清单
- E2 每个方法的 params schema 与 result schema
- E3 错误模型：错误码枚举、错误体结构
- E4 通知/事件类方法（server → client 推送）
- E5 方法分组或命名空间（是否按域分组，如 `conversation.*`、`rag.*`、`handoff.*`）
- E6 取消支持、超时处理、并发上限
- E7 协议版本字段 / 握手报文结构

### F. 模块地图

- F1 main bundle 解包后的目录树（带文件大小），让我能看出模块边界
- F2 renderer 同上
- F3 若为打包/压缩产物：提取 chunk 名、导出符号名、残留的 class/function 名。
  Webpack/Vite 的 chunk 名常常保留了路由与组件名。
- F4 renderer 组件与路由清单：顶层视图有哪些；状态管理方案
  （Redux / Zustand / Pinia / MobX / 自研 store）
- F5 **i18n 字符串表**：完整 key 清单 + 中文值。这一项对重建功能词汇极其有用，
  请尽量全量导出。
- F6 代码或配置里的 feature flag / 开关项

### G. 平台适配面

- G1 当前版本支持哪些电商平台？逐个列出（拼多多 / 千牛淘宝 / 京东 / 抖店 / 快手 / 闲鱼 / 其他）
- G2 每个平台是完整实现还是骨架？依据：文件数、代码量、是否存在真实 selector
- G3 拼多多具体如何接入：WebContentsView / 外部浏览器 / CDP？加载哪些 URL？
  用哪个 session partition？
- G4 入站消息获取机制：WebSocket 拦截 / HTTP body 嗅探 / DOM mutation 监听 / 轮询？
  给出证据
- G5 出站发送机制：DOM 输入框 + 点击 / 剪贴板粘贴 / 直接调 API？
- G6 硬编码的 selector 清单或 selector profile，能提取就全量导出
- G7 各平台的能力声明（capability 表）

### H. 依赖与第三方

- H1 生产依赖全表（`package.json` + `node_modules` 清点），含版本
- H2 特别确认：打包了哪些 LLM SDK / provider（openai / dashscope / anthropic /
  ollama / 其他）、向量库、OCR 库
- H3 Python 侧（若有）：从打包的 site-packages 还原一份 pip freeze
- H4 有无内置模型权重文件（onnx / gguf / safetensors），列出大小

### I. 版本增量

- I1 有无内嵌或可获取的 changelog / release notes / 版本历史
- I2 代码注释或字符串里能看出的近期新增功能
- I3 **重点**：当前版本里有没有任何形似下列概念的东西 ——
  身份锁（IdentityLock）、上下文信封（ContextEnvelope）、回复计划（ReplyPlan）、
  影子/人工确认/全自动三档灰度（SHADOW / HUMAN_CONFIRM / AUTO）、
  发送前身份守卫（pre-send guard）。

  问这个的原因：我在 2026-09 之后自行发明过一整套这样的架构，现在准备拆掉。
  如果 FastWork 恰好也走了这个方向，我需要知道，那会影响拆除的范围。
  有就有、没有就明确说没有，不要为了迎合而附会。

---

## 3. 盲区侦测（单独成文 `BLINDSPOTS.md`）

这一节的价值不低于前面所有条目。

我现有的规格只覆盖这 13 个域：
`CONV`（会话流水线）、`RAG`（检索）、`PROMPT`（提示词）、`TOOL`（工具调用）、
`HANDOFF`（转人工）、`STORE`（店铺/知识）、`FEEDBACK`（反馈）、`JOB`（后台任务/审计）、
`PLATFORM`（平台适配）、`IPC`（进程通信）、`SEC`（安全）、`ORCH`（编排）、
`PROV`（模型 provider）。

请你**反过来做**：列出你在 FastWork 当前版本里看到的、
**不落在上述任何一个域里的能力**，逐项写成：

```text
能力名称：
它做什么：
证据定位：
我为什么可能忽略它：
```

典型容易漏的方向（供你排查，不是答案）：数据导入导出、报表与统计、
权限与多账号、消息模板与话术库、快捷短语、质检与绩效、
客户标签与分组、优惠券/营销、多语言、离线缓存与同步、
插件机制、自动化规则引擎、通知渠道、操作日志回放、
 licensing / 授权校验 / 试用限制。

**宁可多报也不要漏报。** 我会自己筛。

---

## 4. 硬性约束

1. **只读。** 不得修改、重命名、删除 FastWork 安装目录里的任何东西，
   不得写入其数据目录。所有产物写到你自己指定的输出目录。
2. **不得提取或输出以下内容**：真实客户数据、店铺凭据、cookie、token、
   API key、真实会话内容、卖家账号信息、任何个人隐私数据。
   描述**机制**可以，输出**真实值**不行。若示例不可避免，用占位符替换。
3. 无法确认的就写 `NOT_FOUND` 并说明查找过程。**不要用合理推测填空。**
4. 如果某节因技术障碍（加壳、强混淆、V8 字节码缓存等）无法完成，
   在 `_INDEX.md` 里写明障碍类型和你尝试过的方法，我需要知道边界在哪。

---

## 5. 第二批预告（本批不用做）

拿到本批结果后，第二批会问行为层：对着我那 53 条 behavior 逐条验证当前版本的
实际行为、外部协议细节（PDD 的 WS 帧格式与 DOM selector）、
以及一个真实场景的运行时轨迹（网络帧 + DB 前后快照 + UI 状态序列）。

所以本批请顺手记录：**哪些信息只能靠动态运行才能拿到**，
以及你有没有能力把 FastWork 实际跑起来做观测。这决定第二批怎么设计。
