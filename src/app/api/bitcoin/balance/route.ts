import { looksLikeBitcoinMainnetAddress } from "@/lib/bitcoin/address";
import { AuthError, requirePrivyUser } from "@/lib/server/privy";
import { readBitcoinBalance } from "@/lib/server/bitcoin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requirePrivyUser(request);
    const address = new URL(request.url).searchParams.get("address")?.trim();

    if (!address || !looksLikeBitcoinMainnetAddress(address)) {
      return Response.json({ error: "Enter a valid Bitcoin address" }, { status: 400 });
    }

    return Response.json(await readBitcoinBalance(address));
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("bitcoin balance failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not read Bitcoin balance" },
      { status: 502 },
    );
  }
}
