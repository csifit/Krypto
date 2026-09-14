import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import { CELO_SEPOLIA_USDT, celoSepolia } from "@/lib/celo";

const publicClient = createPublicClient({
  chain: celoSepolia,
  transport: http(celoSepolia.rpcUrls.default.http[0]),
});

export async function readUsdtBalance(address: `0x${string}`) {
  const rawBalance = await publicClient.readContract({
    address: CELO_SEPOLIA_USDT.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });

  return {
    raw: rawBalance,
    formatted: formatUnits(rawBalance, CELO_SEPOLIA_USDT.decimals),
  };
}
