export type WatchWallet = {
  id: string;
  label: string;
  address: `0x${string}`;
  chainType: "ethereum";
  createdAt: string;
};

export type LinkedWalletView = {
  address: `0x${string}`;
  provider: string;
  connected: boolean;
};
