import { isAddress } from "viem";

export type PaymentRequest = {
  version: 1;
  recipient: `0x${string}`;
  asset: "USDTd";
  amount?: string;
  memo?: string;
};

const MAX_MEMO_LENGTH = 120;

function normalizeAmount(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  if (!/^\d+(?:\.\d{1,6})?$/.test(trimmed)) {
    throw new Error("Enter a valid USDTd amount with up to 6 decimal places");
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
    version: 1,
    recipient: recipient as `0x${string}`,
    asset: "USDTd",
    amount: normalizeAmount(input.amount),
    memo: memo || undefined,
  };
}

export function buildPaymentRequestLink(origin: string, request: PaymentRequest) {
  const url = new URL("/pay", origin);
  url.searchParams.set("v", String(request.version));
  url.searchParams.set("to", request.recipient);
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

  const asset = params.get("asset")?.trim() || "USDTd";
  if (asset !== "USDTd") return null;

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

  const raw = payload.slice("ethereum:".length).split("?")[0]?.split("@")[0]?.trim();
  if (!raw || !isAddress(raw)) return null;

  return createPaymentRequest({ recipient: raw });
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
