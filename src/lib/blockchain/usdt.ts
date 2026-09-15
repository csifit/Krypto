import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  erc20Abi,
  formatEther,
  formatUnits,
  hexToBigInt,
  http,
  isAddress,
  parseUnits,
  type Hex,
} from "viem";
import {
  ACTIVE_CELO_CHAIN,
  ACTIVE_USDT,
  CELO_MAINNET_USDT_FEE_ADAPTER,
  CELO_SEPOLIA_TEST_USDT,
  IS_MAINNET,
  celoMainnet,
} from "@/lib/celo";
import type { WalletProvider } from "@/lib/wallet/types";

const publicClient = createPublicClient({
  chain: ACTIVE_CELO_CHAIN,
  transport: http(ACTIVE_CELO_CHAIN.rpcUrls.default.http[0]),
});

const celoMainnetFeeClient = createPublicClient({
  chain: celoMainnet,
  transport: http(celoMainnet.rpcUrls.default.http[0]),
});

const mintAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

async function getCeloFeeCurrencyGasPrice(
  feeCurrency: `0x${string}`,
): Promise<bigint> {
  const response = await fetch(celoMainnet.rpcUrls.default.http[0], {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_gasPrice",
      params: [feeCurrency],
    }),
    cache: "no-store",
  });

  const body = (await response.json()) as {
    result?: Hex;
    error?: {
      code?: number;
      message?: string;
    };
  };

  if (!response.ok) {
    throw new Error(`Celo RPC returned HTTP ${response.status}`);
  }

  if (body.error) {
    throw new Error(body.error.message || "Celo RPC rejected fee-currency gas price request");
  }

  if (!body.result) {
    throw new Error("Celo RPC did not return a fee-currency gas price");
  }

  return hexToBigInt(body.result);
}

export async function readUsdtBalance(address: `0x${string}`) {
  const rawBalance = await publicClient.readContract({
    address: ACTIVE_USDT.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });

  return {
    raw: rawBalance,
    formatted: formatUnits(rawBalance, ACTIVE_USDT.decimals),
  };
}

export async function readCeloBalance(address: `0x${string}`) {
  const rawBalance = await publicClient.getBalance({ address });

  return {
    raw: rawBalance,
    formatted: formatEther(rawBalance),
  };
}

export type DirectTransferPreflight = {
  routeAvailable: boolean;
  networkFeeReady: boolean;
  feeMode: "usdt" | "native";
  estimatedNetworkFeeAmount?: string;
  estimatedFeeWei?: bigint;
  requiredFeeWei?: bigint;
  error?: string;
};

async function checkUsdtFeePreflight(input: {
  sourceWallet: `0x${string}`;
  recipient: `0x${string}`;
  amount: string;
  transferData: Hex;
}): Promise<DirectTransferPreflight> {
  const adapter = CELO_MAINNET_USDT_FEE_ADAPTER.address;

  try {
    const gasPrice = await getCeloFeeCurrencyGasPrice(adapter);

    const [gas, adaptedBalance] = await Promise.all([
      celoMainnetFeeClient.estimateGas({
        account: input.sourceWallet,
        to: ACTIVE_USDT.address,
        data: input.transferData,
        feeCurrency: adapter,
      }),
      celoMainnetFeeClient.readContract({
        address: adapter,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [input.sourceWallet],
      }),
    ]);

    const estimatedFeeWei = gas * gasPrice;
    const requiredFeeWei = (estimatedFeeWei * BigInt(125)) / BigInt(100);

    // The fee adapter exposes a normalized 18-decimal balance for fee accounting.
    const transferAmount18 = parseUnits(input.amount, 18);
    const networkFeeReady =
      adaptedBalance >= transferAmount18 + requiredFeeWei;

    return {
      routeAvailable: true,
      networkFeeReady,
      feeMode: "usdt",
      estimatedNetworkFeeAmount: formatEther(estimatedFeeWei),
      estimatedFeeWei,
      requiredFeeWei,
    };
  } catch {
    return {
      routeAvailable: false,
      networkFeeReady: false,
      feeMode: "usdt",
      error: "Could not verify USDT network-fee readiness right now",
    };
  }
}

