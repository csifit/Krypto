import { geolocation } from "@vercel/functions";
import { matchProviderAsset } from "@/lib/fiat/kryptoAssets";
import type { FiatRouteDirection } from "@/lib/fiat/types";
import { getConfiguredFiatProviders } from "@/lib/server/fiatProviders";
import { AuthError, requirePrivyUser } from "@/lib/server/privy";

export const runtime = "nodejs";

function validDirection(value: string | null): value is FiatRouteDirection {
  return value === "fiat-to-crypto" || value === "crypto-to-fiat";
}

export async function GET(request: Request) {
  try {
    await requirePrivyUser(request);

    const url = new URL(request.url);
    const direction = url.searchParams.get("direction");

    if (!validDirection(direction)) {
      return Response.json(
        { error: "Invalid fiat direction" },
        { status: 400 },
      );
    }

    const countryCode = url.searchParams.get("countryCode")?.toUpperCase();
    const subdivisionCode =
      url.searchParams.get("subdivisionCode")?.toUpperCase();
    const fiatCurrency =
      url.searchParams.get("fiatCurrency")?.toUpperCase();

    const providers = getConfiguredFiatProviders();
    const geo = geolocation(request);

    if (!providers.length) {
      return Response.json({
        suggestedCountry: geo.country,
        suggestedSubdivision: geo.countryRegion,
        countries: [],
        currencies: [],
        assets: [],
        paymentMethods: [],
      });
    }

    const countryResults = await Promise.allSettled(
      providers.map((provider) => provider.getSupportedCountries()),
    );

    const countries = new Set<string>();

    for (const result of countryResults) {
      if (result.status !== "fulfilled") continue;
      for (const country of result.value) {
        if (country.directions.includes(direction)) {
          countries.add(country.countryCode.toUpperCase());
        }
      }
    }

    if (!countryCode) {
      return Response.json({
        suggestedCountry: geo.country,
        suggestedSubdivision: geo.countryRegion,
        countries: [...countries].sort(),
        currencies: [],
        assets: [],
        paymentMethods: [],
      });
    }

    const context = {
      direction,
      countryCode,
      subdivisionCode,
    };

    const currencyResults = await Promise.allSettled(
      providers.map((provider) => provider.getSupportedCurrencies(context)),
    );

    const currencies = new Set<string>();

    for (const result of currencyResults) {
      if (result.status !== "fulfilled") continue;
      for (const currency of result.value) {
        currencies.add(currency.symbol.toUpperCase());
      }
    }

    if (!fiatCurrency) {
      return Response.json({
        suggestedCountry: geo.country,
        suggestedSubdivision: geo.countryRegion,
        countries: [...countries].sort(),
        currencies: [...currencies].sort(),
        assets: [],
        paymentMethods: [],
      });
    }

    const [assetResults, methodResults] = await Promise.all([
      Promise.allSettled(
        providers.map((provider) =>
          provider.getSupportedAssets({
            ...context,
            fiatCurrency,
          }),
        ),
      ),
      Promise.allSettled(
        providers.map((provider) =>
          provider.getSupportedPaymentMethods({
            ...context,
            fiatCurrency,
          }),
        ),
      ),
    ]);

    const assetMap = new Map<
      string,
      { key: string; symbol: string; network: string; networkLabel: string }
    >();

    for (const result of assetResults) {
      if (result.status !== "fulfilled") continue;

      for (const providerAsset of result.value) {
        const matched = matchProviderAsset(providerAsset);
        if (!matched) continue;

        assetMap.set(matched.key, {
          key: matched.key,
          symbol: matched.symbol,
          network: matched.network,
          networkLabel: matched.networkLabel,
        });
      }
    }

    const methodMap = new Map<
      string,
      { id: string; label: string; type: "bank" | "card" | "wallet" | "instant-bank" | "other" }
    >();

    for (const result of methodResults) {
      if (result.status !== "fulfilled") continue;

      for (const method of result.value) {
        if (!methodMap.has(method.id)) {
          methodMap.set(method.id, method);
        }
      }
    }

    return Response.json({
      suggestedCountry: geo.country,
      suggestedSubdivision: geo.countryRegion,
      countries: [...countries].sort(),
      currencies: [...currencies].sort(),
      assets: [...assetMap.values()].sort((a, b) =>
        `${a.symbol}-${a.network}`.localeCompare(`${b.symbol}-${b.network}`),
      ),
      paymentMethods: [...methodMap.values()].sort((a, b) =>
        a.label.localeCompare(b.label),
      ),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("fiat options failed", error);
    return Response.json(
      { error: "Could not load fiat options" },
      { status: 500 },
    );
  }
}
