import { useCallback, useEffect, useRef, useState } from "react";
import BackupMnemonicModal from "./components/BackupMnemonicModal";
import DashboardPanel from "./components/DashboardPanel";
import HistoryPanel from "./components/HistoryPanel";
import ApprovePanel from "./components/ApprovePanel";
import PrivacyBanner from "./components/PrivacyBanner";
import SecurityPanel from "./components/SecurityPanel";
import StakePanel from "./components/StakePanel";
import SwapDeFiPanel from "./components/SwapDeFiPanel";
import TransferPanel from "./components/TransferPanel";
import VotePanel from "./components/VotePanel";
import WalletSetupModal from "./components/WalletSetupModal";
import { fetchBalance, formatNativeAmount, explorerAddressUrl } from "./lib/rpc";
import {
  DEFAULT_NETWORK,
  EVM_NETWORK_IDS,
  NETWORKS,
  getNetwork,
  type NetworkId,
} from "./lib/networks";
import { clearHistory } from "./lib/history";
import {
  clearStoredKeystore,
  disconnectWallet,
  ensureTcx,
  isBackupConfirmed,
  loadStoredKeystore,
  loadStoredNetwork,
  saveStoredNetwork,
} from "./lib/tokenCore";
import type { WalletSession } from "./lib/tokenCore";
import type { AppView } from "./types";
import "./App.css";

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function parseNetworkId(raw: string | null): NetworkId {
  if (raw && EVM_NETWORK_IDS.includes(raw as NetworkId)) return raw as NetworkId;
  return DEFAULT_NETWORK;
}

const NAV: { id: AppView; label: string }[] = [
  { id: "dashboard", label: "资产" },
  { id: "swap", label: "兑换" },
  { id: "approve", label: "授权" },
  { id: "stake", label: "质押" },
  { id: "vote", label: "投票" },
  { id: "transfer", label: "转账" },
  { id: "history", label: "历史" },
  { id: "security", label: "安全" },
  { id: "wallet", label: "钱包" },
];

