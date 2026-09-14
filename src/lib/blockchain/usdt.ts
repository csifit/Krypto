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
import { CELO_SEPOLIA_TEST_USDT, celoSepolia } from "@/lib/celo";
import type { WalletProvider } from "@/lib/wallet/types";

const publicClient = createPublicClient({
  chain: celoSepolia,
  transport: http(celoSepolia.rpcUrls.default.http[0]),
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
    address: CELO_SEPOLIA_TEST_USDT.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });

  return {
    raw: rawBalance,
    formatted: formatUnits(rawBalance, CELO_SEPOLIA_TEST_USDT.decimals),
  };
}

export async function readCeloBalance(address: `0x${string}`) {
  const rawBalance = await publicClient.getBalance({ address });

  return {
    raw: rawBalance,
    formatted: formatEther(rawBalance),
  };
}

async function sendContractTransaction(
  wallet: WalletProvider,
  to: `0x${string}`,
  data: Hex,
) {
  await wallet.switchChain(celoSepolia.id);
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
    throw new Error("Transaction failed on Celo Sepolia");
  }

  return hash;
}

export async function mintTestUsdt(
  wallet: WalletProvider,
  amount = "100",
) {
  const rawAmount = parseUnits(amount, CELO_SEPOLIA_TEST_USDT.decimals);
  const data = encodeFunctionData({
    abi: mintAbi,
    functionName: "mint",
    args: [wallet.address, rawAmount],
  });

  return sendContractTransaction(wallet, CELO_SEPOLIA_TEST_USDT.address, data);
}

export async function sendTestUsdt(
  wallet: WalletProvider,
  recipient: string,
  amount: string,
) {
  if (!isAddress(recipient)) {
    throw new Error("Enter a valid Celo/EVM wallet address");
  }

  let rawAmount: bigint;
  try {
    rawAmount = parseUnits(amount, CELO_SEPOLIA_TEST_USDT.decimals);
  } catch {
    throw new Error("Enter a valid amount");
  }

  if (rawAmount <= BigInt(0)) {
    throw new Error("Amount must be greater than zero");
  }

  const balance = await readUsdtBalance(wallet.address);
  if (rawAmount > balance.raw) {
    throw new Error("Insufficient test USDT balance");
  }

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipient as `0x${string}`, rawAmount],
  });

  return sendContractTransaction(wallet, CELO_SEPOLIA_TEST_USDT.address, data);
}
