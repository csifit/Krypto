import { formatUnits, isAddress, parseUnits } from "viem";
import { BASE_USDC, CELO_USDC } from "@/lib/assets";
import type {
  KryptoRelayQuote,
  KryptoRelayStatus,
  RelayExecutionStep,
} from "@/lib/relay/types";

const RELAY_API = "https://api.relay.link";
const CELO_CHAIN_ID = 42220;
const BASE_CHAIN_ID = 8453;
const QUOTE_TTL_MS = 2 * 60 * 1000;

function relayHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = process.env.RELAY_API_KEY?.trim();
  if (apiKey) headers["x-api-key"] = apiKey;
  return headers;
}

function equalAddress(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function isHex(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]*$/.test(value);
}

function sanitizeSteps(input: unknown, sourceWallet: `0x${string}`) {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error("Relay did not return executable steps");
  }

  const result: RelayExecutionStep[] = input.map((raw) => {
    const step = raw as {
      id?: unknown;
      action?: unknown;
      description?: unknown;
      kind?: unknown;
      requestId?: unknown;
      items?: unknown;
    };

    if (step.kind !== "transaction") {
      throw new Error("Relay returned an unsupported signature step");
    }
    if (!Array.isArray(step.items) || step.items.length === 0) {
      throw new Error("Relay returned an empty execution step");
    }

    const items = step.items.map((rawItem) => {
      const item = rawItem as { status?: unknown; data?: Record<string, unknown> };
      const data = item.data ?? {};
      const from = data.from;
      const to = data.to;
      const callData = data.data;
      const value = data.value;
      const chainId = data.chainId;

      if (
        typeof from !== "string" ||
        !isAddress(from) ||
        !equalAddress(from, sourceWallet) ||
        typeof to !== "string" ||
        !isAddress(to) ||
        !isHex(callData) ||
        (typeof value !== "string" && typeof value !== "number") ||
        Number(chainId) !== CELO_CHAIN_ID
      ) {
        throw new Error("Relay returned invalid Celo transaction data");
      }

      return {
        status: typeof item.status === "string" ? item.status : "incomplete",
        data: {
          from: from as `0x${string}`,
          to: to as `0x${string}`,
          data: callData,
          value: String(value),
          chainId: CELO_CHAIN_ID,
        },
      };
    });

    return {
      id: typeof step.id === "string" ? step.id : "relay-step",
      action: typeof step.action === "string" ? step.action : undefined,
      description: typeof step.description === "string" ? step.description : undefined,
      kind: "transaction" as const,
      requestId: typeof step.requestId === "string" ? step.requestId : undefined,
      items,
    };
  });

  return result;
}

export async function getRelayUsdcToBaseQuote(input: {
  sourceWallet: `0x${string}`;
  recipient: `0x${string}`;
  destinationAmount: string;
}): Promise<KryptoRelayQuote> {
  const destinationRaw = parseUnits(input.destinationAmount, BASE_USDC.decimals);

  const response = await fetch(`${RELAY_API}/quote/v2`, {
    method: "POST",
    headers: relayHeaders(),
    body: JSON.stringify({
      user: input.sourceWallet,
      recipient: input.recipient,
      refundTo: input.sourceWallet,
      originChainId: CELO_CHAIN_ID,
      destinationChainId: BASE_CHAIN_ID,
      originCurrency: CELO_USDC.contractAddress,
      destinationCurrency: BASE_USDC.contractAddress,
      amount: destinationRaw.toString(),
      tradeType: "EXACT_OUTPUT",
      enableTrueExactOutput: true,
      usePermit: false,
      referrer: "krypto121",
    }),
    cache: "no-store",
  });

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
          : "Relay could not quote this payment";
    throw new Error(message);
  }

  const details = (body.details ?? {}) as Record<string, unknown>;
  const currencyIn = (details.currencyIn ?? {}) as Record<string, unknown>;
  const currencyOut = (details.currencyOut ?? {}) as Record<string, unknown>;
  const inCurrency = (currencyIn.currency ?? {}) as Record<string, unknown>;
  const outCurrency = (currencyOut.currency ?? {}) as Record<string, unknown>;

  const sourceAmountRaw = String(currencyIn.amount ?? "");
  const destinationAmountRaw = String(currencyOut.amount ?? "");
  const sourceAmount = String(currencyIn.amountFormatted ?? "");
  const destinationAmount = String(currencyOut.amountFormatted ?? "");

  if (
    Number(inCurrency.chainId) !== CELO_CHAIN_ID ||
    typeof inCurrency.address !== "string" ||
    !equalAddress(inCurrency.address, CELO_USDC.contractAddress) ||
    Number(outCurrency.chainId) !== BASE_CHAIN_ID ||
    typeof outCurrency.address !== "string" ||
    !equalAddress(outCurrency.address, BASE_USDC.contractAddress) ||
    !/^\d+$/.test(sourceAmountRaw) ||
    !/^\d+$/.test(destinationAmountRaw) ||
    !sourceAmount ||
    !destinationAmount ||
    BigInt(destinationAmountRaw) < destinationRaw
  ) {
    throw new Error("Relay returned a quote for an unexpected route");
  }

  const steps = sanitizeSteps(body.steps, input.sourceWallet);
  const requestId = steps.map((step) => step.requestId).find(Boolean);

  if (!requestId) {
    throw new Error("Relay quote did not include a request ID");
  }

  const routeCostRaw = BigInt(sourceAmountRaw) > BigInt(destinationAmountRaw)
    ? BigInt(sourceAmountRaw) - BigInt(destinationAmountRaw)
    : BigInt(0);

  return {
    requestId,
    sourceAmount,
    sourceAmountRaw,
    destinationAmount,
    destinationAmountRaw,
    routeCostAmount: formatUnits(routeCostRaw, 6),
    estimatedDurationSeconds:
      typeof details.timeEstimate === "number" ? details.timeEstimate : undefined,
    expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
    originChainId: CELO_CHAIN_ID,
    destinationChainId: BASE_CHAIN_ID,
    originCurrency: CELO_USDC.contractAddress,
    destinationCurrency: BASE_USDC.contractAddress,
    recipient: input.recipient,
    sourceWallet: input.sourceWallet,
    steps,
  };
}

export async function getRelayStatus(requestId: string): Promise<KryptoRelayStatus> {
  const response = await fetch(
    `${RELAY_API}/intents/status/v3?requestId=${encodeURIComponent(requestId)}`,
    {
      headers: relayHeaders(),
      cache: "no-store",
    },
  );

  const body = (await response.json().catch(() => ({}))) as {
    status?: string;
    originChainId?: number;
    destinationChainId?: number;
    inTxHashes?: string[];
    txHashes?: string[];
  };

  if (!response.ok) {
    throw new Error("Could not check Relay settlement status");
  }

  const inTxHashes = (body.inTxHashes ?? []).filter(isHex);
  const txHashes = (body.txHashes ?? []).filter(isHex);

  const allowed = new Set([
    "waiting", "depositing", "pending", "submitted",
    "success", "failure", "refund", "fallback",
  ]);

  return {
    requestId,
    status: allowed.has(body.status ?? "")
      ? (body.status as KryptoRelayStatus["status"])
      : "unknown",
    originChainId: body.originChainId,
    destinationChainId: body.destinationChainId,
    inTxHashes,
    txHashes,
    destinationTxHash: txHashes[0],
  };
}
