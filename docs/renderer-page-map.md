# Renderer Page / Feature Map（SHEEP-022）

> 项目：Fast Sheep / 快羊客服 · Phase 2 / M2.1（Track A archaeology）· 日期：2026-08-25
> 参考树：`E:\ai客服数据\FastWork_asar_extracted\dist\renderer\`（READ ONLY；未复制/未修改/未 eval）

## 0. 方法与证据等级

- 只读文本提取（路由/中文标题/组件注释）；**未执行/eval bundle**。
- 每区域两维分别记录：**reference_role**（考古事实分类）与 **restoration_disposition**（施工处置），
  不得用施工优先级替代考古事实。
- 证据等级绑定**具体 claim**：
  - **CONFIRMED** = 该具体事实在 bundle 中直接可见（如某行标题字符串存在）；
    不自动确认完整页面/可达性/交互流程/启用状态。
  - **INFERRED** = 从结构/命名/上下文推断。
  - **UNKNOWN** = 无法可靠归类。
- **CONFIRMED 的具体事实**在每条中写明。

## 1. 总览

- **0 条路由**（CONFIRMED：本参考树为 IPC 桥接面板脚本，非路由 SPA）。
- 5 个 bundle 对应：2 个 shell（navbar/sidebar）+ 3 个页面（account/ai/knowledge）。

## 2. Map（reference_role × restoration_disposition，按文件/区域）

### navbar.js — 导航壳
- reference_role：**shell**（导航条）
- restoration_disposition：**SHELL**（治理：Roadmap M2.2 Global Shell Restoration，CONFIRMED）
- CONFIRMED 事实：L4 标题 `左侧栏导航条交互逻辑`；职责=导航项渲染/点击切换/右上角用户信息
  （用户名/对话数/积分/到期时间）—— 仅确认这些 UI reference 存在；数据来源（主进程/店铺API）未验证。
- 备注：用户信息展示为 UI 结构 reference；数据绑定后续按 Fast Sheep 架构重做。

### sidebar.js — 店铺侧栏壳
- reference_role：**shell**（店铺列表侧栏）+ **dialog**（添加店铺模态框）
- restoration_disposition：**SHELL**（治理：M2.2，CONFIRMED）；**添加/删除店铺操作 = DO_NOT_PORT_DIRECTLY（feature 粒度）**
- CONFIRMED 事实：L4 标题 `左侧栏交互逻辑`；职责=店铺卡片渲染/切换/添加模态框/删除；
  店铺数据经 `店铺API` 与主进程通信（L13）。
- 说明：UI 结构（卡片/模态框布局）可作 reference；店铺增删操作依赖后端/平台 → 不直接 port
  （Master 架构：平台接入按 Fast Sheep 自有架构重实现）。

### account.js — 账号页
- reference_role：**page**（账号/登录页）
- restoration_disposition：
  - **登录/凭据/到期闸门 feature = DO_NOT_PORT_DIRECTLY**（CONFIRMED：SHEEP-021 AUTH 标记
    login/password；L8 `手机号/密码 登录表单`、L9 `到期锁定态/锁定/充值入口`；Master §11/§18
    凭据不 port）
  - **账号信息展示 UI = LATER**（INFERRED：bundle 表明账号信息展示，但不在 Roadmap M2.3 首波；
    属考古推断，非产品决定）
- CONFIRMED 事实：L4 标题 `账号信息页交互逻辑`；三态合一（未登录/已登录/到期锁定）语义存在。
- **不升格整页 DO_NOT_PORT**：普通账号信息 UI 结构仍可作 reference（收紧 #2）。

### ai.js — 管家（AI 助手）页
- reference_role：**page**（AI 助手/聊天）+ **panel**（左栏功能列表、右栏聊天区、欢迎页/预设问题卡片）
- restoration_disposition：
  - **UI 结构 = FIRST_WAVE**（治理：Roadmap M2.3 AI Panel Reference Layout，CONFIRMED）
  - **发消息/流式/管家API feature = DO_NOT_PORT_DIRECTLY**（CONFIRMED：SHEEP-021 NETWORK 标记；
    L10 `聊天已接通真实大模型/流式生成/子进程`、L11 `管家API/发消息/流式/逐字渲染` —— 后端/网络依赖）
- CONFIRMED 事实：L5 标题 `管家页面交互逻辑`；L9 左栏功能列表/右栏聊天区；L16 欢迎页+预设问题卡片。
- 说明：聊天/流式/模型调用不得直接 port（Fast Sheep 走自有 AI Worker/Gateway）；UI 布局可 reference。

### knowledge.js — 知识库页
- reference_role：**page**（知识库）
- restoration_disposition：**LATER**（治理：Roadmap 将 Knowledge UI 置于 Phase 3 SHEEP-053 / Phase 9，
  CONFIRMED later；本文件不在 M2.3 首波）
- CONFIRMED 事实：L5 标题 `知识库页面交互逻辑`；职责=左栏知识库列表/新建/重命名/删除、
  问答添加编辑、关键词搜索（已勾选范围内/四色编码）、导入导出、富文本答案编辑器（拖拽/粘贴图片/放大）。
- 备注：本 bundle 无 auth/network 标记（SHEEP-021：0），UI 结构可作 reference；知识处理按 Fast Sheep
  架构（Phase 9）实现。

### 未发现 / UNKNOWN
- 会话工作台（conversation）、平台浏览器面板（PDD/DouDian）、设置页：**当前 5 个 bundle 中未出现**
  （UNKNOWN 于本 scope；可能在其它 bundle/后续 scope）。
- 无字体/图标/图片资产（SHEEP-021 CONFIRMED）。