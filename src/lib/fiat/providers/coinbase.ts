import { createHash, randomUUID } from "node:crypto";
import { generateJwt } from "@coinbase/cdp-sdk/auth";
import type {
  CreateFiatSessionInput,
  FiatProvider,
} from "@/lib/fiat/provider";
import { FiatProviderError } from "@/lib/fiat/provider";
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
  FiatRouteDirection,
} from "@/lib/fiat/types";
import {
  isCryptoAsset,
  isFiatAsset,
} from "@/lib/fiat/types";
import type { CryptoAsset } from "@/lib/payments/types";

const COINBASE_API_HOST = "api.developer.coinbase.com";
const COINBASE_API_BASE = `https://${COINBASE_API_HOST}`;
const COINBASE_ONRAMP_URL =
  "https://pay.coinbase.com/buy/select-asset";
const COINBASE_OFFRAMP_URL =
  "https://pay.coinbase.com/v3/sell/input";

const DISCOVERY_CACHE_MS = 5 * 60 * 1000;
const LOCAL_QUOTE_FRESHNESS_MS = 60 * 1000;
const SESSION_TOKEN_LIFETIME_MS = 5 * 60 * 1000;

const CHAIN_IDS: Record<string, number> = {
  "celo-sepolia": 11142220,
  celo: 42220,
  base: 8453,
};

type CoinbaseMoney = {
  value?: string;
  amount?: string;
  currency?: string;
};

type CoinbaseConfigCountry = {
  id?: string;
  payment_methods?: Array<{ id?: string }>;
  subdivisions?: string[];
};

type CoinbaseConfigPayload = {
  countries?: CoinbaseConfigCountry[];
};

type CoinbasePaymentMethodLimit = {
  id?: string;
  min?: string;
  max?: string;
};

type CoinbaseFiatOption = {
  id?: string;
  limits?: CoinbasePaymentMethodLimit[];
  payment_method_limits?: CoinbasePaymentMethodLimit[];
};

type CoinbaseNetworkOption = {
  name?: string;
  display_name?: string;
  chain_id?: string | number;
  contract_address?: string;
};

type CoinbaseCryptoOption = {
  id?: string;
  name?: string;
  symbol?: string;
  networks?: CoinbaseNetworkOption[];
};

type CoinbaseOptionsPayload = {
  payment_currencies?: CoinbaseFiatOption[];
  purchase_currencies?: CoinbaseCryptoOption[];
  cashout_currencies?: CoinbaseFiatOption[];
  sell_currencies?: CoinbaseCryptoOption[];
};

type CoinbaseBuyQuotePayload = {
  quote_id?: string;
  payment_total?: CoinbaseMoney;
  payment_subtotal?: CoinbaseMoney;
  purchase_amount?: CoinbaseMoney;
  coinbase_fee?: CoinbaseMoney;
  network_fee?: CoinbaseMoney;
};

type CoinbaseSellQuotePayload = {
  quote_id?: string;
  sell_amount?: CoinbaseMoney;
  cashout_subtotal?: CoinbaseMoney;
  cashout_total?: CoinbaseMoney;
  coinbase_fee?: CoinbaseMoney;
};

type CoinbaseTokenPayload = {
  token?: string;
  channel_id?: string;
};

type CoinbaseTransaction = Record<string, unknown>;