export async function checkDirectTransferPreflight(input: {
  sourceWallet: `0x${string}`;
  recipient: `0x${string}`;
  amount: string;
  payFeesInUsdt?: boolean;
}): Promise<DirectTransferPreflight> {
  let rawAmount: bigint;

  try {
    rawAmount = parseUnits(input.amount, ACTIVE_USDT.decimals);
  } catch {
    return {
      routeAvailable: false,
      networkFeeReady: false,
      feeMode: input.payFeesInUsdt ? "usdt" : "native",
      error: "Enter a valid amount",
    };
  }

  if (rawAmount <= BigInt(0)) {
    return {
      routeAvailable: false,
      networkFeeReady: false,
      feeMode: input.payFeesInUsdt ? "usdt" : "native",
      error: "Amount must be greater than zero",
    };
  }

  const transferData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [input.recipient, rawAmount],
  });

  if (IS_MAINNET && input.payFeesInUsdt) {
    return checkUsdtFeePreflight({
      sourceWallet: input.sourceWallet,
      recipient: input.recipient,
      amount: input.amount,
      transferData,
    });
  }

  try {
    const [gas, gasPrice, nativeBalance] = await Promise.all([
      publicClient.estimateContractGas({
        address: ACTIVE_USDT.address,
        abi: erc20Abi,
        functionName: "transfer",
        args: [input.recipient, rawAmount],
        account: input.sourceWallet,
      }),
      publicClient.getGasPrice(),
      publicClient.getBalance({ address: input.sourceWallet }),
    ]);

    const estimatedFeeWei = gas * gasPrice;
    const requiredFeeWei = (estimatedFeeWei * BigInt(125)) / BigInt(100);

    return {
      routeAvailable: true,
      networkFeeReady: nativeBalance >= requiredFeeWei,
      feeMode: "native",
      estimatedFeeWei,
      requiredFeeWei,
    };
  } catch {
    return {
      routeAvailable: false,
      networkFeeReady: false,
      feeMode: "native",
      error: "Could not verify the payment route right now",
    };
  }
}

async function sendContractTransaction(
  wallet: WalletProvider,
  to: `0x${string}`,
  data: Hex,
  payFeesInUsdt = false,
) {
  const provider = await wallet.getEip1193Provider();
  let hash: Hex;

  if (IS_MAINNET && payFeesInUsdt) {
    await wallet.switchChain(celoMainnet.id);

    const walletClient = createWalletClient({
      account: wallet.address,
      chain: celoMainnet,
      transport: custom(provider),
    });

    hash = await walletClient.sendTransaction({
      account: wallet.address,
      to,
      data,
      value: BigInt(0),
      feeCurrency: CELO_MAINNET_USDT_FEE_ADAPTER.address,
    });
  } else {
    await wallet.switchChain(ACTIVE_CELO_CHAIN.id);

    const result = await provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: wallet.address,
          to,
          data,
          value: "0x0",
        },
      ],
    });

    if (typeof result !== "string" || !result.startsWith("0x")) {
      throw new Error("Wallet did not return a transaction hash");
    }

    hash = result as Hex;
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error(`Transaction failed on ${ACTIVE_CELO_CHAIN.name}`);
  }

  return hash;
}

export async function mintTestUsdt(
  wallet: WalletProvider,
  amount = "100",
) {
  if (IS_MAINNET) {
    throw new Error("Test funding is unavailable on mainnet");
  }

  const rawAmount = parseUnits(amount, CELO_SEPOLIA_TEST_USDT.decimals);
  const data = encodeFunctionData({
    abi: mintAbi,
    functionName: "mint",
    args: [wallet.address, rawAmount],
  });

  return sendContractTransaction(
    wallet,
    CELO_SEPOLIA_TEST_USDT.address,
    data,
  );
}

export async function sendUsdt(
  wallet: WalletProvider,
  recipient: string,
  amount: string,
  options?: { payFeesInUsdt?: boolean },
) {
  if (!isAddress(recipient)) {
    throw new Error("Enter a valid Celo/EVM wallet address");
  }

  let rawAmount: bigint;
  try {
    rawAmount = parseUnits(amount, ACTIVE_USDT.decimals);
  } catch {
    throw new Error("Enter a valid amount");
  }

  if (rawAmount <= BigInt(0)) {
    throw new Error("Amount must be greater than zero");
  }

  const balance = await readUsdtBalance(wallet.address);
  if (rawAmount > balance.raw) {
    throw new Error(`Insufficient ${ACTIVE_USDT.symbol} balance`);
  }

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipient as `0x${string}`, rawAmount],
  });

  return sendContractTransaction(
    wallet,
    ACTIVE_USDT.address,
    data,
    Boolean(options?.payFeesInUsdt),
  );
}
