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
  CELO_SEPOLIA_TEST_USDT,
  IS_MAINNET,
  celoMainnet,
} from "@/lib/celo";
import {
  DEFAULT_STABLECOIN,
  requireActiveStablecoin,
  type StablecoinSymbol,
  type SupportedStablecoin,
} from "@/lib/assets";
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
    headers: { "Content-Type": "application/json" },
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
    error?: { code?: number; message?: string };
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

export async function readStablecoinBalance(
  address: `0x${string}`,
  asset: SupportedStablecoin,
) {
  const rawBalance = await publicClient.readContract({
    address: asset.contractAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });

  return {
    raw: rawBalance,
    formatted: formatUnits(rawBalance, asset.decimals),
  };
}

// Compatibility for the test-funding and older balance hook.
export async function readUsdtBalance(address: `0x${string}`) {
  return readStablecoinBalance(address, DEFAULT_STABLECOIN);
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
  feeMode: "stablecoin" | "native";
  feeAssetSymbol?: StablecoinSymbol;
  estimatedNetworkFeeAmount?: string;
  estimatedFeeWei?: bigint;
  requiredFeeWei?: bigint;
  error?: string;
};

async function checkStablecoinFeePreflight(input: {
  sourceWallet: `0x${string}`;
  amount: string;
  transferData: Hex;
  asset: SupportedStablecoin;
}): Promise<DirectTransferPreflight> {
  const adapter = input.asset.feeCurrencyAdapter;

  if (!adapter) {
    return {
      routeAvailable: false,
      networkFeeReady: false,
      feeMode: "stablecoin",
      feeAssetSymbol: input.asset.symbol,
      error: `${input.asset.symbol} cannot currently be used for network fees`,
    };
  }

  try {
    const gasPrice = await getCeloFeeCurrencyGasPrice(adapter);

    const [gas, adaptedBalance] = await Promise.all([
      celoMainnetFeeClient.estimateGas({
        account: input.sourceWallet,
        to: input.asset.contractAddress,
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
    const transferAmount18 = parseUnits(input.amount, 18);

    return {
      routeAvailable: true,
      networkFeeReady: adaptedBalance >= transferAmount18 + requiredFeeWei,
      feeMode: "stablecoin",
      feeAssetSymbol: input.asset.symbol,
      estimatedNetworkFeeAmount: formatEther(estimatedFeeWei),
      estimatedFeeWei,
      requiredFeeWei,
    };
  } catch {
    return {
      routeAvailable: false,
      networkFeeReady: false,
      feeMode: "stablecoin",
      feeAssetSymbol: input.asset.symbol,
      error: `Could not verify ${input.asset.symbol} network-fee readiness right now`,
    };
  }
}

export async function checkDirectTransferPreflight(input: {
  sourceWallet: `0x${string}`;
  recipient: `0x${string}`;
  amount: string;
  assetSymbol: StablecoinSymbol;
  payFeesInStablecoin?: boolean;
}): Promise<DirectTransferPreflight> {
  const asset = requireActiveStablecoin(input.assetSymbol);
  let rawAmount: bigint;

  try {
    rawAmount = parseUnits(input.amount, asset.decimals);
  } catch {
    return {
      routeAvailable: false,
      networkFeeReady: false,
      feeMode: input.payFeesInStablecoin ? "stablecoin" : "native",
      feeAssetSymbol: input.payFeesInStablecoin ? asset.symbol : undefined,
      error: "Enter a valid amount",
    };
  }

  if (rawAmount <= BigInt(0)) {
    return {
      routeAvailable: false,
      networkFeeReady: false,
      feeMode: input.payFeesInStablecoin ? "stablecoin" : "native",
      feeAssetSymbol: input.payFeesInStablecoin ? asset.symbol : undefined,
      error: "Amount must be greater than zero",
    };
  }

  const transferData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [input.recipient, rawAmount],
  });

  if (IS_MAINNET && input.payFeesInStablecoin) {
    return checkStablecoinFeePreflight({
      sourceWallet: input.sourceWallet,
      amount: input.amount,
      transferData,
      asset,
    });
  }

  try {
    const [gas, gasPrice, nativeBalance] = await Promise.all([
      publicClient.estimateContractGas({
        address: asset.contractAddress,
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
  asset: SupportedStablecoin,
  data: Hex,
  payFeesInStablecoin = false,
) {
  const provider = await wallet.getEip1193Provider();
  let hash: Hex;

  if (IS_MAINNET && payFeesInStablecoin && asset.feeCurrencyAdapter) {
    await wallet.switchChain(celoMainnet.id);

    const walletClient = createWalletClient({
      account: wallet.address,
      chain: celoMainnet,
      transport: custom(provider),
    });

    hash = await walletClient.sendTransaction({
      account: wallet.address,
      to: asset.contractAddress,
      data,
      value: BigInt(0),
      feeCurrency: asset.feeCurrencyAdapter,
    });
  } else {
    await wallet.switchChain(ACTIVE_CELO_CHAIN.id);

    const result = await provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: wallet.address,
          to: asset.contractAddress,
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

  return sendContractTransaction(wallet, DEFAULT_STABLECOIN, data);
}

export async function sendStablecoin(
  wallet: WalletProvider,
  recipient: string,
  amount: string,
  assetSymbol: StablecoinSymbol,
  options?: { payFeesInStablecoin?: boolean },
) {
  const asset = requireActiveStablecoin(assetSymbol);

  if (!isAddress(recipient)) {
    throw new Error("Enter a valid Celo/EVM wallet address");
  }

  let rawAmount: bigint;
  try {
    rawAmount = parseUnits(amount, asset.decimals);
  } catch {
    throw new Error("Enter a valid amount");
  }

  if (rawAmount <= BigInt(0)) {
    throw new Error("Amount must be greater than zero");
  }

  const balance = await readStablecoinBalance(wallet.address, asset);
  if (rawAmount > balance.raw) {
    throw new Error(`Insufficient ${asset.symbol} balance`);
  }

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipient as `0x${string}`, rawAmount],
  });

  return sendContractTransaction(
    wallet,
    asset,
    data,
    Boolean(options?.payFeesInStablecoin),
  );
}

// Compatibility alias retained for any older direct callers.
export async function sendUsdt(
  wallet: WalletProvider,
  recipient: string,
  amount: string,
  options?: { payFeesInUsdt?: boolean },
) {
  return sendStablecoin(
    wallet,
    recipient,
    amount,
    DEFAULT_STABLECOIN.symbol,
    { payFeesInStablecoin: options?.payFeesInUsdt },
  );
}
