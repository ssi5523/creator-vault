import type { NetworkId } from "./networks";

export type DeFiScenario = "swap" | "approve" | "stake" | "vote" | "bridge";

export interface KnownContract {
  address: string;
  label: string;
  scenario: DeFiScenario;
  riskTier: "low" | "medium" | "high";
  description: string;
}

/** 各链常见 DeFi 合约（用于风险评级与场景识别） */
export const KNOWN_CONTRACTS: Partial<Record<NetworkId, KnownContract[]>> = {
  eth: [
    {
      address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      label: "Uniswap V3 Router",
      scenario: "swap",
      riskTier: "low",
      description: "Uniswap 官方路由",
    },
    {
      address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
      label: "Uniswap V2 Router",
      scenario: "swap",
      riskTier: "low",
      description: "Uniswap V2 路由",
    },
    {
      address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
      label: "Lido stETH",
      scenario: "stake",
      riskTier: "medium",
      description: "流动性质押",
    },
  ],
  bsc: [
    {
      address: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
      label: "PancakeSwap Router",
      scenario: "swap",
      riskTier: "low",
      description: "PancakeSwap 路由",
    },
  ],
  base: [
    {
      address: "0x2626664c2603336E57B271c5C0b26F421741e481",
      label: "Uniswap Universal Router",
      scenario: "swap",
      riskTier: "low",
      description: "Base 上 Uniswap 路由",
    },
  ],
  arbitrum: [
    {
      address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      label: "Uniswap V3 Router",
      scenario: "swap",
      riskTier: "low",
      description: "Arbitrum Uniswap",
    },
  ],
};

/** 演示用质押合约（deposit 函数 selector） */
export const STAKE_TARGETS: Partial<
  Record<NetworkId, { address: string; label: string; aprHint: string }>
> = {
  eth: {
    address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    label: "Lido 流动性质押（演示）",
    aprHint: "~3.2%",
  },
  bsc: {
    address: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    label: "Pancake 质押入口（演示）",
    aprHint: "~5.1%",
  },
};

/** 演示治理投票（Tally / Governor 类） */
export const GOVERNOR_TARGETS: Partial<
  Record<NetworkId, { address: string; label: string; proposalId: number }>
> = {
  eth: {
    address: "0x6f3E627A41fA47E2A66aCFeaF8aFa7D9B5033C3C",
    label: "治理合约（演示）",
    proposalId: 1,
  },
};

const BRIDGE_KEYWORDS = ["bridge", "portal", "gateway", "celer", "stargate"];

export function matchKnownContract(
  networkId: NetworkId,
  address: string
): KnownContract | undefined {
  const list = KNOWN_CONTRACTS[networkId] ?? [];
  return list.find((c) => c.address.toLowerCase() === address.toLowerCase());
}

export function guessScenarioFromLabel(label: string): DeFiScenario {
  const l = label.toLowerCase();
  if (BRIDGE_KEYWORDS.some((k) => l.includes(k))) return "bridge";
  if (l.includes("vote") || l.includes("治理")) return "vote";
  if (l.includes("stake") || l.includes("质押") || l.includes("lp")) return "stake";
  if (l.includes("approve") || l.includes("授权")) return "approve";
  return "swap";
}

/** castVote(uint256 proposalId, uint8 support) — support: 0=反对 1=赞成 */
export function encodeCastVote(proposalId: number, support: 0 | 1): string {
  const selector = "0x56781388";
  const pid = BigInt(proposalId).toString(16).padStart(64, "0");
  const sup = BigInt(support).toString(16).padStart(64, "0");
  return `${selector}${pid}${sup}`;
}

/** 简化 deposit() */
export function encodeDeposit(): string {
  return "0xd0e30db0";
}
