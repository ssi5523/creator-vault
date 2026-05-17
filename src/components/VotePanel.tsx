import { useState } from "react";
import { GOVERNOR_TARGETS, encodeCastVote } from "../lib/defiContracts";
import { analyzeDeFiTarget } from "../lib/defiRisk";
import { appendHistory, updateHistoryTxHash } from "../lib/history";
import { signAndBroadcastContract } from "../lib/tokenCore";
import type { WalletSession } from "../lib/tokenCore";
import type { NetworkConfig, NetworkId } from "../lib/networks";
import type { DeFiRiskReport } from "../lib/defiRisk";
import { explorerTxUrl } from "../lib/rpc";
import DeFiConfirmModal from "./DeFiConfirmModal";

interface VotePanelProps {
  session: WalletSession;
  network: NetworkConfig;
  networkId: NetworkId;
}

export default function VotePanel({ session, network, networkId }: VotePanelProps) {
  const gov = GOVERNOR_TARGETS[networkId];
  const [support, setSupport] = useState<0 | 1>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [risk, setRisk] = useState<DeFiRiskReport | null>(null);

  if (!gov) {
    return (
      <section className="card">
        <h3>On-chain vote</h3>
        <p className="desc">No demo governor on this chain. Try Ethereum mainnet.</p>
      </section>
    );
  }

  const data = encodeCastVote(gov.proposalId, support);

  const prepare = async () => {
    setBusy(true);
    try {
      const report = await analyzeDeFiTarget(network, "vote", gov.address, data);
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
    const hist = appendHistory({
      networkId,
      scenario: "vote",
      action: `Proposal #${gov.proposalId} ${support === 1 ? "for" : "against"}`,
      from: session.address,
      to: gov.address,
      data,
      value: "0",
      riskLevel: risk?.level,
    });
    try {
      const { txHash: hash, rawTx } = await signAndBroadcastContract(session, password, network, {
        to: gov.address,
        value: "0",
        data,
        gas: "150000",
        chainId: Number(network.chainId),
      });
      updateHistoryTxHash(hist.id, hash, rawTx);
      setTxHash(hash);
      setConfirmOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vote failed (demo governor may not exist)");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card defi-panel">
      <h3>On-chain vote</h3>
      <p className="desc">{gov.label} - proposal {gov.proposalId}</p>
      <div className="segmented">
        <button type="button" className={support === 1 ? "active" : ""} onClick={() => setSupport(1)}>
          For
        </button>
        <button type="button" className={support === 0 ? "active" : ""} onClick={() => setSupport(0)}>
          Against
        </button>
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
        Risk check and vote
      </button>
      <DeFiConfirmModal
        open={confirmOpen}
        title="Confirm vote"
        summary={[
          { label: "Governor", value: gov.address },
          { label: "Proposal", value: String(gov.proposalId) },
          { label: "Side", value: support === 1 ? "For" : "Against" },
        ]}
        risk={risk}
        from={session.address}
        to={gov.address}
        onClose={() => setConfirmOpen(false)}
        onConfirm={execute}
        busy={busy}
      />
    </section>
  );
}
