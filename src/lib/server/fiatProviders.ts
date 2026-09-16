import type { FiatProvider } from "@/lib/fiat/provider";
import {
  CoinbaseFiatProvider,
  coinbaseFiatIsConfigured,
} from "@/lib/fiat/providers/coinbase";

let coinbaseProvider: CoinbaseFiatProvider | null = null;

export function getConfiguredFiatProviders(): FiatProvider[] {
  const providers: FiatProvider[] = [];

  if (coinbaseFiatIsConfigured()) {
    coinbaseProvider ??= new CoinbaseFiatProvider();
    providers.push(coinbaseProvider);
  }

  return providers;
}
