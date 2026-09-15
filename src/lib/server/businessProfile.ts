import type { BusinessProfile } from "@/lib/business/profile";
import type { StablecoinSymbol } from "@/lib/assets";
import { getSupabaseAdmin } from "@/lib/server/supabase";

type BusinessProfileRow = {
  business_name: string;
  country_code: string | null;
  business_email: string | null;
  default_receive_wallet: string | null;
  default_receive_asset: string | null;
  created_at: string;
  updated_at: string;
};

export function mapBusinessProfile(row: BusinessProfileRow): BusinessProfile {
  return {
    businessName: row.business_name,
    countryCode: row.country_code ?? undefined,
    businessEmail: row.business_email ?? undefined,
    defaultReceiveWallet: row.default_receive_wallet
      ? (row.default_receive_wallet as `0x${string}`)
      : undefined,
    defaultReceiveAsset: row.default_receive_asset
      ? (row.default_receive_asset as StablecoinSymbol)
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getBusinessProfile(
  privyUserId: string,
): Promise<BusinessProfile | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("business_profiles")
    .select(
      "business_name, country_code, business_email, default_receive_wallet, default_receive_asset, created_at, updated_at",
    )
    .eq("privy_user_id", privyUserId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapBusinessProfile(data as BusinessProfileRow) : null;
}

export async function getBusinessName(privyUserId: string) {
  const profile = await getBusinessProfile(privyUserId);
  return profile?.businessName;
}
