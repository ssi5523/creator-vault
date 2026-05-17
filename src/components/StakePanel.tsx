import { useState } from "react";
import { STAKE_TARGETS, encodeDeposit } from "../lib/defiContracts";
import { analyzeDeFiTarget } from "../lib/defiRisk";
import { appendHistory, updateHistoryTxHash } from "../lib/history";
import { saveStakeMeta } from "../lib/yield";
import { signAndBroadcastContract } from "../lib/tokenCore";
import type { WalletSession } from "../lib/tokenCore";
import type { NetworkConfig, NetworkId } from "../lib/networks";
import type { DeFiRiskReport } from "../lib/defiRisk";
import { explorerTxUrl, parseNativeAmount } from "../lib/rpc";
import DeFiConfirmModal from "./DeFiConfirmModal";

interface StakePanelProps {
  session: WalletSession;
  network: NetworkConfig;
  networkId: NetworkId;
  onSuccess?: () => void;
}

export default function StakePanel({ session, network, networkId, onSuccess }: StakePanelProps) {
  const target = STAKE_TARGETS[networkId];
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [risk, setRisk] = useState<DeFiRiskReport | null>(null);

  if (!target) {
    return (
      <section className="card">
        <h3>Stake / LP</h3>
        <p className="desc">No demo stake target on this chain. Try ETH or BSC.</p>
      </section>
    );
  }

  const prepare = async () => {
    if (!amount.trim()) {
      setError("Enter amount");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const report = await analyzeDeFiTarget(network, "stake", target.address, encodeDeposit());
      setRisk(report);
      setConfirmOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Risk check failed");
    } finally {
      setBusy(false);
    }
  };

  const execute = async (password: string) => {
    setBusy(true);
    const valueWei = parseNativeAmount(amount);
    const data = encodeDeposit();
    const hist = appendHistory({
      networkId,
      scenario: "stake",
      action: `Stake ${amount} ${network.nativeSymbol}`,
      from: session.address,
      to: target.address,
      value: valueWei.toString(),
      data,
      riskLevel: risk?.level,
    });
    try {
      const { txHash: hash, rawTx } = await signAndBroadcastContract(session, password, network, {
        to: target.address,
        value: valueWei.toString(),
        data,
        gas: "200000",
        chainId: Number(network.chainId),
      });
      updateHistoryTxHash(hist.id, hash, rawTx);
      saveStakeMeta(networkId, session.address, valueWei.toString());
      setTxHash(hash);
      setConfirmOpen(false);
      setAmount("");
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stake failed (demo contract may revert)");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card defi-panel">
      <h3>Stake / LP</h3>
      <p className="desc">
        {target.label} - APR ref {target.aprHint}
      </p>
      <div className="field">
        <label>Amount ({network.nativeSymbol})</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.01" />
      </div>
      {error && <p className="form-error">{error}</p>}
      {txHash && (
        <p className="tx-success">
          <a href={explorerTxUrl(network, txHash)} target="_blank" rel="noreferrer">
            View tx
          </a>
        </p>
      )}
      <button type="button" className="btn-primary btn-block" onClick={prepare} disabled={busy}>
        Risk check and stake
      </button>
      <DeFiConfirmModal
        open={confirmOpen}
        title="Confirm stake"
        summary={[
          { label: "Protocol", value: target.label },
          { label: "Contract", value: target.address },
          { label: "Amount", value: `${amount} ${network.nativeSymbol}` },
        ]}
        risk={risk}
        from={session.address}
        to={target.address}
        value={amount ? parseNativeAmount(amount).toString() : "0"}
        onClose={() => setConfirmOpen(false)}
        onConfirm={execute}
        busy={busy}
      />
    </section>
  );
}
