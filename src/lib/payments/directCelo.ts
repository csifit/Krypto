import { isAddress } from "viem";
import { CELO_SEPOLIA_TEST_USDT } from "@/lib/celo";
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

export function createDirectCeloIntent(input: {
  sourceWallet: `0x${string}`;
  destination: string;
  amount: string;
  memo?: string;
}): PaymentIntent {
  if (!isAddress(input.destination)) {
    throw new Error("Enter a valid Celo/EVM wallet address");
  }

  const now = new Date().toISOString();
  const asset = {
    type: "crypto" as const,
    symbol: CELO_SEPOLIA_TEST_USDT.symbol,
    network: "celo-sepolia" as const,
    contractAddress: CELO_SEPOLIA_TEST_USDT.address,
    decimals: CELO_SEPOLIA_TEST_USDT.decimals,
  };

  return {
    id: makeId("intent"),
    createdAt: now,
    sourceWallet: input.sourceWallet,
    sourceAsset: asset,
    destinationAsset: asset,
    destination: input.destination,
    sourceAmount: input.amount,
    destinationAmount: input.amount,
    memo: input.memo?.trim() || undefined,
    status: "draft",
  };
}

export function quoteDirectCeloIntent(intent: PaymentIntent): PaymentQuote {
  const route: PaymentRoute = {
    id: makeId("route"),
    kind: "direct-celo",
    kryptoFeeAmount: "0.00",
    networkFeeDescription: "Paid by the source wallet",
    estimatedDurationSeconds: 15,
    steps: [
      {
        id: makeId("step"),
        type: "transfer",
        provider: "Celo",
        description: "Direct stablecoin transfer",
      },
    ],
  };

  const created = new Date();
  const expires = new Date(created.getTime() + 5 * 60 * 1000);

  return {
    id: makeId("quote"),
    createdAt: created.toISOString(),
    paymentIntentId: intent.id,
    sourceAmount: intent.sourceAmount,
    destinationAmount: intent.destinationAmount ?? intent.sourceAmount,
    feeAmount: route.kryptoFeeAmount,
    expiresAt: expires.toISOString(),
    route,
  };
}
