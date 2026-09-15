import { isAddress } from "viem";
import { looksLikeBitcoinMainnetAddress } from "@/lib/bitcoin/address";
import { validateBitcoinAddress } from "@/lib/server/bitcoin";
import { AccessPolicyError, requireSensitiveAction } from "@/lib/server/access";
import { AuthError, requirePrivyUser } from "@/lib/server/privy";
import { ensureProfile } from "@/lib/server/profile";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";

function mapWatchWallet(row: {
  id: string;
  label: string;
  address: string;
  chain_type: string;
  created_at: string;
}) {
  return {
    id: row.id,
    label: row.label,
    address: row.address,
    chainType: row.chain_type,
    createdAt: row.created_at,
  };
}

export async function GET(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await ensureProfile(userId);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("watch_wallets")
      .select("id, label, address, chain_type, created_at")
      .eq("privy_user_id", userId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return Response.json({ watchWallets: (data ?? []).map(mapWatchWallet) });
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("watch wallets list failed", error);
    return Response.json({ error: "Could not load watch-only wallets" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await requireSensitiveAction(userId);
    await ensureProfile(userId);

    const body = (await request.json()) as {
      label?: string;
      address?: string;
      chainType?: "ethereum" | "bitcoin";
    };

    const label = body.label?.trim();
    const address = body.address?.trim();
    const chainType = body.chainType === "bitcoin" ? "bitcoin" : "ethereum";

    if (!label || label.length > 100) {
      return Response.json({ error: "Enter a wallet label" }, { status: 400 });
    }

    if (!address) {
      return Response.json({ error: "Enter a wallet address" }, { status: 400 });
    }

    if (chainType === "ethereum" && !isAddress(address)) {
      return Response.json({ error: "Enter a valid stablecoin wallet address" }, { status: 400 });
    }

    if (chainType === "bitcoin") {
      if (!looksLikeBitcoinMainnetAddress(address)) {
        return Response.json({ error: "Enter a valid Bitcoin address" }, { status: 400 });
      }

      try {
        const valid = await validateBitcoinAddress(address);
        if (!valid) {
          return Response.json({ error: "Enter a valid Bitcoin address" }, { status: 400 });
        }
      } catch (error) {
        console.error("bitcoin address validation failed", error);
        return Response.json(
          { error: "Could not verify the Bitcoin address right now" },
          { status: 503 },
        );
      }
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("watch_wallets")
      .insert({
        privy_user_id: userId,
        label,
        address,
        chain_type: chainType,
      })
      .select("id, label, address, chain_type, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return Response.json({ error: "That wallet is already saved" }, { status: 409 });
      }
      throw error;
    }

    return Response.json({ watchWallet: mapWatchWallet(data) }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("watch wallet create failed", error);
    return Response.json({ error: "Could not save watch-only wallet" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await requireSensitiveAction(userId);
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return Response.json({ error: "Wallet ID is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("watch_wallets")
      .delete()
      .eq("id", id)
      .eq("privy_user_id", userId);

    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("watch wallet delete failed", error);
    return Response.json({ error: "Could not remove watch-only wallet" }, { status: 500 });
  }
}