export default function App() {
  const [tcxLoading, setTcxLoading] = useState(true);
  const [tcxReady, setTcxReady] = useState(false);
  const [networkId, setNetworkId] = useState<NetworkId>(() =>
    parseNetworkId(loadStoredNetwork())
  );
  const network = getNetwork(networkId);
  const [session, setSession] = useState<WalletSession | null>(null);
  const passwordRef = useRef("");
  const [walletOpen, setWalletOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [view, setView] = useState<AppView>("dashboard");
  const [balance, setBalance] = useState("—");
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [backupDone, setBackupDone] = useState(isBackupConfirmed);
  const [yieldTick, setYieldTick] = useState(0);

  const connected = !!session;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    ensureTcx()
      .then(() => setTcxReady(true))
      .catch(() => showToast("TokenCore WASM 加载失败"))
      .finally(() => setTcxLoading(false));
  }, [showToast]);

  const refreshBalance = useCallback(async () => {
    if (!session) return;
    setBalanceLoading(true);
    try {
      const wei = await fetchBalance(network, session.address);
      setBalance(formatNativeAmount(wei));
    } catch {
      setBalance("—");
    } finally {
      setBalanceLoading(false);
    }
  }, [session, network]);

  useEffect(() => {
    refreshBalance();
    const t = setInterval(refreshBalance, 25_000);
    return () => clearInterval(t);
  }, [refreshBalance]);

  useEffect(() => {
    saveStoredNetwork(networkId);
  }, [networkId]);

  useEffect(() => {
    if (tcxReady && !session && loadStoredKeystore()) setWalletOpen(true);
  }, [tcxReady, session]);

  const handleConnected = useCallback(
    (s: WalletSession, password: string) => {
      passwordRef.current = password;
      setSession(s);
      showToast("钱包已解锁 · DeFi 签名由 TokenCore 本地完成");
      if (!isBackupConfirmed()) setBackupOpen(true);
      else setBackupDone(true);
    },
    [showToast]
  );

  const disconnect = () => {
    disconnectWallet();
    setSession(null);
    passwordRef.current = "";
    setBalance("—");
    showToast("已断开");
  };

  const clearWallet = () => {
    if (!confirm("将删除本机 Keystore 与历史，请确认已备份助记词。")) return;
    clearStoredKeystore();
    clearHistory();
    disconnect();
    setBackupDone(false);
    showToast("本地数据已清除");
  };

  return (
    <div className="app defi-app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark defi-mark" />
          <div>
            <h1>DeFiVault</h1>
            <p>场景化自托管 · TokenCore</p>
          </div>
        </div>
        <nav className="side-nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              className={view === n.id ? "active" : ""}
              onClick={() => setView(n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <PrivacyBanner />
        <p className="tcx-foot">
          <a href="https://github.com/consenlabs/token-core-monorepo" target="_blank" rel="noreferrer">
            TokenCore
          </a>
        </p>
      </aside>

      <div className="app-body">
        <header className="topbar">
          <div className="topbar-title">
            <h2>DeFi 安全交互</h2>
            {tcxReady && <span className="badge badge-ok">WASM 就绪</span>}
          </div>
          <select
            className="network-select"
            value={networkId}
            onChange={(e) => setNetworkId(e.target.value as NetworkId)}
          >
            {Object.values(NETWORKS).map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
        </header>

        <main className="main">
          {!backupDone && connected && (
            <div className="alert-banner">
              <strong>请离线备份助记词后再进行 DeFi 授权</strong>
              <button type="button" className="btn-outline btn-sm" onClick={() => setBackupOpen(true)}>
                备份
              </button>
            </div>
          )}

          {view === "dashboard" && (
            <>
              <section className="card hero-card">
                {connected && session ? (
                  <>
                    <p className="label">{network.label}</p>
                    <a className="address" href={explorerAddressUrl(network, session.address)} target="_blank" rel="noreferrer">
                      {shortAddress(session.address)}
                    </a>
                    <p className="balance">
                      {balanceLoading ? "…" : balance} <span>{network.nativeSymbol}</span>
                    </p>
                    <button type="button" className="btn-outline btn-sm" onClick={refreshBalance}>
                      刷新
                    </button>
                  </>
                ) : (
                  <>
                    <p className="balance muted">连接钱包以管理多链 DeFi 资产</p>
                    <button type="button" className="btn-primary btn-lg" onClick={() => setWalletOpen(true)} disabled={tcxLoading}>
                      {tcxLoading ? "加载 WASM…" : "连接钱包"}
                    </button>
                  </>
                )}
              </section>
              {connected && session && (
                <DashboardPanel
                  address={session.address}
                  network={network}
                  nativeBalance={balance}
                  key={yieldTick}
                />
              )}
            </>
          )}

          {connected && session ? (
            <>
              {view === "swap" && (
                <SwapDeFiPanel
                  session={session}
                  network={network}
                  networkId={networkId}
                  onSuccess={() => {
                    refreshBalance();
                    setYieldTick((x) => x + 1);
                    showToast("兑换已提交");
                  }}
                />
              )}
              {view === "approve" && (
                <ApprovePanel session={session} network={network} networkId={networkId} />
              )}
              {view === "stake" && (
                <StakePanel
                  session={session}
                  network={network}
                  networkId={networkId}
                  onSuccess={() => {
                    setYieldTick((x) => x + 1);
                    showToast("质押交易已提交");
                  }}
                />
              )}
              {view === "vote" && <VotePanel session={session} network={network} networkId={networkId} />}
              {view === "transfer" && (
                <TransferPanel
                  session={session}
                  network={network}
                  networkId={networkId}
                  onSuccess={refreshBalance}
                />
              )}
              {view === "history" && <HistoryPanel networkId={networkId} />}
            </>
          ) : (
            view !== "dashboard" &&
            view !== "security" &&
            view !== "wallet" && (
              <section className="card">
                <p className="desc">请先连接钱包以使用 DeFi 功能。</p>
                <button type="button" className="btn-primary btn-block" onClick={() => setWalletOpen(true)}>
                  连接钱包
                </button>
              </section>
            )
          )}

          {view === "security" && (
            <SecurityPanel
              tcxReady={tcxReady}
              backupDone={backupDone}
              onRequestBackup={() => setBackupOpen(true)}
            />
          )}

          {view === "wallet" && (
            <section className="card wallet-settings">
              <h3>钱包</h3>
              {connected && session ? (
                <>
                  <p className="mono full-address">{session.address}</p>
                  <button type="button" className="btn-outline btn-block" onClick={() => setBackupOpen(true)}>
                    备份助记词
                  </button>
                  <button type="button" className="btn-secondary btn-block" onClick={disconnect}>
                    断开
                  </button>
                  <button type="button" className="btn-danger btn-block" onClick={clearWallet}>
                    清除本机数据
                  </button>
                </>
              ) : (
                <button type="button" className="btn-primary btn-block" onClick={() => setWalletOpen(true)}>
                  创建 / 导入
                </button>
              )}
            </section>
          )}
        </main>

        <nav className="bottom-nav">
          {NAV.slice(0, 5).map((n) => (
            <button
              key={n.id}
              type="button"
              className={view === n.id ? "active" : ""}
              onClick={() => setView(n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </div>

      <WalletSetupModal
        open={walletOpen}
        loading={tcxLoading}
        network={network}
        onClose={() => setWalletOpen(false)}
        onConnected={handleConnected}
      />

      {session && passwordRef.current && (
        <BackupMnemonicModal
          open={backupOpen}
          session={session}
          password={passwordRef.current}
          onDone={() => {
            setBackupOpen(false);
            setBackupDone(true);
            showToast("备份完成");
          }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
