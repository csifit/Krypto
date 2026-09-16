import type {
  FiatCountrySupport,
  FiatCurrencySupport,
  FiatProviderAssetContext,
  FiatProviderContext,
  FiatProviderCurrencyContext,
  FiatProviderPaymentMethod,
  FiatQuote,
  FiatQuoteRequest,
  FiatSession,
  FiatSessionState,
  FiatSupportedCryptoAsset,
} from "@/lib/fiat/types";

export type FiatProviderErrorCode =
  | "unsupported"
  | "unavailable"
  | "invalid-request"
  | "authentication"
  | "rate-limited"
  | "provider-error";

export class FiatProviderError extends Error {
  constructor(
    message: string,
    public readonly code: FiatProviderErrorCode,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "FiatProviderError";
  }
}

export type CreateFiatSessionInput = {
  quote: FiatQuote;
  request: FiatQuoteRequest;
  partnerUserId: string;
  redirectUrl?: string;
};

export interface FiatProvider {
  readonly id: string;
  readonly displayName: string;

  getSupportedCountries(): Promise<
    FiatCountrySupport[]
  >;

  getSupportedCurrencies(
    context: FiatProviderContext,
  ): Promise<FiatCurrencySupport[]>;

  getSupportedAssets(
    context: FiatProviderCurrencyContext,
  ): Promise<FiatSupportedCryptoAsset[]>;

  getSupportedPaymentMethods(
    context: FiatProviderAssetContext,
  ): Promise<FiatProviderPaymentMethod[]>;

  getQuote(
    request: FiatQuoteRequest,
  ): Promise<FiatQuote>;

  createSession(
    input: CreateFiatSessionInput,
  ): Promise<FiatSession>;

  getStatus(
    providerSessionId: string,
  ): Promise<FiatSessionState>;
}
