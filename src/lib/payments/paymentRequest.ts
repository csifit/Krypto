import { isAddress } from "viem";
import {
  ACTIVE_CELO_CHAIN,
  ACTIVE_PAYMENT_NETWORK,
  IS_MAINNET,
  type CeloPaymentNetwork,
} from "@/lib/celo";
import {
  DEFAULT_STABLECOIN,
  getActiveStablecoin,
  type StablecoinSymbol,
} from "@/lib/assets";

export type PaymentRequest = {
  version: 3 | 4;
  requestId?: string;
  recipient: `0x${string}`;
  network: CeloPaymentNetwork;
  asset: StablecoinSymbol;
  amount?: string;
  memo?: string;
};

const MAX_MEMO_LENGTH = 120;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeAmount(value: string | undefined, assetSymbol: StablecoinSymbol) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const asset = getActiveStablecoin(assetSymbol);
  if (!asset) throw new Error("Unsupported payment asset");

  if (!/^\d+(?:\.\d{1,6})?$/.test(trimmed)) {
    throw new Error(`Enter a valid ${asset.symbol} amount with up to 6 decimal places`);
  }

  const number = Number(trimmed);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  return trimmed;
}

export function createPaymentRequest(input: {
  recipient: string;
  asset?: StablecoinSymbol;
  amount?: string;
  memo?: string;
  requestId?: string;
}): PaymentRequest {
  const recipient = input.recipient.trim();
  const asset = input.asset ?? DEFAULT_STABLECOIN.symbol;

  if (!isAddress(recipient)) throw new Error("Enter a valid wallet address");
  if (!getActiveStablecoin(asset)) throw new Error("Unsupported payment asset");

  const memo = input.memo?.trim();
  if (memo && memo.length > MAX_MEMO_LENGTH) {
    throw new Error(`Reference must be ${MAX_MEMO_LENGTH} characters or less`);
  }

  if (input.requestId && !UUID_RE.test(input.requestId)) {
    throw new Error("Invalid Krypto121 payment request reference");
  }

  return {
    version: input.requestId ? 4 : 3,
    requestId: input.requestId,
    recipient: recipient as `0x${string}`,
    network: ACTIVE_PAYMENT_NETWORK,
    asset,
    amount: normalizeAmount(input.amount, asset),
    memo: memo || undefined,
  };
}

export function buildPaymentRequestLink(origin: string, request: PaymentRequest) {
  const url = new URL("/pay", origin);
  url.searchParams.set("v", String(request.version));
  url.searchParams.set("to", request.recipient);
  url.searchParams.set("network", request.network);
  url.searchParams.set("asset", request.asset);

  if (request.requestId) url.searchParams.set("request", request.requestId);
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
  const requestedAsset = params.get("asset")?.trim();

  if (version === "1") {
    if (IS_MAINNET) return null;
    if ((requestedAsset || "USDTd") !== "USDTd") return null;
    try {
      return createPaymentRequest({
        recipient,
        asset: "USDTd",
        amount: params.get("amount") ?? undefined,
        memo: params.get("memo") ?? undefined,
      });
    } catch {
      return null;
    }
  }

  const network = params.get("network")?.trim();
  if (network !== ACTIVE_PAYMENT_NETWORK) return null;

  if (version === "2") {
    const legacyAsset = IS_MAINNET ? "USDT" : "USDTd";
    if (requestedAsset !== legacyAsset) return null;
    try {
      return createPaymentRequest({
        recipient,
        asset: legacyAsset,
        amount: params.get("amount") ?? undefined,
        memo: params.get("memo") ?? undefined,
      });
    } catch {
      return null;
    }
  }

  if ((version !== "3" && version !== "4") || !requestedAsset) return null;

  const activeAsset = getActiveStablecoin(requestedAsset);
  if (!activeAsset) return null;

  const requestId = version === "4" ? params.get("request")?.trim() : undefined;
  if (version === "4" && (!requestId || !UUID_RE.test(requestId))) return null;

  try {
    return createPaymentRequest({
      recipient,
      asset: activeAsset.symbol,
      amount: params.get("amount") ?? undefined,
      memo: params.get("memo") ?? undefined,
      requestId,
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

  if (isAddress(value)) return createPaymentRequest({ recipient: value });

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
