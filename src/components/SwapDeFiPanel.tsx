import { useEffect, useState } from "react";
import {
  buildSwapTransaction,
  fetchSwapQuote,
  formatTokenAmount,
  pickCounterToken,
} from "../lib/swap";
import { getSwapTokens, isSwapSupported, type SwapToken } from "../lib/tokens";
import { analyzeDeFiTarget } from "../lib/defiRisk";
import { appendHistory, updateHistoryTxHash } from "../lib/history";
import { signAndBroadcastContract } from "../lib/tokenCore";
import type { WalletSession } from "../lib/tokenCore";
import type { NetworkConfig, NetworkId } from "../lib/networks";
import type { DeFiRiskReport } from "../lib/defiRisk";
import { explorerTxUrl } from "../lib/rpc";
import DeFiConfirmModal from "./DeFiConfirmModal";

interface SwapDeFiPanelProps {
  session: WalletSession;
  network: NetworkConfig;
  networkId: NetworkId;
  onSuccess?: () => void;
}

export default function SwapDeFiPanel({
  session,
  network,
  networkId,
  onSuccess,
}: SwapDeFiPanelProps) {
  const tokens = getSwapTokens(networkId);
  const [fromId, setFromId] = useState(tokens[0]?.id ?? "");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [quoteOut, setQuoteOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [risk, setRisk] = useState<DeFiRiskReport | null>(null);
  const [pendingTx, setPendingTx] = useState<Awaited<ReturnType<typeof buildSwapTransaction>> | null>(
    null
  );

  const from = tokens.find((t) => t.id === fromId);
  const to = tokens.find((t) => t.id === toId);

  useEffect(() => {
    if (!toId && fromId) {
      const counter = pickCounterToken(networkId, fromId);
      if (counter) setToId(counter.id);
    }
  }, [fromId, networkId, toId]);

  if (!isSwapSupported(networkId)) {
    return (
      <section className="card">
        <h3>DEX swap</h3>
        <p className="desc">Sepolia has no ParaSwap route. Use ETH, BSC, Base, or Arbitrum mainnet.</p>
      </section>
    );
  }

  const loadQuote = async () => {
    if (!from || !to || !amount.trim()) return;
    setError("");
    setBusy(true);
    try {
      const q = await fetchSwapQuote(networkId, from, to, amount, session.address);
      setQuoteOut(formatTokenAmount(q.destAmount, to.decimals));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quote failed");
      setQuoteOut("");
    } finally {
      setBusy(false);
    }
  };

  const prepareSwap = async () => {
    if (!from || !to) return;
    setError("");
    setBusy(true);
    try {
      const q = await fetchSwapQuote(networkId, from, to, amount, session.address);
      const tx = await buildSwapTransaction(networkId, q, from, to, session.address);
      const report = await analyzeDeFiTarget(network, "swap", tx.to, tx.data);
      setPendingTx(tx);
      setRisk(report);
      setConfirmOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prepare failed");
    } finally {
      setBusy(false);
    }
  };

  const execute = async (password: string) => {
    if (!pendingTx || !from || !to) return;
    setBusy(true);
    const hist = appendHistory({
      networkId,
      scenario: "swap",
      action: `Swap ${amount} ${from.symbol} to ${to.symbol}`,
      from: session.address,
      to: pendingTx.to,
      data: pendingTx.data,
      value: pendingTx.value,
      riskLevel: risk?.level,
    });
    try {
      const { txHash: hash, rawTx } = await signAndBroadcastContract(
        session,
        password,
        network,
        pendingTx
      );
      updateHistoryTxHash(hist.id, hash, rawTx);
      setTxHash(hash);
      setConfirmOpen(false);
      setAmount("");
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Swap failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card defi-panel">
      <h3>DEX swap (Uniswap-class)</h3>
      <p className="desc">ParaSwap quote + TokenCore sign_tx. Keys never leave device.</p>
      <div className="field-row">
        <div className="field">
          <label>Sell</label>
          <select value={fromId} onChange={(e) => setFromId(e.target.value)}>
            {tokens.map((t) => (
              <option key={t.id} value={t.id}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Buy</label>
          <select value={toId} onChange={(e) => setToId(e.target.value)}>
            {tokens.filter((t) => t.id !== fromId).map((t) => (
              <option key={t.id} value={t.id}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Amount</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.01" />
      </div>
      {quoteOut && (
        <p className="quote-line">
          Estimated out: <strong>{quoteOut}</strong> {to?.symbol}
        </p>
      )}
      {error && <p className="form-error">{error}</p>}
      {txHash && (
        <p className="tx-success">
          <a href={explorerTxUrl(network, txHash)} target="_blank" rel="noreferrer">
            View tx
          </a>
        </p>
      )}
      <div className="btn-row">
        <button type="button" className="btn-outline" onClick={loadQuote} disabled={busy}>
          Refresh quote
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={prepareSwap}
          disabled={busy || !amount.trim()}
        >
          Secure swap
        </button>
      </div>
      <DeFiConfirmModal
        open={confirmOpen}
        title="Confirm swap"
        summary={[
          { label: "Sell", value: `${amount} ${from?.symbol}` },
          { label: "Buy", value: to?.symbol ?? "" },
          { label: "Router", value: pendingTx?.to ?? "" },
        ]}
        risk={risk}
        from={session.address}
        to={pendingTx?.to ?? ""}
        value={pendingTx?.value}
        onClose={() => setConfirmOpen(false)}
        onConfirm={execute}
        busy={busy}
      />
    </section>
  );
}
