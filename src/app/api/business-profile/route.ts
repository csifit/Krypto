import { isAddress } from "viem";
import { getActiveStablecoin } from "@/lib/assets";
import { AccessPolicyError, requireSensitiveAction } from "@/lib/server/access";
import {
  AuthError,
  getPrivyLinkedEvmAddresses,
  requirePrivyUser,
} from "@/lib/server/privy";
import { ensureProfile } from "@/lib/server/profile";
import {
  getBusinessProfile,
  mapBusinessProfile,
} from "@/lib/server/businessProfile";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    return Response.json({
      businessProfile: await getBusinessProfile(userId),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("business profile load failed", error);
    return Response.json(
      { error: "Could not load business profile" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await requireSensitiveAction(userId);

    const body = (await request.json()) as {
      businessName?: string;
      countryCode?: string;
      businessEmail?: string;
      defaultReceiveWallet?: string;
      defaultReceiveAsset?: string;
    };

    const businessName = body.businessName?.trim();
    if (!businessName || businessName.length > 120) {
      return Response.json(
        { error: "Enter a business or trading name" },
        { status: 400 },
      );
    }

    const countryCode = body.countryCode?.trim().toUpperCase() || null;
    if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
      return Response.json(
        { error: "Country must use a 2-letter country code, for example RO or US" },
        { status: 400 },
      );
    }

    const businessEmail = body.businessEmail?.trim().toLowerCase() || null;
    if (
      businessEmail &&
      (!EMAIL_RE.test(businessEmail) || businessEmail.length > 254)
    ) {
      return Response.json(
        { error: "Enter a valid business email" },
        { status: 400 },
      );
    }

    let defaultReceiveWallet: string | null = null;
    if (body.defaultReceiveWallet?.trim()) {
      const wallet = body.defaultReceiveWallet.trim();

      if (!isAddress(wallet)) {
        return Response.json(
          { error: "Invalid default receive wallet" },
          { status: 400 },
        );
      }

      const linked = await getPrivyLinkedEvmAddresses(userId);
      if (!linked.has(wallet.toLowerCase())) {
        return Response.json(
          { error: "Default receive wallet must belong to this Krypto121 account" },
          { status: 403 },
        );
      }

      defaultReceiveWallet = wallet;
    }

    let defaultReceiveAsset: string | null = null;
    if (body.defaultReceiveAsset?.trim()) {
      const asset = getActiveStablecoin(body.defaultReceiveAsset.trim());
      if (!asset) {
        return Response.json(
          { error: "Unsupported default receive asset" },
          { status: 400 },
        );
      }
      defaultReceiveAsset = asset.symbol;
    }

    await ensureProfile(userId);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("business_profiles")
      .upsert(
        {
          privy_user_id: userId,
          business_name: businessName,
          country_code: countryCode,
          business_email: businessEmail,
          default_receive_wallet: defaultReceiveWallet,
          default_receive_asset: defaultReceiveAsset,
        },
        { onConflict: "privy_user_id" },
      )
      .select(
        "business_name, country_code, business_email, default_receive_wallet, default_receive_asset, created_at, updated_at",
      )
      .single();

    if (error) throw error;

    return Response.json({
      businessProfile: mapBusinessProfile(data),
    });
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("business profile save failed", error);
    return Response.json(
      { error: "Could not save business profile" },
      { status: 500 },
    );
  }
}
