"use client";

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Hex,
} from "viem";
import { celo } from "viem/chains";
import { CELO_USDC } from "@/lib/assets";
import type { KryptoRelayQuote } from "@/lib/relay/types";
import type { PaymentSourceWallet } from "@/lib/wallet/types";

const publicClient = createPublicClient({
  chain: celo,
  transport: http(celo.rpcUrls.default.http[0]),
});

export async function executeRelayQuote(
  source: PaymentSourceWallet,
  quote: KryptoRelayQuote,
) {
  const provider = await source.wallet.getEip1193Provider();
  await source.wallet.switchChain(celo.id);

  let depositTxHash: `0x${string}` | undefined;
  const hashes: `0x${string}`[] = [];

  for (const step of quote.steps) {
    for (const item of step.items) {
      const data = item.data;
      let hash: `0x${string}`;

      if (source.embedded && CELO_USDC.feeCurrencyAdapter) {
        const walletClient = createWalletClient({
          account: source.wallet.address,
          chain: celo,
          transport: custom(provider),
        });

        hash = await walletClient.sendTransaction({
          account: source.wallet.address,
          to: data.to,
          data: data.data as Hex,
          value: BigInt(data.value),
          feeCurrency: CELO_USDC.feeCurrencyAdapter,
        });
      } else {
        const result = await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: source.wallet.address,
              to: data.to,
              data: data.data,
              value: `0x${BigInt(data.value).toString(16)}`,
            },
          ],
        });

        if (typeof result !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(result)) {
          throw new Error("Wallet did not return a Relay transaction hash");
        }
        hash = result as `0x${string}`;
      }

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error("Relay origin transaction failed on Celo");
      }

      hashes.push(hash);
      if (step.requestId) depositTxHash = hash;
    }
  }

  if (!depositTxHash) {
    throw new Error("Relay deposit transaction was not identified");
  }

  return { depositTxHash, hashes };
}
