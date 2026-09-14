import { getSupabaseAdmin } from "@/lib/server/supabase";

export async function ensureProfile(
  privyUserId: string,
  walletAddress?: string,
) {
  const supabase = getSupabaseAdmin();

  const row: Record<string, string> = {
    privy_user_id: privyUserId,
  };

  if (walletAddress) row.wallet_address = walletAddress;

  const { data, error } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "privy_user_id" })
    .select("id, privy_user_id, wallet_address, created_at, updated_at")
    .single();

  if (error) throw error;
  return data;
}
