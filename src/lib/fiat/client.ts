import type {
  FiatProviderPaymentMethod,
  FiatRouteDirection,
  FiatSessionStatus,
} from "@/lib/fiat/types";

type AccessTokenGetter = () => Promise<string | null>;

async function authed<T>(
  getAccessToken: AccessTokenGetter,
  input: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("Your session expired. Please log in again.");

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(input, {
    ...init,
    headers,
    cache: "no-store",
  });

  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || "Krypto121 fiat request failed");
  }

  return body;
}

export type FiatProviderConnection = {
  id: string;
  name: string;
  configured: boolean;
  status: "connected" | "not-configured" | "error";
  onramp: boolean;
  offramp: boolean;
  countries: number;
  errorCode?: string;
};

export async function checkFiatProviderConnections(
  getAccessToken: AccessTokenGetter,
) {
  return authed<{
    providers: FiatProviderConnection[];
    checkedAt: string;
  }>(getAccessToken, "/api/fiat/providers/status");
}

export type FiatUiAsset = {
  key: string;
  symbol: string;
  network: string;
  networkLabel: string;
};

export async function getFiatOptions(
  getAccessToken: AccessTokenGetter,
  input: {
    direction: FiatRouteDirection;
    countryCode?: string;
    subdivisionCode?: string;
    fiatCurrency?: string;
  },
) {
  const params = new URLSearchParams({
    direction: input.direction,
  });

  if (input.countryCode) params.set("countryCode", input.countryCode);
  if (input.subdivisionCode) params.set("subdivisionCode", input.subdivisionCode);
  if (input.fiatCurrency) params.set("fiatCurrency", input.fiatCurrency);

  return authed<{
    suggestedCountry?: string;
    suggestedSubdivision?: string;
    countries: string[];
    currencies: string[];
    assets: FiatUiAsset[];
    paymentMethods: FiatProviderPaymentMethod[];
  }>(getAccessToken, `/api/fiat/options?${params.toString()}`);
}

export type FiatUiQuote = {
  id: string;
  direction: FiatRouteDirection;
  providerName: string;
  sourceAmount: string;
  sourceSymbol: string;
  destinationAmount: string;
  destinationSymbol: string;
  fees: Array<{
    label: string;
    amount: string;
    assetSymbol: string;
  }>;
  expiresAt: string;
  cryptoNetworkLabel: string;
};

export async function createFiatQuote(
  getAccessToken: AccessTokenGetter,
  input: {
    direction: FiatRouteDirection;
    countryCode: string;
    subdivisionCode?: string;
    amount: string;
    fiatCurrency: string;
    cryptoAssetKey: string;
    walletAddress: `0x${string}`;
    paymentMethodId: string;
  },
) {
  return authed<{ quote: FiatUiQuote }>(
    getAccessToken,
    "/api/fiat/quote",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function createFiatSession(
  getAccessToken: AccessTokenGetter,
  quoteId: string,
) {
  return authed<{ sessionId: string; url: string }>(
    getAccessToken,
    "/api/fiat/session",
    {
      method: "POST",
      body: JSON.stringify({ quoteId }),
    },
  );
}

export async function readFiatSession(
  getAccessToken: AccessTokenGetter,
  sessionId: string,
) {
  return authed<{
    session: {
      id: string;
      providerName: string;
      status: FiatSessionStatus;
      sourceAmount?: string;
      destinationAmount?: string;
      transactionReference?: string;
      completedAt?: string;
    };
  }>(
    getAccessToken,
    `/api/fiat/session?id=${encodeURIComponent(sessionId)}`,
  );
}
