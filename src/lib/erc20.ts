/** 最小 ERC20 编码（approve / balanceOf / allowance） */

const SELECTOR_APPROVE = "0x095ea7b3";
const SELECTOR_BALANCE = "0x70a08231";
const SELECTOR_ALLOWANCE = "0xdd62ed3e";

function padAddress(addr: string): string {
  return addr.toLowerCase().replace("0x", "").padStart(64, "0");
}

function padUint256(value: bigint): string {
  return value.toString(16).padStart(64, "0");
}

export function encodeApprove(spender: string, amount: bigint): string {
  return `${SELECTOR_APPROVE}${padAddress(spender)}${padUint256(amount)}`;
}

export function encodeBalanceOf(owner: string): string {
  return `${SELECTOR_BALANCE}${padAddress(owner)}`;
}

export function encodeAllowance(owner: string, spender: string): string {
  return `${SELECTOR_ALLOWANCE}${padAddress(owner)}${padAddress(spender)}`;
}

export function decodeUint256(hex: string): bigint {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!clean || clean === "0") return 0n;
  return BigInt(`0x${clean}`);
}
