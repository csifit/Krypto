export type WalletProviderKind = "privy" | "krypto-mpc";

export interface Eip1193Provider {
  request(args: {
    method: string;
    params?: readonly unknown[] | Record<string, unknown>;
  }): Promise<unknown>;
}

export interface WalletProvider {
  kind: WalletProviderKind;
  address: `0x${string}`;
  chainId: number;
  switchChain(chainId: number): Promise<void>;
  getEip1193Provider(): Promise<Eip1193Provider>;
}

export interface PaymentSourceWallet {
  id: string;
  label: string;
  provider: string;
  embedded: boolean;
  wallet: WalletProvider;
}
