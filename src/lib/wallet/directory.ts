export type WatchWallet = {
  id: string;
  label: string;
  address: string;
  chainType: "ethereum" | "bitcoin";
  createdAt: string;
};

export type LinkedWalletView = {
  address: `0x${string}`;
  provider: string;
  connected: boolean;
};


export type WalletLabel = {
  address: `0x${string}`;
  label: string;
  updatedAt: string;
};
