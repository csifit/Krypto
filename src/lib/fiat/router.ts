import type { FiatProvider } from "@/lib/fiat/provider";
import { FiatProviderError } from "@/lib/fiat/provider";
import type {
  FiatQuote,
  FiatQuoteRequest,
} from "@/lib/fiat/types";
import {
  isCryptoAsset,
  isFiatAsset,
} from "@/lib/fiat/types";

export type FiatQuoteFailure = {
  providerId: string;
  code:
    | "unsupported"
    | "unavailable"
    | "invalid-request"
    | "authentication"
    | "rate-limited"
    | "provider-error";
  retryable: boolean;
};

export type FiatQuoteCollection = {
  quotes: FiatQuote[];
  failures: FiatQuoteFailure[];
};

function decimalParts(value: string) {
  const trimmed = value.trim();

  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid positive decimal: ${value}`);
  }

  const [wholeRaw, fractionRaw = ""] =
    trimmed.split(".");

  const whole =
    wholeRaw.replace(/^0+(?=\d)/, "") || "0";

  const fraction =
    fractionRaw.replace(/0+$/, "");

  return { whole, fraction };
}

export function comparePositiveDecimals(
  left: string,
  right: string,
) {
  const a = decimalParts(left);
  const b = decimalParts(right);

  if (a.whole.length !== b.whole.length) {
    return a.whole.length < b.whole.length ? -1 : 1;
  }

  if (a.whole !== b.whole) {
    return a.whole < b.whole ? -1 : 1;
  }

  const maxFractionLength = Math.max(
    a.fraction.length,
    b.fraction.length,
  );

  const aFraction = a.fraction.padEnd(
    maxFractionLength,
    "0",
  );
  const bFraction = b.fraction.padEnd(
    maxFractionLength,
    "0",
  );

  if (aFraction === bFraction) return 0;
  return aFraction < bFraction ? -1 : 1;
}

function sameAsset(
  left: FiatQuote["sourceAsset"],
  right: FiatQuote["sourceAsset"],
) {
  if (
    left.type !== right.type ||
    left.symbol !== right.symbol
  ) {
    return false;
  }

  if (left.type === "crypto" && right.type === "crypto") {
    return (
      left.network === right.network &&
      left.contractAddress.toLowerCase() ===
        right.contractAddress.toLowerCase()
    );
  }

  if (left.type === "cbdc" && right.type === "cbdc") {
    return left.provider === right.provider;
  }

  return true;
}

function validateDirection(request: FiatQuoteRequest) {
  if (
    request.direction === "fiat-to-crypto" &&
    (!isFiatAsset(request.sourceAsset) ||
      !isCryptoAsset(request.destinationAsset))
  ) {
    throw new Error(
      "fiat-to-crypto requires fiat source and crypto destination",
    );
  }

  if (
    request.direction === "crypto-to-fiat" &&
    (!isCryptoAsset(request.sourceAsset) ||
      !isFiatAsset(request.destinationAsset))
  ) {
    throw new Error(
      "crypto-to-fiat requires crypto source and fiat destination",
    );
  }
}

export function validateFiatQuoteRequest(
  request: FiatQuoteRequest,
) {
  validateDirection(request);

  if (!/^[A-Z]{2}$/.test(request.countryCode)) {
    throw new Error(
      "countryCode must be an ISO 3166-1 alpha-2 code",
    );
  }

  if (comparePositiveDecimals(request.amount, "0") <= 0) {
    throw new Error("amount must be greater than zero");
  }

  if (
    request.direction === "fiat-to-crypto" &&
    !request.destinationWallet
  ) {
    throw new Error(
      "destinationWallet is required for fiat-to-crypto",
    );
  }

  if (
    request.direction === "crypto-to-fiat" &&
    !request.sourceWallet
  ) {
    throw new Error(
      "sourceWallet is required for crypto-to-fiat",
    );
  }
}

function quoteMatchesRequest(
  request: FiatQuoteRequest,
  quote: FiatQuote,
) {
  return (
    quote.direction === request.direction &&
    quote.amountSide === request.amountSide &&
    sameAsset(quote.sourceAsset, request.sourceAsset) &&
    sameAsset(
      quote.destinationAsset,
      request.destinationAsset,
    )
  );
}

export function isUsableFiatQuote(
  request: FiatQuoteRequest,
  quote: FiatQuote,
  now = Date.now(),
) {
  if (!quoteMatchesRequest(request, quote)) return false;
  if (quote.availability !== "available") return false;

  const expiry = new Date(quote.expiresAt).getTime();
  if (!Number.isFinite(expiry) || expiry <= now) {
    return false;
  }

  try {
    return (
      comparePositiveDecimals(quote.sourceAmount, "0") > 0 &&
      comparePositiveDecimals(
        quote.destinationAmount,
        "0",
      ) > 0
    );
  } catch {
    return false;
  }
}

export function selectBestFiatQuote(
  request: FiatQuoteRequest,
  quotes: FiatQuote[],
  now = Date.now(),
) {
  const valid = quotes.filter((quote) =>
    isUsableFiatQuote(request, quote, now),
  );

  if (!valid.length) return null;

  return [...valid].sort((left, right) => {
    const amountComparison =
      request.amountSide === "source"
        ? comparePositiveDecimals(
            right.destinationAmount,
            left.destinationAmount,
          )
        : comparePositiveDecimals(
            left.sourceAmount,
            right.sourceAmount,
          );

    if (amountComparison !== 0) {
      return amountComparison;
    }

    const leftDuration =
      left.estimatedDurationSeconds ??
      Number.MAX_SAFE_INTEGER;
    const rightDuration =
      right.estimatedDurationSeconds ??
      Number.MAX_SAFE_INTEGER;

    if (leftDuration !== rightDuration) {
      return leftDuration - rightDuration;
    }

    return left.providerId.localeCompare(
      right.providerId,
    );
  })[0];
}

export async function collectFiatQuotes(
  providers: FiatProvider[],
  request: FiatQuoteRequest,
): Promise<FiatQuoteCollection> {
  validateFiatQuoteRequest(request);

  const results = await Promise.allSettled(
    providers.map(async (provider) => ({
      provider,
      quote: await provider.getQuote(request),
    })),
  );

  const quotes: FiatQuote[] = [];
  const failures: FiatQuoteFailure[] = [];

  results.forEach((result, index) => {
    const provider = providers[index];

    if (result.status === "fulfilled") {
      quotes.push(result.value.quote);
      return;
    }

    const reason = result.reason;

    if (reason instanceof FiatProviderError) {
      failures.push({
        providerId: provider.id,
        code: reason.code,
        retryable: reason.retryable,
      });
      return;
    }

    failures.push({
      providerId: provider.id,
      code: "provider-error",
      retryable: false,
    });
  });

  return { quotes, failures };
}
