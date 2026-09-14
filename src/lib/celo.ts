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

// Publicly mintable development token on Celo Sepolia.
// This is NOT real Tether and has no economic value.
export const CELO_SEPOLIA_TEST_USDT = {
  symbol: "USDTd",
  displaySymbol: "Test USDT",
  name: "USDT dummy",
  decimals: 6,
  address: "0xD2B356E6E231e6fEF586A992e5e820c31673282f" as const,
};

// Official Tether deployment on Celo Sepolia, retained for reference only.
// Krypto v0.3 does not use it because there is no public faucet we can rely on.
export const CELO_SEPOLIA_TETHER_USDT = {
  symbol: "USD₮",
  name: "Tether USD",
  decimals: 6,
  address: "0xd077A400968890Eacc75cdc901F0356c943e4fDb" as const,
};

export const CELO_MAINNET_USDT = {
  symbol: "USDT",
  name: "Tether USD",
  decimals: 6,
  address: "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e" as const,
};
