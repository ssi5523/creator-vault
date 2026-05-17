import type { NetworkId } from "./networks";
import type { DeFiScenario } from "./defiContracts";

export interface TxHistoryRecord {
  id: string;
  timestamp: number;
  networkId: NetworkId;
  scenario: DeFiScenario | "transfer";
  action: string;
  from: string;
  to: string;
  value?: string;
  data?: string;
  txHash?: string;
  rawTx?: string;
  riskLevel?: string;
  meta?: Record<string, string>;
}

const KEY = "defivault-tx-history";
const MAX = 200;

function loadAll(): TxHistoryRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TxHistoryRecord[];
  } catch {
    return [];
  }
}

function saveAll(list: TxHistoryRecord[]): void {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

export function appendHistory(record: Omit<TxHistoryRecord, "id" | "timestamp">): TxHistoryRecord {
  const entry: TxHistoryRecord = {
    ...record,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  const list = [entry, ...loadAll()];
  saveAll(list);
  return entry;
}

export function updateHistoryTxHash(id: string, txHash: string, rawTx?: string): void {
  const list = loadAll().map((r) =>
    r.id === id ? { ...r, txHash, rawTx: rawTx ?? r.rawTx } : r
  );
  saveAll(list);
}

export function getHistory(networkId?: NetworkId): TxHistoryRecord[] {
  const list = loadAll();
  if (!networkId) return list;
  return list.filter((r) => r.networkId === networkId);
}

export function clearHistory(): void {
  localStorage.removeItem(KEY);
}

export function exportHistoryJson(): string {
  return JSON.stringify(loadAll(), null, 2);
}

export function downloadHistoryExport(): void {
  const blob = new Blob([exportHistoryJson()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `defivault-history-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
