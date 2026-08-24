# Renderer Asset Inventory（SHEEP-021）

> 项目：Fast Sheep / 快羊客服 · Phase 2 / M2.1（Track A FastWork reference restoration）· 日期：2026-08-25
> 参考树：`E:\ai客服数据\FastWork_asar_extracted\dist\renderer\`（READ_ONLY_OWNER_AUTHORIZED_UI_REFERENCE）

## 1. 清点结果

| 文件 | 行数 | 大小(B) | 网络引用 | 敏感标记 | 分类（多标签） |
|---|---|---|---|---|---|
| account.js | 1123 | 61123 | 1 (unknown: 外部 wiki/doc 链接) | login×2, password×2 | UI, AUTH_OR_SELLER_DEPENDENT |
| ai.js | 2403 | 118061 | 4 (auth: taobao/pdd/jinritemai login；runtime: jinritemai im) | token×1, login×4, session×6, cookie×1 | UI, AUTH_OR_SELLER_DEPENDENT, NETWORK_DEPENDENT |
| knowledge.js | 1607 | 83515 | 0 | 0 | UI_ONLY |
| navbar.js | 327 | 16026 | 0 | 0 | UI_ONLY |
| sidebar.js | 3718 | 217714 | 0 | login×1, api_key×3, token×1 | UI, AUTH_OR_SELLER_DEPENDENT |

- 总：5 个打包 JS / 484.8 KB；**无 HTML/CSS/字体/图标/图片资产**。
- **Sensitive values = NEVER COPY / NEVER REPORT VERBATIM**：本清点只记录 文件+行+关键字（类别/风险），
  未复制、未引用、未写入任何 token/cookie/session/credential/key 的具体值。

## 2. 网络引用分类

- `auth_network_dependency`：ai.js 中平台登录门户引用（taobao login / pinduoduo mms / jinritemai login）—— 登录入口类。
- `runtime_network_dependency`：ai.js 中 jinritemai im（平台 IM）。
- `unknown_reference`：account.js 中外部 wiki/doc 链接（用途待后续确认）。
- **未请求网络、未执行任何 endpoint、未验证在线服务**（本任务只 inventory）。

## 3. 资产来源 / license

- 当前 scope **未发现 font/icon/image 资产**，故无对应 license evidence。
- 若未来在授权 scope 内发现且 license UNKNOWN：记录 `UNKNOWN / NOT_EVIDENCED_IN_CURRENT_SCOPE`，
  **不得升级为"确认无许可证/非法"**；**不进入 commercial redistributable asset set**；
  UNKNOWN **不禁视觉参考**（Owner-authorized renderer 可作 UI reference）。

## 4. AUTH_OR_SELLER_DEPENDENT 语义

- 表示 reference 实现**不得直接 port**；**不表示 Fast Sheep 永远不能拥有对应产品功能**。
- 未来如需登录/平台连接/session UI：必须基于 **Fast Sheep 自身安全架构重新实现**。

## 5. 边界（保持）

- reference tree 只读；未复制任何 asset/code；未执行网络；未读 nixiang/其它未授权目录；
  Fast Sheep 仅新增本清点报告/文档；未开始 UI implementation。