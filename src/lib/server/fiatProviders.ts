import type { FiatProvider } from "@/lib/fiat/provider";
import {
  CoinbaseFiatProvider,
  coinbaseFiatIsConfigured,
} from "@/lib/fiat/providers/coinbase";

type FiatProviderRegistration = {
  id: string;
  displayName: string;
  isConfigured(): boolean;
  create(): FiatProvider;
};

const registrations: FiatProviderRegistration[] = [
  {
    id: "coinbase",
    displayName: "Coinbase",
    isConfigured: coinbaseFiatIsConfigured,
    create: () => new CoinbaseFiatProvider(),
  },
];

const instances = new Map<string, FiatProvider>();

export function listFiatProviderRegistrations() {
  return registrations.map((registration) => ({
    id: registration.id,
    displayName: registration.displayName,
    configured: registration.isConfigured(),
  }));
}

export function getConfiguredFiatProviders(): FiatProvider[] {
  return registrations
    .filter((registration) => registration.isConfigured())
    .map((registration) => {
      let provider = instances.get(registration.id);
      if (!provider) {
        provider = registration.create();
        instances.set(registration.id, provider);
      }
      return provider;
    });
}

export function getConfiguredFiatProvider(id: string) {
  const registration = registrations.find((item) => item.id === id);
  if (!registration || !registration.isConfigured()) return null;

  let provider = instances.get(id);
  if (!provider) {
    provider = registration.create();
    instances.set(id, provider);
  }

  return provider;
}
