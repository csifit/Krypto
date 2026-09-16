import { FiatProviderError } from "@/lib/fiat/provider";
import {
  getConfiguredFiatProvider,
  listFiatProviderRegistrations,
} from "@/lib/server/fiatProviders";
import { AuthError, requirePrivyUser } from "@/lib/server/privy";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requirePrivyUser(request);

    const registrations = listFiatProviderRegistrations();

    const providers = await Promise.all(
      registrations.map(async (registration) => {
        if (!registration.configured) {
          return {
            id: registration.id,
            name: registration.displayName,
            configured: false,
            status: "not-configured" as const,
            onramp: false,
            offramp: false,
            countries: 0,
          };
        }

        const provider = getConfiguredFiatProvider(registration.id);

        if (!provider) {
          return {
            id: registration.id,
            name: registration.displayName,
            configured: false,
            status: "not-configured" as const,
            onramp: false,
            offramp: false,
            countries: 0,
          };
        }

        try {
          const countries = await provider.getSupportedCountries();

          return {
            id: registration.id,
            name: registration.displayName,
            configured: true,
            status: "connected" as const,
            onramp: countries.some((item) =>
              item.directions.includes("fiat-to-crypto"),
            ),
            offramp: countries.some((item) =>
              item.directions.includes("crypto-to-fiat"),
            ),
            countries: countries.length,
          };
        } catch (error) {
          return {
            id: registration.id,
            name: registration.displayName,
            configured: true,
            status: "error" as const,
            onramp: false,
            offramp: false,
            countries: 0,
            errorCode:
              error instanceof FiatProviderError
                ? error.code
                : "provider-error",
          };
        }
      }),
    );

    return Response.json({
      providers,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("fiat provider status failed", error);
    return Response.json(
      { error: "Could not check fiat provider connections" },
      { status: 500 },
    );
  }
}
