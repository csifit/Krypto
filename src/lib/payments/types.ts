export type CryptoNetwork = "celo-sepolia" | "celo";

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
  sourceWallet: `0x${string}`;
  sourceAsset: PaymentAsset;
  destinationAsset: PaymentAsset;
  destination: string;
  destinationAmount?: string;
  maximumSourceAmount?: string;
  status: "draft" | "quoted" | "approved" | "executing" | "settled" | "failed";
}

export interface RouteStep {
  id: string;
  type: "transfer" | "swap" | "bridge" | "offramp" | "fx" | "cbdc-payout";
  provider: string;
  description: string;
}

export interface PaymentRoute {
  id: string;
  steps: RouteStep[];
  estimatedFee: string;
  estimatedDurationSeconds?: number;
}

export interface PaymentQuote {
  id: string;
  paymentIntentId: string;
  sourceAmount: string;
  destinationAmount: string;
  feeAmount: string;
  expiresAt: string;
  route: PaymentRoute;
}
