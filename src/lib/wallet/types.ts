export type WalletProviderKind = "privy" | "krypto-mpc";

export interface WalletProvider {
  kind: WalletProviderKind;
  address: `0x${string}`;
  chainId: number;
}