type CoinbaseTransactionsPayload = {
  transactions?: CoinbaseTransaction[];
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

function unwrapData<T>(input: unknown): T {
  if (
    input &&
    typeof input === "object" &&
    "data" in input &&
    (input as { data?: unknown }).data &&
    typeof (input as { data?: unknown }).data === "object"
  ) {
    return (input as { data: T }).data;
  }

  return input as T;
}

function moneyValue(value: CoinbaseMoney | undefined) {
  const amount = value?.value ?? value?.amount;
  return typeof amount === "string" ? amount : undefined;
}

function moneyCurrency(value: CoinbaseMoney | undefined) {
  return typeof value?.currency === "string"
    ? value.currency
    : undefined;
}

function normalizedMethodId(value: string) {
  return value.trim().toUpperCase();
}

function paymentMethodView(
  id: string,
): FiatProviderPaymentMethod {
  const normalized = normalizedMethodId(id);

  const labels: Record<string, string> = {
    CARD: "Card",
    GUEST_CHECKOUT_CARD: "Card",
    ACH_BANK_ACCOUNT: "ACH bank account",
    APPLE_PAY: "Apple Pay",
    GUEST_CHECKOUT_APPLE_PAY: "Apple Pay",
    GOOGLE_PAY: "Google Pay",
    GUEST_CHECKOUT_GOOGLE_PAY: "Google Pay",
    PAYPAL: "PayPal",
    FIAT_WALLET: "Coinbase fiat balance",
    CRYPTO_ACCOUNT: "Coinbase crypto balance",
    RTP: "Instant bank payment",
    UNSPECIFIED: "Available payment method",
  };

  let type: FiatProviderPaymentMethod["type"] = "other";

  if (
    normalized === "CARD" ||
    normalized === "GUEST_CHECKOUT_CARD"
  ) {
    type = "card";
  } else if (normalized === "ACH_BANK_ACCOUNT") {
    type = "bank";
  } else if (normalized === "RTP") {
    type = "instant-bank";
  } else if (
    normalized.includes("PAY") ||
    normalized.endsWith("WALLET") ||
    normalized === "CRYPTO_ACCOUNT"
  ) {
    type = "wallet";
  }

  return {
    id: normalized,
    label: labels[normalized] ?? normalized,
    type,
  };
}

function networkChainId(network: string) {
  return CHAIN_IDS[network];
}

function asHexAddress(value: string | undefined) {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    return undefined;
  }

  return value as `0x${string}`;
}

function readString(
  input: CoinbaseTransaction,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

function readMoney(
  input: CoinbaseTransaction,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = input[key];
    if (!value || typeof value !== "object") continue;

    const record = value as Record<string, unknown>;
    const amount = record.value ?? record.amount;
    if (typeof amount === "string") return amount;
  }
  return undefined;
}

function mapTransactionStatus(status: string | undefined) {
  const normalized = status?.toUpperCase() ?? "";

  if (normalized.includes("SUCCESS")) return "completed" as const;
  if (normalized.includes("FAILED")) return "failed" as const;
  if (normalized.includes("CANCEL")) return "cancelled" as const;
  if (normalized.includes("EXPIRED")) return "expired" as const;
  if (normalized.includes("CREATED")) return "awaiting-user" as const;
  if (normalized.includes("STARTED")) return "processing" as const;
  if (normalized.includes("PROGRESS")) return "processing" as const;

  return "processing" as const;
}

function makePartnerUserRef(partnerUserId: string) {
  const fingerprint = createHash("sha256")
    .update(partnerUserId)
    .digest("hex")
    .slice(0, 8);

  return `k121-${fingerprint}-${randomUUID()}`;
}

function parseProviderSessionId(value: string) {
  const separator = value.indexOf(":");
  if (separator <= 0) {
    throw new FiatProviderError(
      "Invalid Coinbase session reference",
      "invalid-request",
    );
  }

  const side = value.slice(0, separator);
  const partnerUserRef = value.slice(separator + 1);

  if (
    (side !== "buy" && side !== "sell") ||
    !partnerUserRef
  ) {
    throw new FiatProviderError(
      "Invalid Coinbase session reference",
      "invalid-request",
    );
  }

  return {
    side: side as "buy" | "sell",
    partnerUserRef,
  };
}

export function coinbaseFiatIsConfigured() {
  return Boolean(
    process.env.COINBASE_CDP_API_KEY_ID?.trim() &&
      process.env.COINBASE_CDP_API_KEY_SECRET?.trim(),
  );
}

export class CoinbaseFiatProvider implements FiatProvider {
  readonly id = "coinbase";
  readonly displayName = "Coinbase";

