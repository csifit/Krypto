import {
  BASE_USDC,
  CELO_USDC,
  CELO_USDT,
} from "@/lib/assets";
import { IS_MAINNET } from "@/lib/celo";
import type { CryptoAsset } from "@/lib/payments/types";

export type KryptoFiatAsset = CryptoAsset & {
  key: string;
  networkLabel: string;
};

const MAINNET_FIAT_ASSETS: KryptoFiatAsset[] = [
  {
    ...CELO_USDC,
    key: "celo:USDC",
    networkLabel: "Celo",
  },
  {
    ...CELO_USDT,
    key: "celo:USDT",
    networkLabel: "Celo",
  },
  {
    ...BASE_USDC,
    key: "base:USDC",
    networkLabel: "Base",
  },
];

export const KRYPT0121_FIAT_ASSETS: readonly KryptoFiatAsset[] =
  IS_MAINNET ? MAINNET_FIAT_ASSETS : [];

export function getKryptoFiatAsset(key: string) {
  return KRYPT0121_FIAT_ASSETS.find((asset) => asset.key === key);
}

function networkLooksCompatible(providerNetwork: string, network: string) {
  const normalized = providerNetwork.toLowerCase();
  if (network === "base") return normalized === "base" || normalized.includes("base");
  if (network === "celo") return normalized === "celo" || normalized.includes("celo");
  return false;
}

export function matchProviderAsset(input: {
  symbol: string;
  network: string;
  contractAddress?: `0x${string}`;
}) {
  return KRYPT0121_FIAT_ASSETS.find((asset) => {
    if (asset.symbol.toUpperCase() !== input.symbol.toUpperCase()) return false;

    if (input.contractAddress) {
      return asset.contractAddress.toLowerCase() === input.contractAddress.toLowerCase();
    }

    return networkLooksCompatible(input.network, asset.network);
  });
}
