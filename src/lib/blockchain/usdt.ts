import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  formatEther,
  formatUnits,
  http,
  isAddress,
  parseUnits,
  type Hex,
} from "viem";
import {
  ACTIVE_CELO_CHAIN,
  ACTIVE_USDT,
  CELO_SEPOLIA_TEST_USDT,
  IS_MAINNET,
} from "@/lib/celo";
import type { WalletProvider } from "@/lib/wallet/types";

const publicClient = createPublicClient({
  chain: ACTIVE_CELO_CHAIN,
  transport: http(ACTIVE_CELO_CHAIN.rpcUrls.default.http[0]),
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
  estimatedFeeWei?: bigint;
  requiredFeeWei?: bigint;
  error?: string;
};

export async function checkDirectTransferPreflight(input: {
  sourceWallet: `0x${string}`;
  recipient: `0x${string}`;
  amount: string;
}): Promise<DirectTransferPreflight> {
  let rawAmount: bigint;

  try {
    rawAmount = parseUnits(input.amount, ACTIVE_USDT.decimals);
  } catch {
    return {
      routeAvailable: false,
      networkFeeReady: false,
      error: "Enter a valid amount",
    };
  }

  if (rawAmount <= BigInt(0)) {
    return {
      routeAvailable: false,
      networkFeeReady: false,
      error: "Amount must be greater than zero",
    };
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
      estimatedFeeWei,
      requiredFeeWei,
    };
  } catch {
    return {
      routeAvailable: false,
      networkFeeReady: false,
      error: "Could not verify the payment route right now",
    };
  }
}

async function sendContractTransaction(
  wallet: WalletProvider,
  to: `0x${string}`,
  data: Hex,
) {
  await wallet.switchChain(ACTIVE_CELO_CHAIN.id);
  const provider = await wallet.getEip1193Provider();

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

  const hash = result as Hex;
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

  return sendContractTransaction(wallet, ACTIVE_USDT.address, data);
}
