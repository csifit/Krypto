import { isAddress } from "viem";
import { ACTIVE_PAYMENT_NETWORK } from "@/lib/celo";
import {
  requireActiveStablecoin,
  type StablecoinSymbol,
} from "@/lib/assets";
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
  assetSymbol: StablecoinSymbol;
  memo?: string;
  paymentRequestId?: string;
}): PaymentIntent {
  if (!isAddress(input.destination)) {
    throw new Error("Enter a valid Celo/EVM wallet address");
  }

  const selected = requireActiveStablecoin(input.assetSymbol);
  const now = new Date().toISOString();

  const asset = {
    type: "crypto" as const,
    symbol: selected.symbol,
    network: ACTIVE_PAYMENT_NETWORK,
    contractAddress: selected.contractAddress,
    decimals: selected.decimals,
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
    paymentRequestId: input.paymentRequestId,
    status: "draft",
  };
}

export function quoteDirectCeloIntent(
  intent: PaymentIntent,
  options?: { networkFeeDescription?: string },
): PaymentQuote {
  const route: PaymentRoute = {
    id: makeId("route"),
    kind: "direct-celo",
    kryptoFeeAmount: "0.00",
    networkFeeDescription:
      options?.networkFeeDescription ?? "Paid by the source wallet",
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
