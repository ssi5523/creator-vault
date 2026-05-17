import { fetchBytecode } from "./rpc";
import type { NetworkConfig } from "./networks";
import type { DeFiScenario } from "./defiContracts";
import { matchKnownContract } from "./defiContracts";
import type { RiskLevel } from "./security";

export interface DeFiRiskReport {
  level: RiskLevel;
  scenario: DeFiScenario;
  messages: string[];
  contractRating: "verified" | "unknown" | "high";
  spenderKnown: boolean;
}

export interface ApproveRiskInput {
  tokenSymbol: string;
  spender: string;
  amountHuman: string;
  unlimited: boolean;
}

export async function analyzeDeFiTarget(
  network: NetworkConfig,
  scenario: DeFiScenario,
  to: string,
  data?: string
): Promise<DeFiRiskReport> {
  const messages: string[] = [];
  let level: RiskLevel = "low";
  const known = matchKnownContract(network.id, to);
  let contractRating: DeFiRiskReport["contractRating"] = known ? "verified" : "unknown";

  if (known) {
    messages.push(`已识别合约：${known.label}（${known.riskTier} 风险库）`);
    if (known.riskTier === "medium" && level === "low") level = "medium";
    if (known.riskTier === "high") level = "high";
  } else {
    messages.push("目标合约未在本地白名单，请自行核实");
    level = "medium";
    contractRating = "unknown";
  }

  if (scenario === "approve") {
    messages.push("授权操作将允许合约划转您的代币，建议限制额度");
    level = level === "low" ? "medium" : level;
  }
  if (scenario === "bridge") {
    messages.push("跨链桥涉及资金跨链转移，请确认官方渠道与到账链");
    level = "high";
    contractRating = "high";
  }
  if (scenario === "stake") {
    messages.push("质押资金将进入合约，赎回规则以协议为准");
    if (level === "low") level = "medium";
  }
  if (scenario === "vote") {
    messages.push("链上投票不可撤销，请确认提案 ID 与投票方向");
  }
  if (scenario === "swap" && data && data.length > 200) {
    messages.push("复杂 swap 路由，请核对输入代币与最小输出");
  }

  try {
    const code = await fetchBytecode(network, to);
    if (code === "0x" || code === "0x0") {
      messages.push("警告：目标为 EOA 地址而非合约");
      level = "high";
    }
  } catch {
    messages.push("无法拉取合约字节码");
  }

  return {
    level,
    scenario,
    messages,
    contractRating,
    spenderKnown: !!known,
  };
}

export function analyzeApproveRisk(input: ApproveRiskInput): DeFiRiskReport {
  const messages: string[] = [];
  let level: RiskLevel = "medium";

  if (input.unlimited) {
    messages.push("无限额度授权风险极高，合约可随时转走全部代币");
    level = "high";
  } else {
    messages.push(`授权额度：${input.amountHuman} ${input.tokenSymbol}`);
    level = "medium";
  }

  messages.push(`授权给：${input.spender}`);
  messages.push("可在区块浏览器撤销授权（Revoke）");

  return {
    level,
    scenario: "approve",
    messages,
    contractRating: "unknown",
    spenderKnown: false,
  };
}

export function trackFundFlow(from: string, to: string, value?: string): string[] {
  const lines = [`资金流向：${from.slice(0, 10)}… → ${to.slice(0, 10)}…`];
  if (value && value !== "0") lines.push(`附带原生币：${value} wei`);
  return lines;
}
