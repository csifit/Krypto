import {
  decodeFunctionData,
  erc20Abi,
  parseUnits,
} from "viem";
import {
  ACTIVE_CELO_CHAIN,
  ACTIVE_PAYMENT_NETWORK,
} from "@/lib/celo";
import { BASE_USDC, CELO_USDC, stablecoinForPaymentAsset } from "@/lib/assets";
import { getServerCeloPublicClient } from "@/lib/server/rpc";
import { getRelayStatus } from "@/lib/server/relay";
import { getSupabaseAdmin } from "@/lib/server/supabase";
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

  if (record.id !== intent.id) throw new Error("Payment record does not match its intent");
  if (intent.status !== "settled") throw new Error("Payment intent is not settled");
  if (quote.paymentIntentId !== intent.id) throw new Error("Payment quote does not match its intent");
  if (quote.route.kind !== "direct-celo") throw new Error("Unsupported settlement route");
  if (intent.sourceAsset.type !== "crypto" || intent.destinationAsset.type !== "crypto") {
    throw new Error("Unsupported settlement asset");
  }

  const sourceAsset = stablecoinForPaymentAsset({
    symbol: intent.sourceAsset.symbol,
    network: intent.sourceAsset.network,
    contractAddress: intent.sourceAsset.contractAddress,
    decimals: intent.sourceAsset.decimals,
  });
  const destinationAsset = stablecoinForPaymentAsset({
    symbol: intent.destinationAsset.symbol,
    network: intent.destinationAsset.network,
    contractAddress: intent.destinationAsset.contractAddress,
    decimals: intent.destinationAsset.decimals,
  });

  if (
    !sourceAsset ||
    !destinationAsset ||
    sourceAsset.symbol !== destinationAsset.symbol ||
    sourceAsset.network !== ACTIVE_PAYMENT_NETWORK
  ) {
    throw new Error("Payment asset does not match a supported active Krypto121 stablecoin");
  }

  if (
    quote.sourceAmount !== intent.sourceAmount ||
    quote.destinationAmount !== (intent.destinationAmount ?? intent.sourceAmount)
  ) {
    throw new Error("Payment amounts do not match the quote");
  }

  return sourceAsset;
}

export async function verifyDirectCeloSettlement(record: LocalPaymentRecord) {
  const asset = assertDirectCeloIntent(record);
  const publicClient = getServerCeloPublicClient();

  const [transaction, receipt] = await Promise.all([
    publicClient.getTransaction({ hash: record.txHash }),
    publicClient.getTransactionReceipt({ hash: record.txHash }),
  ]);

  if (receipt.status !== "success") throw new Error("Blockchain transaction did not settle successfully");
  if (!equalAddress(transaction.from, record.intent.sourceWallet)) {
    throw new Error("Blockchain source wallet does not match the payment");
  }
  if (!transaction.to || !equalAddress(transaction.to, asset.contractAddress)) {
    throw new Error("Blockchain transaction used an unexpected token contract");
  }
  if (transaction.value !== BigInt(0)) {
    throw new Error("Blockchain transaction contains an unexpected native value");
  }

  let decoded;
  try {
    decoded = decodeFunctionData({ abi: erc20Abi, data: transaction.input });
  } catch {
    throw new Error("Blockchain transaction data is not a supported token transfer");
  }

  if (decoded.functionName !== "transfer" || !decoded.args) {
    throw new Error("Blockchain transaction is not a token transfer");
  }

  const [recipient, rawAmount] = decoded.args as readonly [`0x${string}`, bigint];
  const expectedAmount = parseUnits(record.intent.sourceAmount, asset.decimals);

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

async function verifyRelaySettlement(
  record: LocalPaymentRecord,
  userId: string,
): Promise<VerifiedSettlement> {
  const relay = record.quote.route.relay;

  if (
    record.quote.route.kind !== "relay" ||
    !relay ||
    record.intent.sourceAsset.type !== "crypto" ||
    record.intent.destinationAsset.type !== "crypto"
  ) {
    throw new Error("Invalid Relay payment record");
  }

  if (
    relay.originChainId !== 42220 ||
    relay.destinationChainId !== 8453 ||
    !equalAddress(relay.originCurrency, CELO_USDC.contractAddress) ||
    !equalAddress(relay.destinationCurrency, BASE_USDC.contractAddress) ||
    record.intent.sourceAsset.network !== "celo" ||
    record.intent.destinationAsset.network !== "base" ||
    !equalAddress(record.intent.sourceAsset.contractAddress, CELO_USDC.contractAddress) ||
    !equalAddress(record.intent.destinationAsset.contractAddress, BASE_USDC.contractAddress) ||
    record.intent.sourceAsset.symbol !== "USDC" ||
    record.intent.destinationAsset.symbol !== "USDC"
  ) {
    throw new Error("Relay payment does not match the supported Krypto121 route");
  }

  const supabase = getSupabaseAdmin();
  const { data: saved, error } = await supabase
    .from("relay_quotes")
    .select("*")
    .eq("privy_user_id", userId)
    .eq("request_id", relay.requestId)
    .maybeSingle();

  if (error) throw error;
  if (!saved) throw new Error("Relay quote was not issued by this Krypto121 account");

  if (
    !equalAddress(saved.source_wallet, record.intent.sourceWallet) ||
    !equalAddress(saved.recipient, record.intent.destination) ||
    saved.source_amount !== record.intent.sourceAmount ||
    saved.destination_amount !== record.intent.destinationAmount ||
    Number(saved.origin_chain_id) !== 42220 ||
    Number(saved.destination_chain_id) !== 8453 ||
    !equalAddress(saved.origin_currency, CELO_USDC.contractAddress) ||
    !equalAddress(saved.destination_currency, BASE_USDC.contractAddress)
  ) {
    throw new Error("Relay payment does not match its server-issued quote");
  }

  const status = await getRelayStatus(relay.requestId);

  if (status.status !== "success") {
    throw new Error(`Relay payment is not settled (${status.status})`);
  }
  if (status.originChainId !== 42220 || status.destinationChainId !== 8453) {
    throw new Error("Relay settlement used an unexpected chain");
  }
  if (!status.inTxHashes.some((hash) => hash.toLowerCase() === record.txHash.toLowerCase())) {
    throw new Error("Relay origin transaction does not match the payment");
  }
  if (!status.txHashes.length) {
    throw new Error("Relay did not report a destination settlement transaction");
  }

  const publicClient = getServerCeloPublicClient();
  const receipt = await publicClient.getTransactionReceipt({ hash: record.txHash });
  if (receipt.status !== "success") {
    throw new Error("Relay origin transaction failed on Celo");
  }
  const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });

  await supabase
    .from("relay_quotes")
    .update({
      status: "settled",
      origin_tx_hash: record.txHash,
      destination_tx_hash: status.txHashes[0],
      settled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("privy_user_id", userId)
    .eq("request_id", relay.requestId);

  return {
    chainId: 42220,
    blockNumber: receipt.blockNumber,
    settledAt: new Date(Number(block.timestamp) * 1000).toISOString(),
  };
}

export async function verifyPaymentSettlement(
  record: LocalPaymentRecord,
  userId: string,
): Promise<VerifiedSettlement> {
  if (record.quote.route.kind === "direct-celo") {
    return verifyDirectCeloSettlement(record);
  }
  if (record.quote.route.kind === "relay") {
    return verifyRelaySettlement(record, userId);
  }
  throw new Error("Unsupported settlement route");
}
