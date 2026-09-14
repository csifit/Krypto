import type { Eip1193Provider, WalletProvider } from "./types";

type PrivyConnectedWallet = {
  address: string;
  switchChain(chainId: number): Promise<void>;
  getEthereumProvider(): Promise<unknown>;
};

export function createPrivyWalletProvider(
  wallet: PrivyConnectedWallet,
  chainId: number,
): WalletProvider {
  if (!wallet.address.startsWith("0x")) {
    throw new Error("Invalid EVM wallet address");
  }

  return {
    kind: "privy",
    address: wallet.address as `0x${string}`,
    chainId,
    switchChain: (nextChainId) => wallet.switchChain(nextChainId),
    getEip1193Provider: async () =>
      (await wallet.getEthereumProvider()) as Eip1193Provider,
  };
}
