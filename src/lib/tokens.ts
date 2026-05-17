import type { NetworkId } from "./networks";
import { getNetwork } from "./networks";

export interface SwapToken {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  address: string;
}

const ETH_PLACEHOLDER = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const TOKENS: Partial<Record<NetworkId, SwapToken[]>> = {
  eth: [
    { id: "eth", symbol: "ETH", name: "Ether", decimals: 18, address: ETH_PLACEHOLDER },
    {
      id: "usdc",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    },
    {
      id: "usdt",
      symbol: "USDT",
      name: "Tether",
      decimals: 6,
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    },
  ],
  bsc: [
    { id: "bnb", symbol: "BNB", name: "BNB", decimals: 18, address: ETH_PLACEHOLDER },
    {
      id: "usdt",
      symbol: "USDT",
      name: "Tether",
      decimals: 18,
      address: "0x55d398326f99059fF775485246999027B3197955",
    },
  ],
  base: [
    { id: "eth", symbol: "ETH", name: "Ether", decimals: 18, address: ETH_PLACEHOLDER },
    {
      id: "usdc",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
  ],
  arbitrum: [
    { id: "eth", symbol: "ETH", name: "Ether", decimals: 18, address: ETH_PLACEHOLDER },
    {
      id: "usdc",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    },
  ],
  sepolia: [
    { id: "eth", symbol: "ETH", name: "Ether", decimals: 18, address: ETH_PLACEHOLDER },
  ],
};

export function getSwapTokens(networkId: NetworkId): SwapToken[] {
  return TOKENS[networkId] ?? [];
}

export function getTokenById(networkId: NetworkId, id: string): SwapToken | undefined {
  return getSwapTokens(networkId).find((t) => t.id === id);
}

export function paraswapNetworkId(networkId: NetworkId): number {
  return getNetwork(networkId).paraswapId;
}

export function isSwapSupported(networkId: NetworkId): boolean {
  return networkId !== "sepolia" && getSwapTokens(networkId).length >= 2;
}
