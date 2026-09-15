import { defineChain } from "viem";

export const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: {
    name: "CELO",
    symbol: "CELO",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://forno.celo-sepolia.celo-testnet.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "Celo Sepolia Blockscout",
      url: "https://celo-sepolia.blockscout.com",
    },
  },
  testnet: true,
});

export const celoMainnet = defineChain({
  id: 42220,
  name: "Celo Mainnet",
  nativeCurrency: {
    name: "CELO",
    symbol: "CELO",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://forno.celo.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "CeloScan",
      url: "https://celoscan.io",
    },
  },
});

// Publicly mintable development token on Celo Sepolia.
// This is NOT real Tether and has no economic value.
export const CELO_SEPOLIA_TEST_USDT = {
  symbol: "USDTd",
  displaySymbol: "Test USDT",
  name: "USDT dummy",
  decimals: 6,
  address: "0xD2B356E6E231e6fEF586A992e5e820c31673282f",
} as const;

// Official Tether deployment on Celo Sepolia, retained for reference only.
export const CELO_SEPOLIA_TETHER_USDT = {
  symbol: "USD₮",
  displaySymbol: "USD₮",
  name: "Tether USD",
  decimals: 6,
  address: "0xd077A400968890Eacc75cdc901F0356c943e4fDb",
} as const;

export const CELO_MAINNET_USDT = {
  symbol: "USDT",
  displaySymbol: "USDT",
  name: "Tether USD",
  decimals: 6,
  address: "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e",
} as const;

export type KryptoNetworkMode = "testnet" | "mainnet";
export type CeloPaymentNetwork = "celo-sepolia" | "celo";

export const KRYPTO_NETWORK_MODE: KryptoNetworkMode =
  process.env.NEXT_PUBLIC_KRYPTO_NETWORK === "mainnet" ? "mainnet" : "testnet";

export const IS_MAINNET = KRYPTO_NETWORK_MODE === "mainnet";

export const ACTIVE_CELO_CHAIN = IS_MAINNET ? celoMainnet : celoSepolia;
export const ACTIVE_USDT = IS_MAINNET ? CELO_MAINNET_USDT : CELO_SEPOLIA_TEST_USDT;
export const ACTIVE_PAYMENT_NETWORK: CeloPaymentNetwork =
  IS_MAINNET ? "celo" : "celo-sepolia";

export const ACTIVE_ENVIRONMENT_LABEL = IS_MAINNET ? "Mainnet" : "Test environment";
export const ACTIVE_PRODUCT_LABEL = IS_MAINNET ? "Live" : "Development";

export function getCeloChainForPaymentNetwork(network: CeloPaymentNetwork) {
  return network === "celo" ? celoMainnet : celoSepolia;
}

export function getUsdtForPaymentNetwork(network: CeloPaymentNetwork) {
  return network === "celo" ? CELO_MAINNET_USDT : CELO_SEPOLIA_TEST_USDT;
}

export function getTransactionExplorerUrl(
  network: CeloPaymentNetwork,
  txHash: string,
) {
  return `${getCeloChainForPaymentNetwork(network).blockExplorers.default.url}/tx/${txHash}`;
}

export function getAddressExplorerUrl(
  network: CeloPaymentNetwork,
  address: string,
) {
  return `${getCeloChainForPaymentNetwork(network).blockExplorers.default.url}/address/${address}`;
}
