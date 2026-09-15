import { createPublicClient, fallback, http } from "viem";
import { ACTIVE_CELO_CHAIN, IS_MAINNET } from "@/lib/celo";

const DEFAULT_PRIMARY_RPC = ACTIVE_CELO_CHAIN.rpcUrls.default.http[0];

function configuredRpcUrls() {
  const primary = IS_MAINNET
    ? process.env.CELO_MAINNET_RPC_PRIMARY?.trim() || DEFAULT_PRIMARY_RPC
    : process.env.CELO_SEPOLIA_RPC_PRIMARY?.trim() || DEFAULT_PRIMARY_RPC;

  const secondary = IS_MAINNET
    ? process.env.CELO_MAINNET_RPC_SECONDARY?.trim() || undefined
    : process.env.CELO_SEPOLIA_RPC_SECONDARY?.trim() || undefined;

  return secondary && secondary !== primary ? [primary, secondary] : [primary];
}

function createCeloServerClient() {
  const transports = configuredRpcUrls().map((url) => http(url));
  return createPublicClient({
    chain: ACTIVE_CELO_CHAIN,
    transport: transports.length === 1 ? transports[0] : fallback(transports),
  });
}

let publicClient: ReturnType<typeof createCeloServerClient> | null = null;

export function getServerCeloPublicClient() {
  if (!publicClient) publicClient = createCeloServerClient();
  return publicClient;
}

export type RpcHealthItem = {
  role: "primary" | "secondary";
  configured: boolean;
  healthy: boolean;
  latencyMs?: number;
  blockNumber?: string;
  error?: string;
};

async function checkRpc(
  role: "primary" | "secondary",
  url?: string,
): Promise<RpcHealthItem> {
  if (!url) {
    return { role, configured: false, healthy: false };
  }

  const started = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_blockNumber",
          params: [],
        }),
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const body = (await response.json()) as {
        result?: string;
        error?: { message?: string };
      };

      if (!body.result || body.error) {
        throw new Error(body.error?.message || "Invalid RPC response");
      }

      return {
        role,
        configured: true,
        healthy: true,
        latencyMs: Date.now() - started,
        blockNumber: BigInt(body.result).toString(),
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return {
      role,
      configured: true,
      healthy: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "RPC health check failed",
    };
  }
}

export async function getCeloRpcHealth() {
  const [primary, secondary] = configuredRpcUrls();
  return Promise.all([
    checkRpc("primary", primary),
    checkRpc("secondary", secondary),
  ]);
}
