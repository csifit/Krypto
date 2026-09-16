import type {
  CryptoAsset,
  FiatAsset,
  PaymentAsset,
} from "@/lib/payments/types";

export type FiatRouteDirection =
  | "fiat-to-crypto"
  | "crypto-to-fiat";

export type FiatQuoteAmountSide =
  | "source"
  | "destination";

export type FiatProviderAvailability =
  | "available"
  | "unavailable";

export type FiatProviderPaymentMethod = {
  id: string;
  label: string;
  type:
    | "bank"
    | "card"
    | "wallet"
    | "instant-bank"
    | "other";
};

export type FiatSupportedCryptoAsset = {
  symbol: string;
  network: string;
  contractAddress?: `0x${string}`;
};

export type FiatProviderFee = {
  label: string;
  amount: string;
  assetSymbol: string;
};

export type FiatQuoteRequest = {
  direction: FiatRouteDirection;
  countryCode: string;
  subdivisionCode?: string;
  sourceAsset: PaymentAsset;
  destinationAsset: PaymentAsset;
  amount: string;
  amountSide: FiatQuoteAmountSide;
  sourceWallet?: `0x${string}`;
  destinationWallet?: `0x${string}`;
  paymentMethodId?: string;
  clientIp?: string;
};

export type FiatQuote = {
  id: string;
  providerId: string;
  providerName: string;
  providerQuoteId: string;
  direction: FiatRouteDirection;
  sourceAsset: PaymentAsset;
  destinationAsset: PaymentAsset;
  amountSide: FiatQuoteAmountSide;
  sourceAmount: string;
  destinationAmount: string;
  fees: FiatProviderFee[];
  exchangeRate?: string;
  estimatedDurationSeconds?: number;
  expiresAt: string;
  availability: FiatProviderAvailability;
  unavailableReason?: string;
};

export type FiatSessionStatus =
  | "created"
  | "awaiting-user"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export type FiatSession = {
  providerId: string;
  providerSessionId: string;
  quoteId: string;
  url?: string;
  status: FiatSessionStatus;
  expiresAt?: string;
};

export type FiatSessionState = {
  providerId: string;
  providerSessionId: string;
  status: FiatSessionStatus;
  sourceAmount?: string;
  destinationAmount?: string;
  transactionReference?: string;
  completedAt?: string;
};

export type FiatCountrySupport = {
  countryCode: string;
  directions: FiatRouteDirection[];
};

export type FiatCurrencySupport = {
  symbol: string;
  directions: FiatRouteDirection[];
};

export type FiatProviderContext = {
  direction: FiatRouteDirection;
  countryCode: string;
  subdivisionCode?: string;
};

export type FiatProviderCurrencyContext =
  FiatProviderContext & {
    fiatCurrency: string;
  };

export type FiatProviderAssetContext =
  FiatProviderCurrencyContext & {
    paymentMethodId?: string;
  };

export function isFiatAsset(
  asset: PaymentAsset,
): asset is FiatAsset {
  return asset.type === "fiat";
}

export function isCryptoAsset(
  asset: PaymentAsset,
): asset is CryptoAsset {
  return asset.type === "crypto";
}
