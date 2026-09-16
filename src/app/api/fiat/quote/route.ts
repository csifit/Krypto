import { ipAddress } from "@vercel/functions";
import { getKryptoFiatAsset } from "@/lib/fiat/kryptoAssets";
import {
  collectFiatQuotes,
  selectBestFiatQuote,
} from "@/lib/fiat/router";
import type { FiatQuoteRequest, FiatRouteDirection } from "@/lib/fiat/types";
import { AccessPolicyError, requireSensitiveAction } from "@/lib/server/access";
import { getConfiguredFiatProviders } from "@/lib/server/fiatProviders";
import { saveFiatQuote } from "@/lib/server/fiatQuotes";
import { AuthError, requirePrivyUser } from "@/lib/server/privy";

export const runtime = "nodejs";

type Body = {
  direction?: FiatRouteDirection;
  countryCode?: string;
  subdivisionCode?: string;
  amount?: string;
  fiatCurrency?: string;
  cryptoAssetKey?: string;
  walletAddress?: `0x${string}`;
  paymentMethodId?: string;
};

function isDirection(value: unknown): value is FiatRouteDirection {
  return value === "fiat-to-crypto" || value === "crypto-to-fiat";
}

export async function POST(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await requireSensitiveAction(userId);

    const body = (await request.json()) as Body;

    if (
      !isDirection(body.direction) ||
      !body.countryCode ||
      !body.amount ||
      !body.fiatCurrency ||
      !body.cryptoAssetKey ||
      !body.walletAddress ||
      !body.paymentMethodId
    ) {
      return Response.json(
        { error: "Complete the fiat payment details" },
        { status: 400 },
      );
    }

    const cryptoAsset = getKryptoFiatAsset(body.cryptoAssetKey);
    if (!cryptoAsset) {
      return Response.json(
        { error: "Unsupported stablecoin route" },
        { status: 400 },
      );
    }

    const clientIp = ipAddress(request);
    if (!clientIp) {
      return Response.json(
        { error: "Could not verify the request network location" },
        { status: 400 },
      );
    }

    const fiatAsset = {
      type: "fiat" as const,
      symbol: body.fiatCurrency.toUpperCase(),
    };

    const quoteRequest: FiatQuoteRequest =
      body.direction === "fiat-to-crypto"
        ? {
            direction: body.direction,
            countryCode: body.countryCode.toUpperCase(),
            subdivisionCode: body.subdivisionCode?.toUpperCase(),
            sourceAsset: fiatAsset,
            destinationAsset: cryptoAsset,
            amount: body.amount.trim(),
            amountSide: "source",
            destinationWallet: body.walletAddress,
            paymentMethodId: body.paymentMethodId,
            clientIp,
          }
        : {
            direction: body.direction,
            countryCode: body.countryCode.toUpperCase(),
            subdivisionCode: body.subdivisionCode?.toUpperCase(),
            sourceAsset: cryptoAsset,
            destinationAsset: fiatAsset,
            amount: body.amount.trim(),
            amountSide: "source",
            sourceWallet: body.walletAddress,
            paymentMethodId: body.paymentMethodId,
            clientIp,
          };

    const providers = getConfiguredFiatProviders();
    if (!providers.length) {
      return Response.json(
        { error: "No fiat provider is configured" },
        { status: 503 },
      );
    }

    const collected = await collectFiatQuotes(providers, quoteRequest);
    const best = selectBestFiatQuote(quoteRequest, collected.quotes);

    if (!best) {
      return Response.json(
        { error: "No available fiat route for these details" },
        { status: 422 },
      );
    }

    // The client IP is needed only while talking to the provider.
    // Do not persist it in Krypto121's quote record.
    const persistedRequest = {
      ...quoteRequest,
      clientIp: undefined,
    };

    const saved = await saveFiatQuote(userId, persistedRequest, best);

    return Response.json({
      quote: {
        id: saved.id,
        direction: best.direction,
        providerName: best.providerName,
        sourceAmount: best.sourceAmount,
        sourceSymbol: best.sourceAsset.symbol,
        destinationAmount: best.destinationAmount,
        destinationSymbol: best.destinationAsset.symbol,
        fees: best.fees,
        expiresAt: best.expiresAt,
        cryptoNetworkLabel: cryptoAsset.networkLabel,
      },
    });
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("fiat quote failed", error);
    return Response.json(
      { error: "Could not create a fiat quote" },
      { status: 500 },
    );
  }
}
