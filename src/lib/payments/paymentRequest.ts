import { isAddress } from "viem";
import {
  ACTIVE_CELO_CHAIN,
  ACTIVE_PAYMENT_NETWORK,
  ACTIVE_USDT,
  IS_MAINNET,
  type CeloPaymentNetwork,
} from "@/lib/celo";

export type PaymentRequest = {
  version: 2;
  recipient: `0x${string}`;
  network: CeloPaymentNetwork;
  asset: "USDTd" | "USDT";
  amount?: string;
  memo?: string;
};

const MAX_MEMO_LENGTH = 120;

function normalizeAmount(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  if (!/^\d+(?:\.\d{1,6})?$/.test(trimmed)) {
    throw new Error(`Enter a valid ${ACTIVE_USDT.symbol} amount with up to 6 decimal places`);
  }

  const number = Number(trimmed);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  return trimmed;
}

export function createPaymentRequest(input: {
  recipient: string;
  amount?: string;
  memo?: string;
}): PaymentRequest {
  const recipient = input.recipient.trim();

  if (!isAddress(recipient)) {
    throw new Error("Enter a valid wallet address");
  }

  const memo = input.memo?.trim();
  if (memo && memo.length > MAX_MEMO_LENGTH) {
    throw new Error(`Reference must be ${MAX_MEMO_LENGTH} characters or less`);
  }

  return {
    version: 2,
    recipient: recipient as `0x${string}`,
    network: ACTIVE_PAYMENT_NETWORK,
    asset: ACTIVE_USDT.symbol,
    amount: normalizeAmount(input.amount),
    memo: memo || undefined,
  };
}

export function buildPaymentRequestLink(origin: string, request: PaymentRequest) {
  const url = new URL("/pay", origin);
  url.searchParams.set("v", String(request.version));
  url.searchParams.set("to", request.recipient);
  url.searchParams.set("network", request.network);
  url.searchParams.set("asset", request.asset);

  if (request.amount) url.searchParams.set("amount", request.amount);
  if (request.memo) url.searchParams.set("memo", request.memo);

  return url.toString();
}

export function parsePaymentRequestParams(
  params: URLSearchParams,
): PaymentRequest | null {
  const recipient = params.get("to")?.trim();
  if (!recipient || !isAddress(recipient)) return null;

  const version = params.get("v")?.trim() || "1";
  const asset = params.get("asset")?.trim();

  // Backward compatibility for the original testnet-only request format.
  if (version === "1") {
    if (IS_MAINNET) return null;
    if ((asset || "USDTd") !== "USDTd") return null;

    try {
      return createPaymentRequest({
        recipient,
        amount: params.get("amount") ?? undefined,
        memo: params.get("memo") ?? undefined,
      });
    } catch {
      return null;
    }
  }

  if (version !== "2") return null;

  const network = params.get("network")?.trim();
  if (network !== ACTIVE_PAYMENT_NETWORK) return null;
  if (asset !== ACTIVE_USDT.symbol) return null;

  try {
    return createPaymentRequest({
      recipient,
      amount: params.get("amount") ?? undefined,
      memo: params.get("memo") ?? undefined,
    });
  } catch {
    return null;
  }
}

function parseEthereumUri(payload: string): PaymentRequest | null {
  if (!payload.toLowerCase().startsWith("ethereum:")) return null;

  const target = payload.slice("ethereum:".length).split("?")[0]?.trim();
  if (!target) return null;

  const [rawAddress, rawChainId] = target.split("@");
  const address = rawAddress?.trim();
  if (!address || !isAddress(address)) return null;

  if (rawChainId) {
    const parsedChainId = Number(rawChainId);
    if (!Number.isInteger(parsedChainId) || parsedChainId !== ACTIVE_CELO_CHAIN.id) {
      return null;
    }
  }

  return createPaymentRequest({ recipient: address });
}

export function parsePaymentRequestPayload(payload: string): PaymentRequest | null {
  const value = payload.trim();
  if (!value) return null;

  if (isAddress(value)) {
    return createPaymentRequest({ recipient: value });
  }

  const ethereumRequest = parseEthereumUri(value);
  if (ethereumRequest) return ethereumRequest;

  try {
    const url = new URL(value);
    if (url.pathname !== "/pay") return null;
    return parsePaymentRequestParams(url.searchParams);
  } catch {
    return null;
  }
}