  private readonly configCache = new Map<
    "buy" | "sell",
    CacheEntry<CoinbaseConfigPayload>
  >();

  private readonly optionsCache = new Map<
    string,
    CacheEntry<CoinbaseOptionsPayload>
  >();

  private credentials() {
    const apiKeyId =
      process.env.COINBASE_CDP_API_KEY_ID?.trim();
    const rawSecret =
      process.env.COINBASE_CDP_API_KEY_SECRET?.trim();

    if (!apiKeyId || !rawSecret) {
      throw new FiatProviderError(
        "Coinbase CDP credentials are not configured",
        "authentication",
      );
    }

    return {
      apiKeyId,
      apiKeySecret: rawSecret.replace(/\\n/g, "\n"),
    };
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    options: {
      query?: Record<string, string | undefined>;
      body?: Record<string, unknown>;
    } = {},
  ): Promise<T> {
    const url = new URL(path, COINBASE_API_BASE);

    for (const [key, value] of Object.entries(
      options.query ?? {},
    )) {
      if (value) url.searchParams.set(key, value);
    }

    const { apiKeyId, apiKeySecret } = this.credentials();

    const jwt = await generateJwt({
      apiKeyId,
      apiKeySecret,
      requestMethod: method,
      requestHost: COINBASE_API_HOST,
      requestPath: url.pathname,
      expiresIn: 120,
    });

    let response: Response;

    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body:
          method === "POST"
            ? JSON.stringify(options.body ?? {})
            : undefined,
        cache: "no-store",
      });
    } catch {
      throw new FiatProviderError(
        "Coinbase is currently unavailable",
        "unavailable",
        true,
      );
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new FiatProviderError(
          "Coinbase authentication failed",
          "authentication",
        );
      }

      if (response.status === 429) {
        throw new FiatProviderError(
          "Coinbase rate limit reached",
          "rate-limited",
          true,
        );
      }

      if (response.status >= 500) {
        throw new FiatProviderError(
          "Coinbase is currently unavailable",
          "provider-error",
          true,
        );
      }

      if (response.status === 400 || response.status === 422) {
        throw new FiatProviderError(
          "Coinbase rejected the requested fiat route",
          "invalid-request",
        );
      }

      throw new FiatProviderError(
        `Coinbase request failed with HTTP ${response.status}`,
        "provider-error",
      );
    }

    return (await response.json()) as T;
  }

  private side(direction: FiatRouteDirection) {
    return direction === "fiat-to-crypto"
      ? ("buy" as const)
      : ("sell" as const);
  }

  private async config(side: "buy" | "sell") {
    const cached = this.configCache.get(side);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const response = await this.request<unknown>(
      "GET",
      `/onramp/v1/${side}/config`,
    );
    const value = unwrapData<CoinbaseConfigPayload>(response);

    this.configCache.set(side, {
      value,
      expiresAt: Date.now() + DISCOVERY_CACHE_MS,
    });

    return value;
  }

  private async options(context: FiatProviderContext) {
    const side = this.side(context.direction);
    const key = [
      side,
      context.countryCode,
      context.subdivisionCode ?? "",
    ].join(":");

    const cached = this.optionsCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const response = await this.request<unknown>(
      "GET",
      `/onramp/v1/${side}/options`,
      {
        query: {
          country: context.countryCode,
          subdivision: context.subdivisionCode,
        },
      },
    );
    const value = unwrapData<CoinbaseOptionsPayload>(response);

    this.optionsCache.set(key, {
      value,
      expiresAt: Date.now() + DISCOVERY_CACHE_MS,
    });

    return value;
  }

  private validateLocation(context: FiatProviderContext) {
    if (!/^[A-Z]{2}$/.test(context.countryCode)) {
      throw new FiatProviderError(
        "Coinbase requires a two-letter country code",
        "invalid-request",
      );
    }

    if (
      context.countryCode === "US" &&
      !context.subdivisionCode
    ) {
      throw new FiatProviderError(
        "Coinbase requires a US state code",
        "invalid-request",
      );
    }
  }

  private fiatOptions(
    direction: FiatRouteDirection,
    options: CoinbaseOptionsPayload,
  ) {
    return direction === "fiat-to-crypto"
      ? options.payment_currencies ?? []
      : options.cashout_currencies ?? [];
  }

  private cryptoOptions(
    direction: FiatRouteDirection,
    options: CoinbaseOptionsPayload,
  ) {
    return direction === "fiat-to-crypto"
      ? options.purchase_currencies ?? []
      : options.sell_currencies ?? [];
  }

  private resolveCryptoAsset(
    asset: CryptoAsset,
    available: CoinbaseCryptoOption[],
  ) {
    const chainId = networkChainId(asset.network);

    if (!chainId) {
      throw new FiatProviderError(
        `Coinbase route does not recognize network ${asset.network}`,
        "unsupported",
      );
    }

    const matchingAsset = available.find(
      (option) =>
        option.symbol?.toUpperCase() ===
        asset.symbol.toUpperCase(),
    );

    if (!matchingAsset) {
      throw new FiatProviderError(
        `${asset.symbol} is not available through Coinbase for this location`,
        "unsupported",
      );
    }

    const matchingNetwork = matchingAsset.networks?.find(
      (network) => {
        if (Number(network.chain_id) !== chainId) return false;

        const providerContract =
          network.contract_address?.toLowerCase();

        return (
          !providerContract ||
          providerContract === asset.contractAddress.toLowerCase()
        );
      },
    );

    if (!matchingNetwork?.name) {
      throw new FiatProviderError(
        `${asset.symbol} on ${asset.network} is not available through Coinbase for this location`,
        "unsupported",
      );
    }

    return {
      assetId: matchingAsset.id ?? asset.symbol,
      assetSymbol: matchingAsset.symbol ?? asset.symbol,
      networkName: matchingNetwork.name,
    };
  }

  async getSupportedCountries(): Promise<
    FiatCountrySupport[]
  > {
    const [buy, sell] = await Promise.all([
      this.config("buy"),
      this.config("sell"),
    ]);

    const directions = new Map<
      string,
      Set<FiatRouteDirection>
    >();

    for (const country of buy.countries ?? []) {
      if (!country.id) continue;
      const set = directions.get(country.id) ?? new Set();
      set.add("fiat-to-crypto");
      directions.set(country.id, set);
    }

    for (const country of sell.countries ?? []) {
      if (!country.id) continue;
      const set = directions.get(country.id) ?? new Set();
      set.add("crypto-to-fiat");
      directions.set(country.id, set);
    }

    return [...directions.entries()]
      .map(([countryCode, values]) => ({
        countryCode,
        directions: [...values],
      }))
      .sort((left, right) =>
        left.countryCode.localeCompare(right.countryCode),
      );
  }

  async getSupportedCurrencies(
    context: FiatProviderContext,
  ): Promise<FiatCurrencySupport[]> {
    this.validateLocation(context);
    const options = await this.options(context);

    return this.fiatOptions(context.direction, options)
      .filter((currency) => Boolean(currency.id))
      .map((currency) => ({
        symbol: currency.id!,
        directions: [context.direction],
      }));
  }

  async getSupportedAssets(
    context: FiatProviderCurrencyContext,
  ): Promise<FiatSupportedCryptoAsset[]> {
    this.validateLocation(context);
    const options = await this.options(context);
    const fiatAvailable = this.fiatOptions(
      context.direction,
      options,
    ).some(
      (currency) =>
        currency.id?.toUpperCase() ===
        context.fiatCurrency.toUpperCase(),
    );

    if (!fiatAvailable) return [];

    const assets: FiatSupportedCryptoAsset[] = [];

    for (const asset of this.cryptoOptions(
      context.direction,
      options,
    )) {
      if (!asset.symbol) continue;

      for (const network of asset.networks ?? []) {
        if (!network.name) continue;

        assets.push({
          symbol: asset.symbol,
          network: network.name,
          contractAddress: asHexAddress(
            network.contract_address,
          ),
        });
      }
    }

    return assets;
  }

  async getSupportedPaymentMethods(
    context: FiatProviderAssetContext,
  ): Promise<FiatProviderPaymentMethod[]> {
    this.validateLocation(context);
    const options = await this.options(context);
    const currency = this.fiatOptions(
      context.direction,
      options,
    ).find(
      (item) =>
        item.id?.toUpperCase() ===
        context.fiatCurrency.toUpperCase(),
    );

    if (!currency) return [];

    const ids = new Set(
      [
        ...(currency.limits ?? []),
        ...(currency.payment_method_limits ?? []),
      ]
        .map((limit) => limit.id)
        .filter((id): id is string => Boolean(id)),
    );

    return [...ids].map(paymentMethodView);
  }

  async getQuote(
    request: FiatQuoteRequest,
  ): Promise<FiatQuote> {
    this.validateLocation(request);

    if (request.amountSide !== "source") {
      throw new FiatProviderError(
        "Coinbase v1 hosted quotes currently support exact-source routing in Krypto121",
        "unsupported",
      );
    }

    if (!request.paymentMethodId) {
      throw new FiatProviderError(
        "Choose a fiat payment method before requesting a Coinbase quote",
        "invalid-request",
      );
    }

    const options = await this.options(request);
    const paymentMethod = normalizedMethodId(
      request.paymentMethodId,
    );
    const expiresAt = new Date(
      Date.now() + LOCAL_QUOTE_FRESHNESS_MS,
    ).toISOString();

    if (request.direction === "fiat-to-crypto") {
      if (
        !isFiatAsset(request.sourceAsset) ||
        !isCryptoAsset(request.destinationAsset)
      ) {
        throw new FiatProviderError(
          "Coinbase onramp requires fiat source and crypto destination",
          "invalid-request",
        );
      }

      if (!request.destinationWallet) {
        throw new FiatProviderError(
          "Coinbase onramp requires a destination wallet",
          "invalid-request",
        );
      }

      const providerAsset = this.resolveCryptoAsset(
        request.destinationAsset,
        this.cryptoOptions(request.direction, options),
      );

      const response = unwrapData<CoinbaseBuyQuotePayload>(
        await this.request<unknown>(
          "POST",
          "/onramp/v1/buy/quote",
          {
            body: {
              country: request.countryCode,
              paymentAmount: request.amount,
              paymentCurrency: request.sourceAsset.symbol,
              paymentMethod,
              purchaseCurrency: providerAsset.assetId,
              purchaseNetwork: providerAsset.networkName,
              subdivision: request.subdivisionCode,
              destinationAddress: request.destinationWallet,
              clientIp: request.clientIp,
            },
          },
        ),
      );

      const quoteId = response.quote_id;
      const sourceAmount = moneyValue(response.payment_total);
      const destinationAmount = moneyValue(
        response.purchase_amount,
      );

      if (!quoteId || !sourceAmount || !destinationAmount) {
        throw new FiatProviderError(
          "Coinbase returned an incomplete onramp quote",
          "provider-error",
          true,
        );
      }

      const feeCurrency =
        moneyCurrency(response.payment_total) ??
        request.sourceAsset.symbol;

      const fees = [
        {
          label: "Coinbase fee",
          amount: moneyValue(response.coinbase_fee),
        },
        {
          label: "Network fee",
          amount: moneyValue(response.network_fee),
        },
      ]
        .filter(
          (fee): fee is { label: string; amount: string } =>
            Boolean(fee.amount),
        )
        .map((fee) => ({
          ...fee,
          assetSymbol: feeCurrency,
        }));

      return {
        id: randomUUID(),
        providerId: this.id,
        providerName: this.displayName,
        providerQuoteId: quoteId,
        direction: request.direction,
        sourceAsset: request.sourceAsset,
        destinationAsset: request.destinationAsset,
        amountSide: request.amountSide,
        sourceAmount,
        destinationAmount,
        fees,
        expiresAt,
        availability: "available",
      };
    }

    if (
      !isCryptoAsset(request.sourceAsset) ||
      !isFiatAsset(request.destinationAsset)
    ) {
      throw new FiatProviderError(
        "Coinbase offramp requires crypto source and fiat destination",
        "invalid-request",
      );
    }

    if (!request.sourceWallet) {
      throw new FiatProviderError(
        "Coinbase offramp requires a source wallet",
        "invalid-request",
      );
    }

    const providerAsset = this.resolveCryptoAsset(
      request.sourceAsset,
      this.cryptoOptions(request.direction, options),
    );

    const response = unwrapData<CoinbaseSellQuotePayload>(
      await this.request<unknown>(
        "POST",
        "/onramp/v1/sell/quote",
        {
          body: {
            cashoutCurrency: request.destinationAsset.symbol,
            country: request.countryCode,
            paymentMethod,
            sellAmount: request.amount,
            sellCurrency: providerAsset.assetId,
            sellNetwork: providerAsset.networkName,
            sourceAddress: request.sourceWallet,
            subdivision: request.subdivisionCode,
            clientIp: request.clientIp,
          },
        },
      ),
    );

    const quoteId = response.quote_id;
    const sourceAmount = moneyValue(response.sell_amount);
    const destinationAmount = moneyValue(
      response.cashout_total,
    );

    if (!quoteId || !sourceAmount || !destinationAmount) {
      throw new FiatProviderError(
        "Coinbase returned an incomplete offramp quote",
        "provider-error",
        true,
      );
    }

    const feeAmount = moneyValue(response.coinbase_fee);
    const feeCurrency =
      moneyCurrency(response.coinbase_fee) ??
      request.destinationAsset.symbol;

    return {
      id: randomUUID(),
      providerId: this.id,
      providerName: this.displayName,
      providerQuoteId: quoteId,
      direction: request.direction,
      sourceAsset: request.sourceAsset,
      destinationAsset: request.destinationAsset,
      amountSide: request.amountSide,
      sourceAmount,
      destinationAmount,
      fees: feeAmount
        ? [
            {
              label: "Coinbase fee",
              amount: feeAmount,
              assetSymbol: feeCurrency,
            },
          ]
        : [],
      expiresAt,
      availability: "available",
    };
  }

  async createSession(
    input: CreateFiatSessionInput,
  ): Promise<FiatSession> {
    if (input.quote.providerId !== this.id) {
      throw new FiatProviderError(
        "Quote does not belong to Coinbase",
        "invalid-request",
      );
    }

    if (!input.request.clientIp) {
      throw new FiatProviderError(
        "Coinbase session creation requires the end-user client IP",
        "invalid-request",
      );
    }

    if (
      input.request.direction === "crypto-to-fiat" &&
      !input.redirectUrl
    ) {
      throw new FiatProviderError(
        "Coinbase offramp requires a redirect URL",
        "invalid-request",
      );
    }

    const options = await this.options(input.request);
    const cryptoAsset =
      input.request.direction === "fiat-to-crypto"
        ? input.request.destinationAsset
        : input.request.sourceAsset;

    if (!isCryptoAsset(cryptoAsset)) {
      throw new FiatProviderError(
        "Coinbase session requires a crypto asset",
        "invalid-request",
      );
    }

    const providerAsset = this.resolveCryptoAsset(
      cryptoAsset,
      this.cryptoOptions(input.request.direction, options),
    );

    const walletAddress =
      input.request.direction === "fiat-to-crypto"
        ? input.request.destinationWallet
        : input.request.sourceWallet;

    if (!walletAddress) {
      throw new FiatProviderError(
        "Coinbase session is missing the required wallet address",
        "invalid-request",
      );
    }

    const tokenResponse = unwrapData<CoinbaseTokenPayload>(
      await this.request<unknown>(
        "POST",
        "/onramp/v1/token",
        {
          body: {
            addresses: [
              {
                address: walletAddress,
                blockchains: [providerAsset.networkName],
              },
            ],
            assets: [providerAsset.assetId],
            clientIp: input.request.clientIp,
          },
        },
      ),
    );

    if (!tokenResponse.token) {
      throw new FiatProviderError(
        "Coinbase did not return a session token",
        "provider-error",
        true,
      );
    }

    const partnerUserRef = makePartnerUserRef(
      input.partnerUserId,
    );
    const side =
      input.request.direction === "fiat-to-crypto"
        ? "buy"
        : "sell";
    const url = new URL(
      side === "buy"
        ? COINBASE_ONRAMP_URL
        : COINBASE_OFFRAMP_URL,
    );

    url.searchParams.set(
      "sessionToken",
      tokenResponse.token,
    );
    url.searchParams.set(
      "partnerUserRef",
      partnerUserRef,
    );
    url.searchParams.set(
      "quoteId",
      input.quote.providerQuoteId,
    );

    if (input.redirectUrl) {
      url.searchParams.set("redirectUrl", input.redirectUrl);
    }

    if (side === "buy") {
      url.searchParams.set(
        "defaultNetwork",
        providerAsset.networkName,
      );
      url.searchParams.set(
        "defaultAsset",
        providerAsset.assetSymbol,
      );
      url.searchParams.set(
        "presetFiatAmount",
        input.request.amount,
      );

      if (isFiatAsset(input.request.sourceAsset)) {
        url.searchParams.set(
          "fiatCurrency",
          input.request.sourceAsset.symbol,
        );
      }

      if (input.request.paymentMethodId) {
        url.searchParams.set(
          "defaultPaymentMethod",
          normalizedMethodId(
            input.request.paymentMethodId,
          ),
        );
      }
    }

    return {
      providerId: this.id,
      providerSessionId: `${side}:${partnerUserRef}`,
      quoteId: input.quote.id,
      url: url.toString(),
      status: "created",
      expiresAt: new Date(
        Date.now() + SESSION_TOKEN_LIFETIME_MS,
      ).toISOString(),
    };
  }

  async getStatus(
    providerSessionId: string,
  ): Promise<FiatSessionState> {
    const { side, partnerUserRef } =
      parseProviderSessionId(providerSessionId);

    const response = unwrapData<CoinbaseTransactionsPayload>(
      await this.request<unknown>(
        "GET",
        `/onramp/v1/${side}/user/${encodeURIComponent(
          partnerUserRef,
        )}/transactions`,
        {
          query: { pageSize: "1" },
        },
      ),
    );

    const transaction = response.transactions?.[0];

    if (!transaction) {
      return {
        providerId: this.id,
        providerSessionId,
        status: "awaiting-user",
      };
    }

    const rawStatus = readString(transaction, "status");
    const status = mapTransactionStatus(rawStatus);
    const transactionReference =
      readString(transaction, "tx_hash", "txHash") ??
      readString(
        transaction,
        "transaction_id",
        "transactionId",
        "id",
      );

    if (side === "buy") {
      return {
        providerId: this.id,
        providerSessionId,
        status,
        sourceAmount: readMoney(
          transaction,
          "payment_total",
          "paymentTotal",
        ),
        destinationAmount: readMoney(
          transaction,
          "purchase_amount",
          "purchaseAmount",
        ),
        transactionReference,
        completedAt:
          status === "completed"
            ? readString(
                transaction,
                "updated_at",
                "updatedAt",
                "created_at",
                "createdAt",
              )
            : undefined,
      };
    }

    return {
      providerId: this.id,
      providerSessionId,
      status,
      sourceAmount: readMoney(
        transaction,
        "sell_amount",
        "sellAmount",
      ),
      destinationAmount: readMoney(
        transaction,
        "total",
        "cashout_total",
        "cashoutTotal",
      ),
      transactionReference,
      completedAt:
        status === "completed"
          ? readString(
              transaction,
              "updated_at",
              "updatedAt",
              "created_at",
              "createdAt",
            )
          : undefined,
    };
  }
}
