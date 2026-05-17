import { useState } from "react";
import { encodeApprove } from "../lib/erc20";
import { analyzeApproveRisk, analyzeDeFiTarget } from "../lib/defiRisk";
import { appendHistory, updateHistoryTxHash } from "../lib/history";
import { getSwapTokens } from "../lib/tokens";
import { signAndBroadcastContract } from "../lib/tokenCore";
import type { WalletSession } from "../lib/tokenCore";
import type { NetworkConfig, NetworkId } from "../lib/networks";
import type { DeFiRiskReport } from "../lib/defiRisk";
import { explorerTxUrl } from "../lib/rpc";
import { parseTokenAmount } from "../lib/swap";
import DeFiConfirmModal from "./DeFiConfirmModal";

interface ApprovePanelProps {
  session: WalletSession;
  network: NetworkConfig;
  networkId: NetworkId;
}

export default function ApprovePanel({ session, network, networkId }: ApprovePanelProps) {
  const tokens = getSwapTokens(networkId).filter((t) => t.decimals <= 18);
  const [tokenId, setTokenId] = useState(tokens[0]?.id ?? "");
  const [spender, setSpender] = useState("");
  const [amount, setAmount] = useState("");
  const [unlimited, setUnlimited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [risk, setRisk] = useState<DeFiRiskReport | null>(null);

  const token = tokens.find((t) => t.id === tokenId);

  const prepare = async () => {
    if (!token || !spender.trim()) {
      setError("Select token and enter spender address");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const amt = unlimited
        ? BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
        : BigInt(parseTokenAmount(amount || "0", token.decimals));
      const data = encodeApprove(spender.trim(), amt);
      const contractRisk = await analyzeDeFiTarget(network, "approve", spender.trim());
      const approveRisk = analyzeApproveRisk({
        tokenSymbol: token.symbol,
        spender: spender.trim(),
        amountHuman: unlimited ? "unlimited" : amount,
        unlimited,
      });
      setRisk({
        ...approveRisk,
        messages: [...approveRisk.messages, ...contractRisk.messages],
        level:
          approveRisk.level === "high" || contractRisk.level === "high"
            ? "high"
            : approveRisk.level === "medium" || contractRisk.level === "medium"
              ? "medium"
              : "low",
      });
      setConfirmOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prepare failed");
    } finally {
      setBusy(false);
    }
  };

  const execute = async (password: string) => {
    if (!token) return;
    setBusy(true);
    const data = encodeApprove(
      spender.trim(),
      unlimited
        ? BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
        : BigInt(parseTokenAmount(amount || "0", token.decimals))
    );
    const hist = appendHistory({
      networkId,
      scenario: "approve",
      action: `Approve ${token.symbol} for ${spender.slice(0, 10)}...`,
      from: session.address,
      to: token.address,
      data,
      value: "0",
      riskLevel: risk?.level,
      meta: { unlimited: String(unlimited) },
    });
    try {
      const { txHash: hash, rawTx } = await signAndBroadcastContract(session, password, network, {
        to: token.address,
        value: "0",
        data,
        gas: "80000",
        chainId: Number(network.chainId),
      });
      updateHistoryTxHash(hist.id, hash, rawTx);
      setTxHash(hash);
      setConfirmOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card defi-panel">
      <h3>Token approve</h3>
      <p className="desc">ERC20 approve via TokenCore. Prefer limited allowance.</p>
      <div className="field">
        <label>Token</label>
        <select value={tokenId} onChange={(e) => setTokenId(e.target.value)}>
          {tokens.map((t) => (
            <option key={t.id} value={t.id}>
              {t.symbol}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Spender (router / staking contract)</label>
        <input value={spender} onChange={(e) => setSpender(e.target.value)} placeholder="0x..." />
      </div>
      <div className="field">
        <label>Amount</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={unlimited}
          placeholder="100"
        />
      </div>
      <label className="checkbox-row">
        <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} />
        Unlimited allowance (high risk)
      </label>
      {error && <p className="form-error">{error}</p>}
      {txHash && (
        <p className="tx-success">
          <a href={explorerTxUrl(network, txHash)} target="_blank" rel="noreferrer">
            View tx
          </a>
        </p>
      )}
      <button type="button" className="btn-primary btn-block" onClick={prepare} disabled={busy}>
        Risk check and approve
      </button>
      <DeFiConfirmModal
        open={confirmOpen}
        title="Confirm approve"
        summary={[
          { label: "Token", value: token?.symbol ?? "" },
          { label: "Spender", value: spender },
          { label: "Amount", value: unlimited ? "unlimited" : amount },
        ]}
        risk={risk}
        from={session.address}
        to={token?.address ?? ""}
        onClose={() => setConfirmOpen(false)}
        onConfirm={execute}
        busy={busy}
      />
    </section>
  );
}
