import { isAddress } from "viem";
import { AuthError, requirePrivyUser } from "@/lib/server/privy";
import { ensureProfile } from "@/lib/server/profile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    const body = (await request.json()) as { walletAddress?: string };

    if (!body.walletAddress || !isAddress(body.walletAddress)) {
      return Response.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const profile = await ensureProfile(userId, body.walletAddress);
    return Response.json({ profile });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("profile sync failed", error);
    return Response.json({ error: "Could not sync profile" }, { status: 500 });
  }
}
