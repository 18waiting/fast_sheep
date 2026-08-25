# Renderer JS Dependency Classification（SHEEP-023）

> 项目：Fast Sheep / 快羊客服 · Phase 2 / M2.1（Track A archaeology）· 日期：2026-08-25
> 参考树：`E:\ai客服数据\FastWork_asar_extracted\dist\renderer\`（READ ONLY；未 eval/未复制/未修改/未联网）

## 0. 方法

- 只读文本扫描（不 eval）：bridge/IPC 标记（`店铺API`/主进程/postMessage 等）、backend 调用标记、
  runtime-network 调用标记（fetch/XHR/WebSocket/navigation）、URL 字面量、auth 标记、DOM/UI 标记。
- **多标签分类**（一个文件可多类）；**分层 claim**；**敏感值零回显**。
- **UI_ONLY 需积极证据**（DOM/UI 标记存在且无任何依赖标记）—— 仅缺依赖证据不构成 CONFIRMED。

## 1. File-level summary（多标签 + 证据）

| 文件 | UI_ONLY | UI_WITH_BRIDGE | BACKEND_DEPENDENT | NETWORK_DEPENDENT | AUTH_OR_SELLER_DEPENDENT | 证据要点 |
|---|---|---|---|---|---|---|
| account.js | 否（有 bridge/auth） | **CONFIRMED**（`店铺API`×20，bridge 44） | **CONFIRMED**（bridge/主进程数据） | URL 引用 CONFIRMED（×1）；renderer 内 runtime 调用=无 | **CONFIRMED**（login/password） | L7+ bridge；L275 URL；auth 标记 |
| ai.js | 否 | **CONFIRMED**（`店铺API`×22，bridge 58） | **CONFIRMED**（管家API/子进程/桥） | URL 引用 CONFIRMED（×4）；renderer 内 runtime 调用=无（网络在 Main/Worker，INFERRED） | **CONFIRMED**（token/session/cookie/login×14） | L42+ bridge；L229-243 URL |
| knowledge.js | 否 | **CONFIRMED**（`店铺API`×19，bridge 31） | **CONFIRMED**（从主进程获取×4） | 无 URL / 无 runtime 调用 | 无 | L9+ bridge/backend |
| navbar.js | 否 | **CONFIRMED**（`店铺API`×19，bridge 32） | **CONFIRMED**（从主进程获取导航项/监听推送） | 无 | 无 | L7+ bridge/backend |
| sidebar.js | 否 | **CONFIRMED**（`店铺API`×57，bridge 153） | **CONFIRMED**（从主进程获取店铺列表×34） | 无 renderer runtime 调用（店铺增删经 bridge） | **CONFIRMED**（login/api_key/token×6） | L7+ bridge/backend；auth 标记 |

- **UI_ONLY = 无**（无文件满足"积极 UI 证据 + 零依赖标记"；所有 bundle 均含 bridge 依赖）。
- **direct bridge/API portability = NOT_ESTABLISHED**（全部）：`店铺API` 为旧 reference 桥接契约；
  后续 restoration 必须使用 **Fast Sheep 自身安全/typed bridge 架构**（Master §5.2/§7）。

## 2. NETWORK_DEPENDENT 分层 claim

- **URL literal 存在 = CONFIRMED（URL reference）**：account.js L275（1 处）、ai.js L229-243（4 处，平台登录/IM 门户）。
- **renderer 内 runtime network 调用（fetch/XHR/WebSocket/location/window.open）= 0 处（全部 bundle）** → 未确认 renderer 直接执行网络行为。
- **网络行为归属**：设计注释表明聊天/流式/模型经 `子进程`/`管家API` 走 Main/Worker（INFERRED）—— 恢复时应由 Fast Sheep Main/AI Worker 承担网络，renderer 不直接联网。

## 3. Feature/region-level 记录（尽可能，不做 eval/反编译）

| Region | 来源 | UI 可参考 | 不可直接 port |
|---|---|---|---|
| 导航壳（navbar） | navbar.js L4-13 | 导航项渲染/高亮/用户信息展示布局 | bridge 数据获取（店铺API/主进程） |
| 店铺侧栏 + 添加店铺对话框 | sidebar.js L4-13 | 卡片/模态框布局 | 店铺增删经 `店铺API`（backend/platform） |
| 账号页（登录/账号信息/到期闸门） | account.js L4-9 | 账号信息展示布局 | 登录/凭据/到期闸门（auth，Master §11/§18） |
| 管家页（功能列表/聊天区/欢迎页） | ai.js L5-16 | 左栏/右栏/欢迎页布局 | 发消息/流式/模型（backend/network） |
| 知识库页（列表/问答/搜索/编辑器） | knowledge.js L5-16 | 列表/编辑器/搜索布局 | 知识数据经 bridge（Fast Sheep Phase 9 重实现） |

## 4. 结论

- 5 个 bundle 均为 **UI_WITH_BRIDGE + BACKEND_DEPENDENT**（多标签）；ai/account/sidebar 另含
  **AUTH_OR_SELLER_DEPENDENT**；ai 含 **NETWORK URL 引用**（renderer 不直接联网）。
- **UI_ONLY = 无**；**direct bridge/API portability = NOT_ESTABLISHED**。
- 恢复时：UI 结构可作 reference；bridge/backend/auth/network 实现**一律不直接 port**，
  按 Fast Sheep 自有安全/typed bridge + Main/Worker 架构重实现。