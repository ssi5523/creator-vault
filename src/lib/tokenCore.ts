import {
  broadcastRawTx,
  estimateGas,
  fetchGasPrice,
  fetchNonce,
  parseNativeAmount,
} from "./rpc";
import type { NetworkConfig } from "./networks";
import {
  ETH_PATH,
  cache_keystore,
  clear_cached_keystore,
  create_keystore,
  derive_accounts,
  export_mnemonic,
  initTcxWasm,
  sign_tx,
} from "./tcxWasm";

const STORAGE_KEY = "defivault-keystore";
const NETWORK_KEY = "defivault-network";
const BACKUP_KEY = "defivault-backup-done";
const PIN_KEY = "defivault-transfer-pin";

export interface EthAccount {
  address: string;
  chain: string;
  derivationPath: string;
  publicKey: string;
}

export interface WalletSession {
  address: string;
  keystoreJson: string;
  derivationPath: string;
}

export interface SignTxResult {
  signature?: string;
  signedTransaction?: string;
  rawTransaction?: string;
  txHash?: string;
}

export interface ContractTxPayload {
  to: string;
  from?: string;
  value: string;
  data: string;
  gas: string;
  gasPrice?: string;
  chainId: number;
}

function parseTcxJson(raw: string, fallback: string): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) throw new Error(fallback);
  if (trimmed.startsWith("{") && trimmed.includes('"error"')) {
    try {
      const obj = JSON.parse(trimmed) as { error?: string };
      if (obj.error) throw new Error(obj.error);
    } catch (e) {
      if (e instanceof Error && e.message !== fallback) throw e;
    }
  }
  return trimmed;
}

export async function ensureTcx(): Promise<void> {
  await initTcxWasm();
}

const LEGACY_KEYS = ["vaultguard-keystore", "easy-wallet-keystore"];

