import type { WalletProvider } from "./types";

export function createPrivyWalletProvider(
  address: string,
  chainId: number,
): WalletProvider {
  if (!address.startsWith("0x")) {
    throw new Error("Invalid EVM wallet address");
  }

  return {
    kind: "privy",
    address: address as `0x${string}`,
    chainId,
  };
}
