export type CryptoNetwork = "celo-sepolia" | "celo" | "base";

export interface CryptoAsset {
  type: "crypto";
  symbol: string;
  network: CryptoNetwork;
  contractAddress: `0x${string}`;
  decimals: number;
}

export interface FiatAsset {
  type: "fiat";
  symbol: string;
}

export interface CbdcAsset {
  type: "cbdc";
  symbol: string;
  provider: string;
}

export type PaymentAsset = CryptoAsset | FiatAsset | CbdcAsset;

export interface PaymentIntent {
  id: string;
  createdAt: string;
  sourceWallet: `0x${string}`;
  sourceAsset: PaymentAsset;
  destinationAsset: PaymentAsset;
  destination: string;
  sourceAmount: string;
  destinationAmount?: string;
  memo?: string;
  paymentRequestId?: string;
  status: "draft" | "quoted" | "approved" | "executing" | "settled" | "failed";
}

export interface RouteStep {
  id: string;
  type: "transfer" | "swap" | "bridge" | "offramp" | "fx" | "cbdc-payout";
  provider: string;
  description: string;
}

export interface RelayRouteMetadata {
  requestId: string;
  originChainId: number;
  destinationChainId: number;
  originCurrency: `0x${string}`;
  destinationCurrency: `0x${string}`;
  destinationTxHash?: `0x${string}`;
}

export interface PaymentRoute {
  id: string;
  kind: "direct-celo" | "relay" | "future-router";
  steps: RouteStep[];
  kryptoFeeAmount: string;
  networkFeeDescription: string;
  routeCostAmount?: string;
  estimatedDurationSeconds?: number;
  relay?: RelayRouteMetadata;
}

export interface PaymentQuote {
  id: string;
  createdAt: string;
  paymentIntentId: string;
  sourceAmount: string;
  destinationAmount: string;
  feeAmount: string;
  expiresAt: string;
  route: PaymentRoute;
}

export interface Beneficiary {
  id: string;
  name: string;
  address: `0x${string}`;
  createdAt: string;
}

export interface LocalPaymentRecord {
  id: string;
  intent: PaymentIntent;
  quote: PaymentQuote;
  txHash: `0x${string}`;
  status: "settled";
  settledAt: string;
  beneficiaryName?: string;
  beneficiaryPartnerId?: string;
  verification?: {
    onchain: true;
    chainId: number;
    blockNumber: string;
    verifiedAt: string;
  };
}
