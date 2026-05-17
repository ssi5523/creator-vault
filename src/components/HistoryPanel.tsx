import { useMemo, useState } from "react";
import { clearHistory, downloadHistoryExport, getHistory } from "../lib/history";
import type { NetworkId } from "../lib/networks";
import { NETWORKS } from "../lib/networks";
import { explorerTxUrl } from "../lib/rpc";

interface HistoryPanelProps {
  networkId?: NetworkId;
}

export default function HistoryPanel({ networkId }: HistoryPanelProps) {
  const [filter, setFilter] = useState<NetworkId | "all">(networkId ?? "all");
  const [refresh, setRefresh] = useState(0);

  const records = useMemo(() => {
    void refresh;
    return getHistory(filter === "all" ? undefined : filter);
  }, [filter, refresh]);

  return (
    <section className="card history-panel">
      <header className="panel-header">
        <h3>Tx history (local only)</h3>
        <div className="btn-row">
          <button type="button" className="btn-outline btn-sm" onClick={() => downloadHistoryExport()}>
            Export JSON
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => {
              if (confirm("Clear all local history?")) {
                clearHistory();
                setRefresh((r) => r + 1);
              }
            }}
          >
            Clear
          </button>
        </div>
      </header>
      <p className="desc">Scenario, hash, rawTx if available. Never uploaded.</p>
      <div className="field">
        <label>Network</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value as NetworkId | "all")}>
          <option value="all">All</option>
          {Object.keys(NETWORKS).map((id) => (
            <option key={id} value={id}>
              {NETWORKS[id as NetworkId].label}
            </option>
          ))}
        </select>
      </div>
      {records.length === 0 && <p className="muted">No records</p>}
      <ul className="history-list">
        {records.map((r) => {
          const net = NETWORKS[r.networkId];
          return (
            <li key={r.id} className={`history-item risk-${r.riskLevel ?? "low"}`}>
              <div className="history-meta">
                <span className="scenario-tag">{r.scenario}</span>
                <time>{new Date(r.timestamp).toLocaleString()}</time>
              </div>
              <p className="history-action">{r.action}</p>
              <p className="mono history-addr">-&gt; {r.to}</p>
              {r.txHash && (
                <a href={explorerTxUrl(net, r.txHash)} target="_blank" rel="noreferrer">
                  {r.txHash.slice(0, 18)}...
                </a>
              )}
              {r.rawTx && (
                <details>
                  <summary>rawTx</summary>
                  <code className="raw-tx">{r.rawTx.slice(0, 120)}...</code>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
