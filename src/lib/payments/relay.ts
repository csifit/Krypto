import { isAddress } from "viem";
import { BASE_USDC, CELO_USDC } from "@/lib/assets";
import type { KryptoRelayQuote } from "@/lib/relay/types";
import type {
  PaymentIntent,
  PaymentQuote,
  PaymentRoute,
} from "@/lib/payments/types";

function makeId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${random}`;
}

export function createRelayPayment(
  relayQuote: KryptoRelayQuote,
  memo?: string,
): { intent: PaymentIntent; quote: PaymentQuote } {
  if (!isAddress(relayQuote.recipient) || !isAddress(relayQuote.sourceWallet)) {
    throw new Error("Relay quote contains an invalid wallet");
  }

  const intent: PaymentIntent = {
    id: makeId("intent"),
    createdAt: new Date().toISOString(),
    sourceWallet: relayQuote.sourceWallet,
    sourceAsset: {
      type: "crypto",
      symbol: CELO_USDC.symbol,
      network: "celo",
      contractAddress: CELO_USDC.contractAddress,
      decimals: CELO_USDC.decimals,
    },
    destinationAsset: {
      type: "crypto",
      symbol: BASE_USDC.symbol,
      network: "base",
      contractAddress: BASE_USDC.contractAddress,
      decimals: BASE_USDC.decimals,
    },
    destination: relayQuote.recipient,
    sourceAmount: relayQuote.sourceAmount,
    destinationAmount: relayQuote.destinationAmount,
    memo: memo?.trim() || undefined,
    status: "quoted",
  };

  const route: PaymentRoute = {
    id: makeId("route"),
    kind: "relay",
    kryptoFeeAmount: "0.00",
    networkFeeDescription: "Included in Relay quote",
    routeCostAmount: relayQuote.routeCostAmount,
    estimatedDurationSeconds: relayQuote.estimatedDurationSeconds,
    steps: [
      {
        id: makeId("step"),
        type: "bridge",
        provider: "Relay",
        description: "Cross-network USDC payment",
      },
    ],
    relay: {
      requestId: relayQuote.requestId,
      originChainId: relayQuote.originChainId,
      destinationChainId: relayQuote.destinationChainId,
      originCurrency: relayQuote.originCurrency,
      destinationCurrency: relayQuote.destinationCurrency,
    },
  };

  const quote: PaymentQuote = {
    id: makeId("quote"),
    createdAt: new Date().toISOString(),
    paymentIntentId: intent.id,
    sourceAmount: relayQuote.sourceAmount,
    destinationAmount: relayQuote.destinationAmount,
    feeAmount: "0.00",
    expiresAt: relayQuote.expiresAt,
    route,
  };

  return { intent, quote };
}
