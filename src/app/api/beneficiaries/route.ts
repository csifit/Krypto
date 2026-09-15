import { isAddress } from "viem";
import { AccessPolicyError, requireSensitiveAction } from "@/lib/server/access";
import { AuthError, requirePrivyUser } from "@/lib/server/privy";
import { ensureProfile } from "@/lib/server/profile";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";

function mapBeneficiary(row: {
  id: string;
  name: string;
  address: string;
  created_at: string;
}) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    createdAt: row.created_at,
  };
}

export async function GET(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("beneficiaries")
      .select("id, name, address, created_at")
      .eq("privy_user_id", userId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return Response.json({ beneficiaries: (data ?? []).map(mapBeneficiary) });
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("beneficiary list failed", error);
    return Response.json({ error: "Could not load beneficiaries" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await requireSensitiveAction(userId);
    const body = (await request.json()) as {
      name?: string;
      address?: string;
      walletAddress?: string;
    };

    const name = body.name?.trim() ?? "";
    const address = body.address?.trim() ?? "";

    if (!name || name.length > 100) {
      return Response.json({ error: "Enter a beneficiary name" }, { status: 400 });
    }
    if (!isAddress(address)) {
      return Response.json({ error: "Enter a valid Celo/EVM wallet address" }, { status: 400 });
    }
    if (!body.walletAddress || !isAddress(body.walletAddress)) {
      return Response.json({ error: "Invalid account wallet" }, { status: 400 });
    }

    await ensureProfile(userId, body.walletAddress);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("beneficiaries")
      .insert({ privy_user_id: userId, name, address })
      .select("id, name, address, created_at")
      .single();

    if (error?.code === "23505") {
      return Response.json({ error: "This wallet is already saved" }, { status: 409 });
    }
    if (error) throw error;

    return Response.json({ beneficiary: mapBeneficiary(data) });
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("beneficiary create failed", error);
    return Response.json({ error: "Could not save beneficiary" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await requireSensitiveAction(userId);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Missing beneficiary id" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("beneficiaries")
      .delete()
      .eq("id", id)
      .eq("privy_user_id", userId);

    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("beneficiary delete failed", error);
    return Response.json({ error: "Could not remove beneficiary" }, { status: 500 });
  }
}
