import type { NetworkId } from "./networks";
import { getNetwork, MAINNET_IDS } from "./networks";
import { fetchBalance, formatNativeAmount } from "./rpc";
import { STAKE_TARGETS } from "./defiContracts";

export interface YieldPosition {
  id: string;
  networkId: NetworkId;
  label: string;
  type: "native" | "stake" | "lp";
  balance: string;
  symbol: string;
  aprEstimate: string;
  accruedEstimate: string;
}

const YIELD_META_KEY = "defivault-yield-meta";

interface YieldMeta {
  stakedWei?: string;
  lastSync?: number;
}

function loadMeta(): Record<string, YieldMeta> {
  try {
    return JSON.parse(localStorage.getItem(YIELD_META_KEY) || "{}") as Record<string, YieldMeta>;
  } catch {
    return {};
  }
}

export function saveStakeMeta(networkId: NetworkId, address: string, stakedWei: string): void {
  const key = `${networkId}:${address.toLowerCase()}`;
  const meta = loadMeta();
  meta[key] = { stakedWei, lastSync: Date.now() };
  localStorage.setItem(YIELD_META_KEY, JSON.stringify(meta));
}

/** 聚合各链资产与估算收益（链上余额 + 本地质押记录） */
export async function fetchYieldPortfolio(
  address: string
): Promise<{ positions: YieldPosition[]; totalAprHint: string }> {
  const positions: YieldPosition[] = [];
  const meta = loadMeta();
  const nets = [...MAINNET_IDS, "sepolia" as NetworkId];

  for (const nid of nets) {
    const net = getNetwork(nid);
    try {
      const wei = await fetchBalance(net, address);
      const bal = formatNativeAmount(wei);
      if (wei > 0n) {
        positions.push({
          id: `${nid}-native`,
          networkId: nid,
          label: `${net.shortLabel} 原生资产`,
          type: "native",
          balance: bal,
          symbol: net.nativeSymbol,
          aprEstimate: "—",
          accruedEstimate: "—",
        });
      }
    } catch {
      /* skip rpc error */
    }

    const stake = STAKE_TARGETS[nid];
    const m = meta[`${nid}:${address.toLowerCase()}`];
    if (stake && m?.stakedWei) {
      const staked = formatNativeAmount(BigInt(m.stakedWei));
      const apr = stake.aprHint;
      const accrued = (parseFloat(staked) * 0.032).toFixed(6);
      positions.push({
        id: `${nid}-stake`,
        networkId: nid,
        label: stake.label,
        type: "stake",
        balance: staked,
        symbol: net.nativeSymbol,
        aprEstimate: apr,
        accruedEstimate: `~${accrued} ${net.nativeSymbol}（估算）`,
      });
    }
  }

  const withApr = positions.filter((p) => p.aprEstimate !== "—");
  const avg =
    withApr.length > 0
      ? (
          withApr.reduce((s, p) => s + parseFloat(p.aprEstimate.replace(/[~%]/g, "") || "0"), 0) /
          withApr.length
        ).toFixed(1) + "%"
      : "—";

  return { positions, totalAprHint: avg };
}
