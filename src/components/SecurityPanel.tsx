import { useState } from "react";
import { MAINNET_IDS } from "../lib/networks";
import {
  clearTransferPin,
  hasTransferPin,
  isBackupConfirmed,
  setTransferPin,
} from "../lib/tokenCore";

interface SecurityPanelProps {
  tcxReady: boolean;
  backupDone: boolean;
  onRequestBackup: () => void;
}

export default function SecurityPanel({
  tcxReady,
  backupDone,
  onRequestBackup,
}: SecurityPanelProps) {
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinEnabled, setPinEnabled] = useState(hasTransferPin);
  const [msg, setMsg] = useState("");

  const savePin = () => {
    setMsg("");
    if (pin !== pinConfirm) {
      setMsg("两次 PIN 不一致");
      return;
    }
    try {
      setTransferPin(pin);
      setPinEnabled(true);
      setPin("");
      setPinConfirm("");
      setMsg("转账 PIN 已启用，每次转账需额外验证");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "设置失败");
    }
  };

  const removePin = () => {
    clearTransferPin();
    setPinEnabled(false);
    setMsg("转账 PIN 已关闭");
  };

  return (
    <section className="security-panel">
      <div className="card">
        <h3>安全中心</h3>
        <ul className="security-checklist">
          <li className={tcxReady ? "ok" : "warn"}>
            <span>TokenCore WASM</span>
            <strong>{tcxReady ? "已加载" : "未就绪"}</strong>
          </li>
          <li className={backupDone ? "ok" : "warn"}>
            <span>助记词离线备份</span>
            <strong>{backupDone ? "已完成" : "未完成"}</strong>
          </li>
          <li className={pinEnabled ? "ok" : ""}>
            <span>转账二次验证 PIN</span>
            <strong>{pinEnabled ? "已启用" : "未设置"}</strong>
          </li>
        </ul>
        {!backupDone && (
          <button type="button" className="btn-outline btn-block" onClick={onRequestBackup}>
            立即备份助记词（离线抄写）
          </button>
        )}
      </div>

      <div className="card">
        <h4>转账 PIN（可选）</h4>
        <p className="desc">6 位数字，与钱包密码叠加，用于转账前的本地二次验证。</p>
        <div className="field">
          <label htmlFor="pin">新 PIN</label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div className="field">
          <label htmlFor="pin2">确认 PIN</label>
          <input
            id="pin2"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pinConfirm}
            onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div className="btn-row">
          <button type="button" className="btn-primary" onClick={savePin}>
            保存 PIN
          </button>
          {pinEnabled && (
            <button type="button" className="btn-secondary" onClick={removePin}>
              关闭 PIN
            </button>
          )}
        </div>
        {msg && <p className="form-hint">{msg}</p>}
      </div>

      <div className="card card-muted">
        <h4>多链说明</h4>
        <p className="desc">
          <strong>DeFi 主网（TokenCore 签名）：</strong> {MAINNET_IDS.join(" · ")}；测试网 Sepolia。
        </p>
        <p className="desc sol-note">
          授权 / 兑换 / 质押 / 投票均经二次确认与场景化风险提示；交互历史仅存本机。
        </p>
      </div>

      <div className="card card-muted">
        <h4>交易风险提示</h4>
        <ul className="bullet-list">
          <li>向合约地址转账前，请确认交互意图</li>
          <li>首次收款地址会提升风险等级并提示核对</li>
          <li>本应用不连接中心化账户系统，无法找回密码或助记词</li>
        </ul>
      </div>
    </section>
  );
}