export function loadStoredKeystore(): string | null {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return current;
    for (const key of LEGACY_KEYS) {
      const legacy = localStorage.getItem(key);
      if (legacy) {
        localStorage.setItem(STORAGE_KEY, legacy);
        return legacy;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function saveKeystore(keystoreJson: string): void {
  localStorage.setItem(STORAGE_KEY, keystoreJson);
}

export function clearStoredKeystore(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(BACKUP_KEY);
  clear_cached_keystore();
}

export function isBackupConfirmed(): boolean {
  return localStorage.getItem(BACKUP_KEY) === "1";
}

export function markBackupConfirmed(): void {
  localStorage.setItem(BACKUP_KEY, "1");
}

export function loadStoredNetwork(): string | null {
  try {
    return localStorage.getItem(NETWORK_KEY);
  } catch {
    return null;
  }
}

export function saveStoredNetwork(id: string): void {
  localStorage.setItem(NETWORK_KEY, id);
}

export function hasTransferPin(): boolean {
  return !!localStorage.getItem(PIN_KEY);
}

export function setTransferPin(pin: string): void {
  if (!/^\d{6}$/.test(pin)) throw new Error("PIN 须为 6 位数字");
  localStorage.setItem(PIN_KEY, pin);
}

export function verifyTransferPin(pin: string): boolean {
  return localStorage.getItem(PIN_KEY) === pin;
}

export function clearTransferPin(): void {
  localStorage.removeItem(PIN_KEY);
}

export async function generateMnemonicPhrase(): Promise<string> {
  await ensureTcx();
  const tempPass = crypto.randomUUID();
  const entropy = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const keystoreJson = create_keystore(
    JSON.stringify({ password: tempPass, entropy, network: "MAINNET" })
  );
  const { mnemonic } = JSON.parse(
    export_mnemonic(JSON.stringify({ keystoreJson, key: tempPass }))
  ) as { mnemonic: string };
  clear_cached_keystore();
  if (!mnemonic) throw new Error("助记词生成失败");
  return mnemonic;
}

export async function exportWalletMnemonic(
  session: WalletSession,
  password: string
): Promise<string> {
  await ensureTcx();
  const { mnemonic } = JSON.parse(
    export_mnemonic(
      JSON.stringify({ keystoreJson: session.keystoreJson, key: password })
    )
  ) as { mnemonic: string };
  if (!mnemonic) throw new Error("无法导出助记词");
  return mnemonic;
}

export async function createPasswordWallet(
  password: string,
  network: NetworkConfig,
  mnemonic?: string
): Promise<WalletSession> {
  await ensureTcx();
  const param: Record<string, string> = {
    password,
    network: network.tcxNetwork,
  };
  if (mnemonic?.trim()) param.mnemonic = mnemonic.trim();
  const raw = create_keystore(JSON.stringify(param));
  const keystoreJson = parseTcxJson(raw, "创建 Keystore 失败");
  return unlockKeystore(keystoreJson, password, network, true);
}

export async function unlockKeystore(
  keystoreJson: string,
  password: string,
  network: NetworkConfig,
  persist = true
): Promise<WalletSession> {
  await ensureTcx();
  cache_keystore(keystoreJson);
  const accounts = JSON.parse(
    derive_accounts(
      JSON.stringify({
        key: password,
        derivations: [
          {
            chain: network.tcxChain,
            derivationPath: ETH_PATH,
            chainId: network.chainId,
            network: network.tcxNetwork,
          },
        ],
      })
    )
  ) as EthAccount[];

  const eth = accounts[0];
  if (!eth?.address) throw new Error("无法派生地址");

  if (persist) saveKeystore(keystoreJson);

  return {
    address: eth.address,
    keystoreJson,
    derivationPath: eth.derivationPath || ETH_PATH,
  };
}

export function disconnectWallet(): void {
  clear_cached_keystore();
}

export async function signContractTx(
  session: WalletSession,
  password: string,
  network: NetworkConfig,
  tx: ContractTxPayload
): Promise<SignTxResult> {
  await ensureTcx();
  cache_keystore(session.keystoreJson);

  const to = tx.to.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
    throw new Error("合约地址格式不正确");
  }

  const data = tx.data.startsWith("0x") ? tx.data : `0x${tx.data}`;
  const value = String(tx.value || "0");
  const nonce = await fetchNonce(network, session.address);
  const gasPrice = tx.gasPrice ?? (await fetchGasPrice(network));
  let gasLimit = tx.gas;
  if (!gasLimit) {
    try {
      gasLimit = await estimateGas(network, session.address, to, data, value);
    } catch {
      gasLimit = "300000";
    }
  }

  const result = JSON.parse(
    sign_tx(
      JSON.stringify({
        key: password,
        chain: network.tcxChain,
        derivationPath: session.derivationPath,
        input: {
          nonce,
          gasPrice: String(gasPrice),
          gasLimit: String(gasLimit),
          to,
          value,
          data,
          chainId: network.chainId,
        },
      })
    )
  ) as SignTxResult;

  if (!result.signature && !result.signedTransaction && !result.rawTransaction) {
    throw new Error("TokenCore 签名失败");
  }
  return result;
}

export async function signAndBroadcastContract(
  session: WalletSession,
  password: string,
  network: NetworkConfig,
  tx: ContractTxPayload
): Promise<{ txHash: string; rawTx: string }> {
  const signed = await signContractTx(session, password, network, tx);
  const rawTx = extractRawTransaction(signed);
  const txHash = await broadcastRawTx(network, rawTx);
  return { txHash, rawTx };
}

export async function signNativeTransfer(
  session: WalletSession,
  password: string,
  network: NetworkConfig,
  to: string,
  amount: string
): Promise<SignTxResult> {
  const valueWei = parseNativeAmount(amount);
  return signContractTx(session, password, network, {
    to: to.trim(),
    value: valueWei.toString(),
    data: "0x",
    gas: "21000",
    chainId: Number(network.chainId),
  });
}

export async function signAndBroadcastTransfer(
  session: WalletSession,
  password: string,
  network: NetworkConfig,
  to: string,
  amount: string
): Promise<{ txHash: string; rawTx: string }> {
  const signed = await signNativeTransfer(session, password, network, to, amount);
  const rawTx = extractRawTransaction(signed);
  const txHash = await broadcastRawTx(network, rawTx);
  return { txHash, rawTx };
}

export function extractRawTransaction(result: SignTxResult): string {
  const raw =
    result.signedTransaction || result.rawTransaction || result.signature || "";
  if (!raw) throw new Error("未获取到已签名交易");
  return raw.startsWith("0x") ? raw : `0x${raw}`;
}
