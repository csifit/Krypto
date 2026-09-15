export type RelayTransactionData = {
  from: `0x${string}`;
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
  chainId: number;
};

export type RelayExecutionItem = {
  status: string;
  data: RelayTransactionData;
};

export type RelayExecutionStep = {
  id: string;
  action?: string;
  description?: string;
  kind: "transaction";
  requestId?: string;
  items: RelayExecutionItem[];
};

export type KryptoRelayQuote = {
  requestId: string;
  sourceAmount: string;
  sourceAmountRaw: string;
  destinationAmount: string;
  destinationAmountRaw: string;
  routeCostAmount: string;
  estimatedDurationSeconds?: number;
  expiresAt: string;
  originChainId: 42220;
  destinationChainId: 8453;
  originCurrency: `0x${string}`;
  destinationCurrency: `0x${string}`;
  recipient: `0x${string}`;
  sourceWallet: `0x${string}`;
  steps: RelayExecutionStep[];
};

export type KryptoRelayStatus = {
  requestId: string;
  status:
    | "waiting"
    | "depositing"
    | "pending"
    | "submitted"
    | "success"
    | "failure"
    | "refund"
    | "fallback"
    | "unknown";
  originChainId?: number;
  destinationChainId?: number;
  inTxHashes: `0x${string}`[];
  txHashes: `0x${string}`[];
  destinationTxHash?: `0x${string}`;
};
