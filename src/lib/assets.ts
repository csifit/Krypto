import {
  ACTIVE_PAYMENT_NETWORK,
  CELO_MAINNET_USDC,
  CELO_MAINNET_USDC_FEE_ADAPTER,
  CELO_MAINNET_USDT,
  CELO_MAINNET_USDT_FEE_ADAPTER,
  CELO_SEPOLIA_TEST_USDT,
  IS_MAINNET,
  type CeloPaymentNetwork,
} from "@/lib/celo";
import type { CryptoNetwork } from "@/lib/payments/types";

export type StablecoinSymbol = "USDTd" | "USDT" | "USDC";

export type SupportedStablecoin = {
  type: "crypto";
  symbol: StablecoinSymbol;
  displaySymbol: string;
  name: string;
  network: CryptoNetwork;
  contractAddress: `0x${string}`;
  decimals: number;
  feeCurrencyAdapter?: `0x${string}`;
};

export const TEST_USDTD: SupportedStablecoin = {
  type: "crypto",
  symbol: "USDTd",
  displaySymbol: "Test USDT",
  name: CELO_SEPOLIA_TEST_USDT.name,
  network: "celo-sepolia",
  contractAddress: CELO_SEPOLIA_TEST_USDT.address,
  decimals: CELO_SEPOLIA_TEST_USDT.decimals,
};

export const CELO_USDT: SupportedStablecoin = {
  type: "crypto",
  symbol: "USDT",
  displaySymbol: "USDT",
  name: CELO_MAINNET_USDT.name,
  network: "celo",
  contractAddress: CELO_MAINNET_USDT.address,
  decimals: CELO_MAINNET_USDT.decimals,
  feeCurrencyAdapter: CELO_MAINNET_USDT_FEE_ADAPTER.address,
};

export const CELO_USDC: SupportedStablecoin = {
  type: "crypto",
  symbol: "USDC",
  displaySymbol: "USDC",
  name: CELO_MAINNET_USDC.name,
  network: "celo",
  contractAddress: CELO_MAINNET_USDC.address,
  decimals: CELO_MAINNET_USDC.decimals,
  feeCurrencyAdapter: CELO_MAINNET_USDC_FEE_ADAPTER.address,
};

export const BASE_USDC: SupportedStablecoin = {
  type: "crypto",
  symbol: "USDC",
  displaySymbol: "USDC",
  name: "USD Coin",
  network: "base",
  contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  decimals: 6,
};

export const ACTIVE_STABLECOINS: readonly SupportedStablecoin[] = IS_MAINNET
  ? [CELO_USDT, CELO_USDC]
  : [TEST_USDTD];

export const DEFAULT_STABLECOIN = ACTIVE_STABLECOINS[0];

export function getActiveStablecoin(symbol: string | undefined) {
  if (!symbol) return undefined;
  return ACTIVE_STABLECOINS.find((asset) => asset.symbol === symbol);
}

export function requireActiveStablecoin(symbol: string | undefined) {
  const asset = getActiveStablecoin(symbol);
  if (!asset) throw new Error("Unsupported stablecoin in the active Krypto121 environment");
  return asset;
}

export function isActiveStablecoinSymbol(value: string): value is StablecoinSymbol {
  return Boolean(getActiveStablecoin(value));
}

export function stablecoinForPaymentAsset(input: {
  symbol: string;
  network: string;
  contractAddress: string;
  decimals: number;
}): SupportedStablecoin | undefined {
  const universe = [...ACTIVE_STABLECOINS, ...(IS_MAINNET ? [BASE_USDC] : [])];
  return universe.find(
    (asset) =>
      asset.symbol === input.symbol &&
      asset.network === input.network &&
      asset.contractAddress.toLowerCase() === input.contractAddress.toLowerCase() &&
      asset.decimals === input.decimals,
  );
}

export function stablecoinNetworkIsActive(network: string) {
  return network === ACTIVE_PAYMENT_NETWORK;
}

export type PaymentDestination = "celo" | "base";

export const PAYMENT_DESTINATIONS: readonly {
  id: PaymentDestination;
  label: string;
  detail: string;
}[] = IS_MAINNET
  ? [
      { id: "celo", label: "Celo", detail: "Direct payment" },
      { id: "base", label: "Base", detail: "Cross-network payment" },
    ]
  : [{ id: "celo", label: "Celo Sepolia", detail: "Test payment" }];
