import type { NetworkId } from "./networks";
import { getNetwork } from "./networks";
import type { ContractTxPayload } from "./tokenCore";
import { getSwapTokens, getTokenById, paraswapNetworkId, type SwapToken } from "./tokens";

const SWAP_API = "/api/swap/paraswap";

export interface SwapQuote {
  srcAmount: string;
  destAmount: string;
  srcUSD?: string;
  destUSD?: string;
  priceRoute: unknown;
  gasCost?: string;
}

export function parseTokenAmount(amount: string, decimals: number): string {
  const trimmed = amount.trim();
  if (!trimmed || Number.isNaN(Number(trimmed)) || Number(trimmed) <= 0) {
    throw new Error("请输入有效的兑换数量");
  }
  const [whole, frac = ""] = trimmed.split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0")).toString();
}

export function formatTokenAmount(raw: string, decimals: number, maxFrac = 6): string {
  const n = BigInt(raw);
  const base = 10n ** BigInt(decimals);
  const whole = n / base;
  const frac = n % base;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  const shown = fracStr.slice(0, maxFrac);
  return shown ? `${whole}.${shown}` : whole.toString();
}

export async function fetchSwapQuote(
  networkId: NetworkId,
  from: SwapToken,
  to: SwapToken,
  amountHuman: string,
  userAddress: string
): Promise<SwapQuote> {
  const srcAmount = parseTokenAmount(amountHuman, from.decimals);
  const params = new URLSearchParams({
    srcToken: from.address,
    destToken: to.address,
    srcDecimals: String(from.decimals),
    destDecimals: String(to.decimals),
    amount: srcAmount,
    side: "SELL",
    network: String(paraswapNetworkId(networkId)),
    userAddress,
  });

  const res = await fetch(`${SWAP_API}/prices/?${params}`);
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`获取报价失败 (${res.status})${err ? `: ${err.slice(0, 120)}` : ""}`);
  }

  const json = (await res.json()) as {
    destAmount: string;
    srcAmount?: string;
    srcUSD?: string;
    destUSD?: string;
    gasCost?: string;
    priceRoute?: unknown;
  };

  if (!json.destAmount || !json.priceRoute) {
    throw new Error("暂无可用兑换路径，请调整金额或币种");
  }

  return {
    srcAmount,
    destAmount: json.destAmount,
    srcUSD: json.srcUSD,
    destUSD: json.destUSD,
    gasCost: json.gasCost,
    priceRoute: json.priceRoute,
  };
}

export async function buildSwapTransaction(
  networkId: NetworkId,
  quote: SwapQuote,
  from: SwapToken,
  to: SwapToken,
  userAddress: string,
  slippageBps = 100
): Promise<ContractTxPayload> {
  const net = paraswapNetworkId(networkId);
  const chainId = Number(getNetwork(networkId).chainId);
  const res = await fetch(`${SWAP_API}/transactions/${net}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      srcToken: from.address,
      destToken: to.address,
      srcAmount: quote.srcAmount,
      destAmount: quote.destAmount,
      priceRoute: quote.priceRoute,
      userAddress,
      partner: "defivault",
      slippage: slippageBps,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`构建交易失败 (${res.status})${err ? `: ${err.slice(0, 120)}` : ""}`);
  }

  const tx = (await res.json()) as ContractTxPayload;
  return { ...tx, chainId: tx.chainId ?? chainId };
}

export function pickCounterToken(networkId: NetworkId, fromId: string): SwapToken | undefined {
  const tokens = getSwapTokens(networkId);
  const prefer = fromId.includes("eth") || fromId === "bnb" ? ["usdc", "usdt"] : ["eth", "bnb"];
  for (const id of prefer) {
    const t = getTokenById(networkId, id);
    if (t) return t;
  }
  return tokens.find((t) => t.id !== fromId);
}
