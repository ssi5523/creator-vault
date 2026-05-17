import { useState } from "react";
import { appendHistory, updateHistoryTxHash } from "../lib/history";
import { explorerTxUrl } from "../lib/rpc";
import { analyzeTransferRisk, markRecipientKnown } from "../lib/security";
import type { NetworkId } from "../lib/networks";
import {
  hasTransferPin,
  signAndBroadcastTransfer,
} from "../lib/tokenCore";
import type { WalletSession } from "../lib/tokenCore";
import type { NetworkConfig } from "../lib/networks";
import type { TransferRiskReport } from "../lib/security";
import ConfirmTransferModal from "./ConfirmTransferModal";

interface TransferPanelProps {
  session: WalletSession;
  network: NetworkConfig;
  networkId: NetworkId;
  onSuccess?: (txHash: string) => void;
}

export default function TransferPanel({ session, network, networkId, onSuccess }: TransferPanelProps) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [risk, setRisk] = useState<TransferRiskReport | null>(null);

  const openConfirm = async () => {
    setError("");
    setTxHash(null);
    if (!to.trim() || !amount.trim()) {
      setError("请填写收款地址与金额");
      return;
    }
    setBusy(true);
    try {
      const report = await analyzeTransferRisk(network, session.address, to.trim());
      setRisk(report);
      setConfirmOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "风险检测失败");
    } finally {
      setBusy(false);
    }
  };

  const executeTransfer = async (password: string) => {
    setBusy(true);
    setError("");
    try {
      const hist = appendHistory({
        networkId,
        scenario: "transfer",
        action: `转账 ${amount} ${network.nativeSymbol}`,
        from: session.address,
        to: to.trim(),
        riskLevel: risk?.level,
      });
      const { txHash: hash, rawTx } = await signAndBroadcastTransfer(
        session,
        password,
        network,
        to.trim(),
        amount.trim()
      );
      updateHistoryTxHash(hist.id, hash, rawTx);
      markRecipientKnown(to.trim());
      setTxHash(hash);
      setTo("");
      setAmount("");
      setConfirmOpen(false);
      onSuccess?.(hash);
    } catch (e) {
      setError(e instanceof Error ? e.message : "转账失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card transfer-panel">
      <h3>安全转账</h3>
      <p className="desc">
        通过 TokenCore <code>sign_tx</code> 在本地签名，广播至 {network.label}。提交前将进行合约地址与首次收款检测。
      </p>

      <div className="field">
        <label htmlFor="send-to">收款地址</label>
        <input
          id="send-to"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="0x..."
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="field">
        <label htmlFor="send-amount">金额（{network.nativeSymbol}）</label>
        <input
          id="send-amount"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.01"
        />
      </div>

      {error && <p className="form-error">{error}</p>}

      {txHash && (
        <p className="tx-success">
          交易已提交：
          <a href={explorerTxUrl(network, txHash)} target="_blank" rel="noreferrer">
            在区块浏览器查看
          </a>
        </p>
      )}

      <button
        type="button"
        className="btn-primary btn-block btn-lg"
        onClick={openConfirm}
        disabled={busy || !to.trim() || !amount.trim()}
      >
        {busy && !confirmOpen ? "检测风险中…" : "继续 · 二次确认"}
      </button>

      <ConfirmTransferModal
        open={confirmOpen}
        network={network}
        from={session.address}
        to={to.trim()}
        amount={amount.trim()}
        risk={risk}
        requirePin={hasTransferPin()}
        onClose={() => setConfirmOpen(false)}
        onConfirm={executeTransfer}
        busy={busy}
      />
    </section>
  );
}
