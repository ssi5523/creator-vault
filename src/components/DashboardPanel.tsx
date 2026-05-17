import { useEffect, useState } from "react";
import { fetchYieldPortfolio, type YieldPosition } from "../lib/yield";
import type { NetworkConfig } from "../lib/networks";

interface DashboardPanelProps {
  address: string;
  network: NetworkConfig;
  nativeBalance: string;
}

export default function DashboardPanel({ address, network, nativeBalance }: DashboardPanelProps) {
  const [positions, setPositions] = useState<YieldPosition[]>([]);
  const [aprHint, setAprHint] = useState("-");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchYieldPortfolio(address)
      .then(({ positions: p, totalAprHint }) => {
        setPositions(p);
        setAprHint(totalAprHint);
      })
      .finally(() => setLoading(false));
  }, [address, nativeBalance]);

  return (
    <section className="dashboard-panel">
      <div className="card stats-row">
        <div className="stat">
          <span className="stat-label">Current chain</span>
          <strong>
            {nativeBalance} {network.nativeSymbol}
          </strong>
        </div>
        <div className="stat">
          <span className="stat-label">Stake APR ref</span>
          <strong>{aprHint}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">Positions</span>
          <strong>{loading ? "..." : positions.length}</strong>
        </div>
      </div>

      <div className="card">
        <h3>Cross-chain yield</h3>
        <p className="desc">ETH / BSC / Base / Arbitrum balances and local stake records.</p>
        {loading && <p className="muted">Syncing...</p>}
        {!loading && positions.length === 0 && (
          <p className="muted">No positions yet. Fund wallet or use Stake tab.</p>
        )}
        <div className="yield-grid">
          {positions.map((p) => (
            <article key={p.id} className={`yield-card type-${p.type}`}>
              <header>
                <span className="chain-badge">{p.networkId.toUpperCase()}</span>
                <span className="type-badge">{p.type}</span>
              </header>
              <h4>{p.label}</h4>
              <p className="yield-balance">
                {p.balance} <small>{p.symbol}</small>
              </p>
              <footer>
                <span>APR {p.aprEstimate}</span>
                <span>{p.accruedEstimate}</span>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
