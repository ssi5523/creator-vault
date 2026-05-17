# DeFiVault · DeFi 场景自托管网页钱包

基于 [imToken TokenCore](https://github.com/consenlabs/token-core-monorepo)（`@consenlabs/tcx-wasm`）的 **DeFi 场景自托管钱包**：链上交互安全、场景化资产管理。私钥与助记词全程不离开设备，所有 DeFi 操作由 WASM 本地签名。

## 核心能力

| 模块 | 说明 |
|------|------|
| **本地安全签名** | `create_keystore` / `derive_accounts` / `sign_tx` — 授权、兑换、质押、投票均在浏览器内完成 |
| **多链 DeFi** | ETH、BSC、Base、Arbitrum + Sepolia 测试网 |
| **DEX 兑换** | ParaSwap 聚合报价 + TokenCore 签名（Uniswap 类路由） |
| **代币授权** | ERC20 `approve`，支持额度限制，拒绝无限授权提示 |
| **质押 / LP** | 向已知质押合约发起 `deposit`（演示场景） |
| **链上投票** | Governor `castVote`（演示场景） |
| **场景化风险** | 授权 / 兑换 / 质押 / 桥 / 投票 — 合约评级、资金流向、二次确认 |
| **收益可视化** | 跨链原生余额 + 本地质押记录，APR 参考与收益估算 |
| **交互历史** | `localStorage` 存储，可导出 JSON（含 txHash、rawTx） |

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 **http://localhost:5173**（勿用 `file://` 打开 HTML）。

## 生产构建

```bash
npm run build
npm run preview
```

## 部署到 Vercel

1. 推送仓库到 GitHub  
2. [Vercel](https://vercel.com) 导入项目：`npm run build`，输出 `dist`  
3. 根目录 `vercel.json` 已配置 SPA 回退与 ParaSwap API 代理  

```bash
vercel --prod
```

## TokenCore 集成说明

参考 [token-core-monorepo](https://github.com/consenlabs/token-core-monorepo) 与 npm 包 `@consenlabs/tcx-wasm`：

- `src/lib/tcxWasm.ts` — WASM 初始化  
- `src/lib/tokenCore.ts` — 钱包与 `signContractTx` 封装  
- EVM 链统一 `chain: "ETHEREUM"`，通过 `chainId` 区分网络  

## 项目结构

```
src/
  lib/           # TokenCore、RPC、DeFi 风险、历史、收益、兑换
  components/    # 资产看板、兑换、授权、质押、投票、历史
  App.tsx        # 深色科技风主界面
public/tcx-wasm  # postinstall 安装 WASM
```

## 安全提示

- 助记词 = 资产所有权，请纸笔离线备份  
- 质押 / 投票演示依赖预置合约地址，主网调用可能 revert，请用小额度测试  
- 浏览器环境存在扩展与 XSS 风险，大额资产请使用官方 imToken 或硬件钱包  

## 许可证

Apache-2.0。社区演示作品，与 imToken 官方无隶属关系。
