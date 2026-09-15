import {
  decodeFunctionData,
  erc20Abi,
  parseUnits,
} from "viem";
import {
  ACTIVE_CELO_CHAIN,
  ACTIVE_PAYMENT_NETWORK,
  ACTIVE_USDT,
} from "@/lib/celo";
import { getServerCeloPublicClient } from "@/lib/server/rpc";
import type { LocalPaymentRecord } from "@/lib/payments/types";

export type VerifiedSettlement = {
  chainId: number;
  blockNumber: bigint;
  settledAt: string;
};

function equalAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function assertDirectCeloIntent(record: LocalPaymentRecord) {
  const { intent, quote } = record;

  if (record.id !== intent.id) {
    throw new Error("Payment record does not match its intent");
  }
  if (intent.status !== "settled") {
    throw new Error("Payment intent is not settled");
  }
  if (quote.paymentIntentId !== intent.id) {
    throw new Error("Payment quote does not match its intent");
  }
  if (quote.route.kind !== "direct-celo") {
    throw new Error("Unsupported settlement route");
  }
  if (
    intent.sourceAsset.type !== "crypto" ||
    intent.destinationAsset.type !== "crypto"
  ) {
    throw new Error("Unsupported settlement asset");
  }

  if (
    intent.sourceAsset.network !== ACTIVE_PAYMENT_NETWORK ||
    intent.destinationAsset.network !== ACTIVE_PAYMENT_NETWORK ||
    !equalAddress(intent.sourceAsset.contractAddress, ACTIVE_USDT.address) ||
    !equalAddress(intent.destinationAsset.contractAddress, ACTIVE_USDT.address) ||
    intent.sourceAsset.decimals !== ACTIVE_USDT.decimals ||
    intent.destinationAsset.decimals !== ACTIVE_USDT.decimals ||
    intent.sourceAsset.symbol !== ACTIVE_USDT.symbol ||
    intent.destinationAsset.symbol !== ACTIVE_USDT.symbol
  ) {
    throw new Error("Payment asset does not match the active Krypto121 environment");
  }

  if (
    quote.sourceAmount !== intent.sourceAmount ||
    quote.destinationAmount !== (intent.destinationAmount ?? intent.sourceAmount)
  ) {
    throw new Error("Payment amounts do not match the quote");
  }
}

export async function verifyDirectCeloSettlement(
  record: LocalPaymentRecord,
): Promise<VerifiedSettlement> {
  assertDirectCeloIntent(record);

  const publicClient = getServerCeloPublicClient();
  const [transaction, receipt] = await Promise.all([
    publicClient.getTransaction({ hash: record.txHash }),
    publicClient.getTransactionReceipt({ hash: record.txHash }),
  ]);

  if (receipt.status !== "success") {
    throw new Error("Blockchain transaction did not settle successfully");
  }

  if (!equalAddress(transaction.from, record.intent.sourceWallet)) {
    throw new Error("Blockchain source wallet does not match the payment");
  }

  if (!transaction.to || !equalAddress(transaction.to, ACTIVE_USDT.address)) {
    throw new Error("Blockchain transaction used an unexpected token contract");
  }

  if (transaction.value !== BigInt(0)) {
    throw new Error("Blockchain transaction contains an unexpected native value");
  }

  let decoded;
  try {
    decoded = decodeFunctionData({
      abi: erc20Abi,
      data: transaction.input,
    });
  } catch {
    throw new Error("Blockchain transaction data is not a supported token transfer");
  }

  if (decoded.functionName !== "transfer" || !decoded.args) {
    throw new Error("Blockchain transaction is not a token transfer");
  }

  const [recipient, rawAmount] = decoded.args as readonly [`0x${string}`, bigint];
  const expectedAmount = parseUnits(
    record.intent.sourceAmount,
    ACTIVE_USDT.decimals,
  );

  if (!equalAddress(recipient, record.intent.destination)) {
    throw new Error("Blockchain recipient does not match the payment");
  }

  if (rawAmount !== expectedAmount) {
    throw new Error("Blockchain amount does not match the payment");
  }

  const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });

  return {
    chainId: ACTIVE_CELO_CHAIN.id,
    blockNumber: receipt.blockNumber,
    settledAt: new Date(Number(block.timestamp) * 1000).toISOString(),
  };
}

export async function verifyPaymentSettlement(
  record: LocalPaymentRecord,
): Promise<VerifiedSettlement> {
  if (record.quote.route.kind === "direct-celo") {
    return verifyDirectCeloSettlement(record);
  }

  throw new Error("Unsupported settlement route");
}
