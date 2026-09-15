import { getSupabaseAdmin } from "@/lib/server/supabase";

export type AccountRole = "user" | "super_admin";
export type AccountStatus = "active" | "suspended" | "blocked";

export type AccountProfile = {
  id: string;
  privyUserId: string;
  walletAddress?: string;
  email?: string;
  role: AccountRole;
  accountStatus: AccountStatus;
  statusReason?: string;
  statusChangedAt?: string;
  createdAt: string;
  updatedAt: string;
};

function mapProfile(row: {
  id: string;
  privy_user_id: string;
  wallet_address: string | null;
  email: string | null;
  role: string;
  account_status: string;
  status_reason: string | null;
  status_changed_at: string | null;
  created_at: string;
  updated_at: string;
}): AccountProfile {
  return {
    id: row.id,
    privyUserId: row.privy_user_id,
    walletAddress: row.wallet_address ?? undefined,
    email: row.email ?? undefined,
    role: row.role as AccountRole,
    accountStatus: row.account_status as AccountStatus,
    statusReason: row.status_reason ?? undefined,
    statusChangedAt: row.status_changed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureProfile(
  privyUserId: string,
  walletAddress?: string,
  email?: string | null,
) {
  const supabase = getSupabaseAdmin();

  const row: Record<string, string> = {
    privy_user_id: privyUserId,
  };

  if (walletAddress) row.wallet_address = walletAddress;
  if (email) row.email = email;

  const { data, error } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "privy_user_id" })
    .select(
      "id, privy_user_id, wallet_address, email, role, account_status, status_reason, status_changed_at, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return mapProfile(data);
}

export async function getAccountProfile(privyUserId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, privy_user_id, wallet_address, email, role, account_status, status_reason, status_changed_at, created_at, updated_at",
    )
    .eq("privy_user_id", privyUserId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return ensureProfile(privyUserId);
  return mapProfile(data);
}
