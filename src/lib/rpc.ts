import type { NetworkConfig } from "./networks";

async function rpcCall<T>(network: NetworkConfig, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(network.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) {
    throw new Error(json.error.message || "RPC 请求失败");
  }
  if (json.result === undefined) {
    throw new Error("RPC 无返回数据");
  }
  return json.result;
}

export function parseNativeAmount(amount: string, decimals = 18): bigint {
  const trimmed = amount.trim();
  if (!trimmed || Number.isNaN(Number(trimmed)) || Number(trimmed) <= 0) {
    throw new Error("请输入有效金额");
  }
  const [whole, frac = ""] = trimmed.split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

export function formatNativeAmount(wei: bigint, decimals = 18, maxFrac = 6): string {
  const base = 10n ** BigInt(decimals);
  const whole = wei / base;
  const frac = wei % base;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  const shown = fracStr.slice(0, maxFrac);
  return shown ? `${whole}.${shown}` : whole.toString();
}

export async function fetchBalance(network: NetworkConfig, address: string): Promise<bigint> {
  const hex = await rpcCall<string>(network, "eth_getBalance", [address, "latest"]);
  return BigInt(hex);
}

export async function fetchNonce(network: NetworkConfig, address: string): Promise<string> {
  const hex = await rpcCall<string>(network, "eth_getTransactionCount", [address, "pending"]);
  return BigInt(hex).toString();
}

export async function fetchGasPrice(network: NetworkConfig): Promise<string> {
  const hex = await rpcCall<string>(network, "eth_gasPrice", []);
  return BigInt(hex).toString();
}

export async function fetchBytecode(network: NetworkConfig, address: string): Promise<string> {
  return rpcCall<string>(network, "eth_getCode", [address, "latest"]);
}

export async function broadcastRawTx(network: NetworkConfig, rawTx: string): Promise<string> {
  const tx = rawTx.startsWith("0x") ? rawTx : `0x${rawTx}`;
  return rpcCall<string>(network, "eth_sendRawTransaction", [tx]);
}

export function explorerTxUrl(network: NetworkConfig, hash: string): string {
  return `${network.explorer}/tx/${hash}`;
}

export function explorerAddressUrl(network: NetworkConfig, address: string): string {
  return `${network.explorer}/address/${address}`;
}

export async function ethCall(
  network: NetworkConfig,
  to: string,
  data: string,
  from?: string
): Promise<string> {
  const param: Record<string, string> = { to, data };
  if (from) param.from = from;
  return rpcCall<string>(network, "eth_call", [param, "latest"]);
}

export async function estimateGas(
  network: NetworkConfig,
  from: string,
  to: string,
  data: string,
  value = "0"
): Promise<string> {
  const hex = await rpcCall<string>(network, "eth_estimateGas", [
    { from, to, data, value: value === "0" ? "0x0" : `0x${BigInt(value).toString(16)}` },
  ]);
  return BigInt(hex).toString();
}
