import { useState } from "react";
import { riskLabel, type RiskLevel } from "../lib/security";
import type { DeFiRiskReport } from "../lib/defiRisk";
import { verifyTransferPin, hasTransferPin } from "../lib/tokenCore";
import { trackFundFlow } from "../lib/defiRisk";

interface DeFiConfirmModalProps {
  open: boolean;
  title: string;
  summary: { label: string; value: string }[];
  risk: DeFiRiskReport | null;
  from: string;
  to: string;
  value?: string;
  onClose: () => void;
  onConfirm: (password: string) => void;
  busy: boolean;
}

export default function DeFiConfirmModal({
  open,
  title,
  summary,
  risk,
  from,
  to,
  value,
  onClose,
  onConfirm,
  busy,
}: DeFiConfirmModalProps) {
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const level: RiskLevel = risk?.level ?? "medium";
  const requirePin = hasTransferPin();
  const flowLines = trackFundFlow(from, to, value);

  const submit = () => {
    setError("");
    if (!checked) {
      setError("Confirm you read the risk notice");
      return;
    }
    if (!password) {
      setError("Enter wallet password");
      return;
    }
    if (requirePin && !verifyTransferPin(pin)) {
      setError("Wrong PIN");
      return;
    }
    onConfirm(password);
  };

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div className="modal defi-confirm-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <h2>{title}</h2>
        <div className={`risk-alert risk-${level}`}>
          <strong>{risk ? riskLabel(risk.level) : "Checking"}</strong>
          {risk?.scenario && <span className="risk-tag">{risk.scenario.toUpperCase()}</span>}
          <ul>
            {(risk?.messages ?? ["Analyzing..."]).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          {flowLines.map((l) => (
            <p key={l} className="flow-line">
              {l}
            </p>
          ))}
        </div>
        <dl className="tx-summary">
          {summary.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd className={row.value.startsWith("0x") ? "mono" : ""}>{row.value}</dd>
            </div>
          ))}
        </dl>
        <label className="checkbox-row">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          I understand DeFi risks. TokenCore signs locally; nothing is uploaded.
        </label>
        {requirePin && (
          <div className="field">
            <label htmlFor="defi-pin">PIN</label>
            <input
              id="defi-pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="defi-pw">Wallet password</label>
          <input
            id="defi-pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Signing..." : "Confirm sign"}
          </button>
        </div>
      </div>
    </div>
  );
}
