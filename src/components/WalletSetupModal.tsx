import { useEffect, useState } from "react";
import {
  createPasswordWallet,
  generateMnemonicPhrase,
  loadStoredKeystore,
  unlockKeystore,
} from "../lib/tokenCore";
import type { WalletSession } from "../lib/tokenCore";
import type { NetworkConfig } from "../lib/networks";

type Mode = "create" | "import" | "unlock";

interface WalletSetupModalProps {
  open: boolean;
  loading: boolean;
  network: NetworkConfig;
  onClose: () => void;
  onConnected: (session: WalletSession, password: string, mnemonic?: string) => void;
}

const RISK_TEXT =
  "助记词等同于钱包所有权。请勿截图、勿发给任何人、勿存入网盘。丢失无法找回，泄露将被盗币。";

export default function WalletSetupModal({
  open,
  loading,
  network,
  onClose,
  onConnected,
}: WalletSetupModalProps) {
  const [mode, setMode] = useState<Mode>("create");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setPassword("");
    setConfirm("");
    setMnemonic("");
    setRiskAccepted(false);
    setError("");
    setBusy(false);
    setMode(loadStoredKeystore() ? "unlock" : "create");
  }, [open]);

  if (!open) return null;

  const handleGenerateMnemonic = async () => {
    setError("");
    setBusy(true);
    try {
      const phrase = await generateMnemonicPhrase();
      setMnemonic(phrase);
      setMode("import");
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成助记词失败");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setError("");
    if (!riskAccepted && mode !== "unlock") {
      setError("请先阅读并勾选风险提示");
      return;
    }
    if (password.length < 8) {
      setError("密码至少 8 位，用于本地加密 Keystore");
      return;
    }
    if (mode !== "unlock" && password !== confirm) {
      setError("两次密码不一致");
      return;
    }
    if ((mode === "import" || mode === "create") && mode === "import" && !mnemonic.trim()) {
      setError("请输入助记词，或切换为「创建钱包」随机生成");
      return;
    }

    if (loading) {
      setError("TokenCore WASM 仍在加载，请稍候再试");
      return;
    }

    setBusy(true);
    try {
      if (mode === "unlock") {
        const ks = loadStoredKeystore();
        if (!ks) {
          setMode("create");
          setError("未找到本地钱包，请先创建");
          return;
        }
        const session = await unlockKeystore(ks, password, network);
        onConnected(session, password);
      } else {
        const session = await createPasswordWallet(
          password,
          network,
          mnemonic.trim() || undefined
        );
        onConnected(session, password, mnemonic.trim() || undefined);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "钱包操作失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div className="modal wallet-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <h2>
          {mode === "unlock" ? "解锁钱包" : mode === "import" ? "导入钱包" : "创建钱包"}
        </h2>
        <p className="desc">
          由 <strong>TokenCore</strong>（<code>tcx-wasm</code>）在浏览器内加密助记词，数据仅存于本机，不上传服务器。
        </p>

        {loadStoredKeystore() ? (
          <div className="segmented">
            <button
              type="button"
              className={mode === "unlock" ? "active" : ""}
              onClick={() => setMode("unlock")}
            >
              解锁
            </button>
            <button
              type="button"
              className={mode === "create" ? "active" : ""}
              onClick={() => setMode("create")}
            >
              新建
            </button>
            <button
              type="button"
              className={mode === "import" ? "active" : ""}
              onClick={() => setMode("import")}
            >
              导入
            </button>
          </div>
        ) : (
          <div className="segmented">
            <button
              type="button"
              className={mode === "create" ? "active" : ""}
              onClick={() => setMode("create")}
            >
              创建
            </button>
            <button
              type="button"
              className={mode === "import" ? "active" : ""}
              onClick={() => setMode("import")}
            >
              导入
            </button>
          </div>
        )}

        {mode !== "unlock" && (
          <div className="risk-box">
            <strong>安全提示</strong>
            <p>{RISK_TEXT}</p>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={riskAccepted}
                onChange={(e) => setRiskAccepted(e.target.checked)}
              />
              我已了解风险
            </label>
          </div>
        )}

        {mode === "import" && (
          <div className="field">
            <label htmlFor="mnemonic">助记词（12 / 24 词）</label>
            <textarea
              id="mnemonic"
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              placeholder="按空格分隔的英文单词"
              rows={3}
            />
            <button
              type="button"
              className="btn-outline btn-block"
              onClick={handleGenerateMnemonic}
              disabled={busy || loading}
            >
              一键生成助记词
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className="field">
            <label htmlFor="mnemonic-opt">助记词（可选，留空由 TokenCore 随机生成）</label>
            <textarea
              id="mnemonic-opt"
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              placeholder="留空则自动创建新助记词"
              rows={2}
            />
            <button
              type="button"
              className="btn-outline btn-block"
              onClick={handleGenerateMnemonic}
              disabled={busy || loading}
            >
              一键生成助记词
            </button>
          </div>
        )}

        <div className="field">
          <label htmlFor="password">钱包密码</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 8 位，仅用于本地加密"
            autoComplete={mode === "unlock" ? "current-password" : "new-password"}
          />
        </div>

        {mode !== "unlock" && (
          <div className="field">
            <label htmlFor="confirm">确认密码</label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        )}

        {loading && <p className="desc">TokenCore WASM 加载中…</p>}
        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={submit}
            disabled={busy || loading}
          >
            {busy ? "处理中…" : mode === "unlock" ? "解锁" : "创建并进入"}
          </button>
        </div>
      </div>
    </div>
  );
}
