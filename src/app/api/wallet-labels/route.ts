import { isAddress } from "viem";
import { AuthError, requirePrivyUser } from "@/lib/server/privy";
import { ensureProfile } from "@/lib/server/profile";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";

function mapWalletLabel(row: {
  address: string;
  label: string;
  updated_at: string;
}) {
  return {
    address: row.address,
    label: row.label,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await ensureProfile(userId);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("wallet_labels")
      .select("address, label, updated_at")
      .eq("privy_user_id", userId)
      .order("updated_at", { ascending: true });

    if (error) throw error;

    return Response.json({ walletLabels: (data ?? []).map(mapWalletLabel) });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("wallet labels list failed", error);
    return Response.json({ error: "Could not load wallet names" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await ensureProfile(userId);

    const body = (await request.json()) as {
      address?: string;
      label?: string;
    };

    const address = body.address?.trim();
    const label = body.label?.trim();

    if (!address || !isAddress(address)) {
      return Response.json({ error: "Enter a valid wallet address" }, { status: 400 });
    }

    if (!label || label.length > 100) {
      return Response.json({ error: "Enter a wallet name" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("wallet_labels")
      .upsert(
        {
          privy_user_id: userId,
          address,
          label,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "privy_user_id,address_key" },
      )
      .select("address, label, updated_at")
      .single();

    if (error) throw error;

    return Response.json({ walletLabel: mapWalletLabel(data) });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("wallet label save failed", error);
    return Response.json({ error: "Could not save wallet name" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    const address = new URL(request.url).searchParams.get("address")?.trim();

    if (!address || !isAddress(address)) {
      return Response.json({ error: "Valid wallet address is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("wallet_labels")
      .delete()
      .eq("privy_user_id", userId)
      .eq("address_key", address.toLowerCase());

    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("wallet label delete failed", error);
    return Response.json({ error: "Could not reset wallet name" }, { status: 500 });
  }
}
